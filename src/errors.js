import shimmer from 'shimmer';
import { getElementXPath } from '@opentelemetry/web';

// FIXME take timestamps from events?

const STACK_LIMIT = 4096;
const MESSAGE_LIMIT = 1024;

function useful(s) {
  return s && s.trim() !== '' && !s.startsWith('[object') && s !== 'error';
}

function limit(s, cap) {
  if (s.length > cap) {
    return s.substring(0, cap);
  } else {
    return s;
  }
}

function addStackIfUseful(span, err) {
  if (err && err.stack && useful(err.stack)) {
    span.setAttribute('error.stack', limit(err.stack.toString(), STACK_LIMIT));
  }
}

function captureConsoleError(reporter) {
  shimmer.wrap(console, 'error', function(original) {
    return function () {
      reporter.report('console.error', Array.from(arguments));
      return original.apply(this, arguments);
    };
  });
}

function registerUnhandledRejectionListener(reporter) {
  window.addEventListener('unhandledrejection', function (event) {
    reporter.report('unhandledrejection', event.reason);
  });
}

function captureError(reporter) {
  window.addEventListener('error', function(event) {
    reporter.report('onerror', event);
  });
}

function addTopLevelDocumentErrorListener(reporter) {
  document.documentElement.addEventListener('error', function(event) {
    reporter.report('eventListener.error', event);
  }, {capture: true});
}


class ErrorReporter {
  constructor(tracer) {
    this.tracer = tracer;
  }

  reportError(source, err) {
    const msg = err.message || err.toString();
    if (!useful(msg) && (!err.stack)) {
      return;
    }
    const span = this.tracer.startSpan(source);
    span.setAttribute('component', 'error');
    span.setAttribute('error', true);
    span.setAttribute('error.object', useful(err.name) ? err.name : (err.constructor && err.constructor.name ? err.constructor.name : 'Error'));
    span.setAttribute('error.message', limit(msg, MESSAGE_LIMIT));
    addStackIfUseful(span, err);
    span.end(span.startTime);
  }

  reportString(source, s, firstError) {
    if (!useful(s)) {
      return;
    }
    const span = this.tracer.startSpan(source);
    span.setAttribute('component', 'error');
    span.setAttribute('error', true);
    span.setAttribute('error.object', 'String');
    span.setAttribute('error.message', limit(s, MESSAGE_LIMIT));
    if (firstError) {
      addStackIfUseful(span, firstError);
    }
    span.end(span.startTime);
  }

  reportErrorEvent(source, ev) {
    if (ev.error) {
      this.report(source, ev.error);
    } else if (ev.message) {
      this.report(source, ev.message);
    }
  }

  reportEvent(source, ev) {
    // FIXME consider other sources of global 'error' DOM callback - what else can be captured here?
    if (!ev.target && !useful(ev.type)) {
      return;
    }
    const span = this.tracer.startSpan(source);
    span.setAttribute('component', 'error');
    span.setAttribute('error.type', ev.type);
    if (ev.target) {
      span.setAttribute('target_element', ev.target.tagName);
      span.setAttribute('target_xpath', getElementXPath(ev.target, true));
      span.setAttribute('target_src', ev.target.src);
    }
    span.end(span.startTime);
  }

  report(source, arg) {
    if (!arg || arg.length === 0) {
      return;
    }
    if (arg instanceof Array && arg.length === 1) {
      arg = arg[0];
    }
    if (arg instanceof Error) {
      this.reportError(source, arg);
    } else if (arg instanceof ErrorEvent) {
      this.reportErrorEvent(source, arg);
    } else if (arg instanceof Event) {
      this.reportEvent(source, arg);
    } else if (typeof arg === 'string') {
      this.reportString(source, arg);
    } else if (arg instanceof Array) {
      // if any arguments are Errors then add the stack trace even though the message is handled differently
      const firstError = arg.find(x => x instanceof Error);
      this.reportString(source, arg.map(x => x.toString()).join(' '), firstError);
    } else {
      this.reportString(source, arg.toString()); // FIXME or JSON.stringify?
    }
  }
}


export function captureErrors(splunkRum, provider) {
  const tracer = provider.getTracer('error');
  const reporter = new ErrorReporter(tracer);
  captureError(reporter);
  captureConsoleError(reporter);
  registerUnhandledRejectionListener(reporter);
  addTopLevelDocumentErrorListener(reporter);
  splunkRum.error = function() {
    reporter.report('SplunkRum.error', Array.from(arguments));
  };

  // Future possibility is https://www.w3.org/TR/reporting/#reporting-observer
}
