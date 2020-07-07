import shimmer from 'shimmer';

const STACK_LIMIT = 4096;
const MESSAGE_LIMIT = 1024;

function useful(s) {
  return s && s.trim() !== '' && !s.startsWith('[object');
}

function limit(s, limit) {
  if (s.length > limit) {
    return s.substring(0, limit);
  } else {
    return s;
  }
}

function addStackIfUseful(span, err) {
  // FIXME handle Map<> form of err.stack
  if (err && err.stack && useful(err.stack)) {
    span.setAttribute('error.stack', limit(err.stack, STACK_LIMIT));
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

// FIXME limit length of error.message
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
      addStackIfUseful(span, firstError)
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

  report(source, arg) {
    if (!arg || arg.length === 0) {
      return;
    }
    if (arg instanceof Array && arg.length == 1) {
      arg = arg[0];
    }
    if (arg instanceof Error) {
      this.reportError(source, arg);
    } else if (arg instanceof ErrorEvent) {
      this.reportErrorEvent(source, arg);
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
  splunkRum.error = function() {
    reporter.report('SplunkRum.error', Array.from(arguments));
  }

  // Future possibility is https://www.w3.org/TR/reporting/#reporting-observer
}