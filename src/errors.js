// FIXME does this pollute window.Tracekit?  Can I fix that?
import Tracekit from 'tracekit';
import shimmer from 'shimmer';

const STACK_LIMIT = 4096;

function stackToString(stack) {
  let answer = '';
  for(const frame of stack) {
    const line = frame.line || '';
    const col = frame.column || '';
    const f = frame.func || '<?>'
    const linePlusCol = (frame.line && frame.column) ? `:${line}:${col}` : '';
    answer += `  at ${f} (${frame.url}${linePlusCol})\n`;
    if (answer.length > STACK_LIMIT) {
      return answer.substr(0, STACK_LIMIT-3)+'...';
    }
  }
  return answer;
}

function useful(s) {
  return s && s.trim() !== '' && !s.startsWith('[object');
}

function addStackIfUseful(span, report) {
  if (report.stack) {
    const stackString = stackToString(report.stack);
    if (useful(stackString)) {
      span.setAttribute('error.stack', stackString);
    }
  }
}

function handleTracekitError(tracer, report) {
  if (!useful(report.name) || !useful(report.message)) {
    return;
  }
  const span = tracer.startSpan(report.name);
  span.setAttribute('component', 'error');
  span.setAttribute('error.type', report.name);
  span.setAttribute('error.message', report.message);
  addStackIfUseful(span, report);
  span.end(span.startTime);
}

function registerTracekitListener(tracer) {
  Tracekit.remoteFetching = false; // don't try to get SourceMaps, etc.
  Tracekit.report.subscribe(function(report) {
    handleTracekitError(tracer, report);
  });
}

function stringifyArgs(...args) {
  return args.map(o => o.toString()).join(' ');
}

function handleConsoleErrorMessage(tracer, msg) {
  if (!useful(msg)) {
    return;
  }
  const span = tracer.startSpan(name);
  span.setAttribute('component', 'error');
  span.setAttribute('error.type', 'console.error');
  span.setAttribute('error.message', msg);
  // FIXME compute and send stack trace?
  span.end(span.startTime);
}

function handleConsoleErrorError(tracer, err) {
  const report = Tracekit.computeStackTrace(err);
  const msg = err.message || err.toString();
  if (!useful(msg) && (!report || !report.stack)) {
    return;
  }
  const span = tracer.startSpan(name);
  span.setAttribute('component', 'error');
  span.setAttribute('error.type', typeof err);
  span.setAttribute('error.message', msg);
  addStackIfUseful(span, report);
  span.end(span.startTime);
}

function captureConsoleError(tracer) {
  shimmer.wrap(console, 'error', function(original) {
    return function () {
      if (arguments.length === 1 && arguments[0] instanceof Error) {
        handleConsoleErrorError(tracer, arguments[0]);
      } else {
        const message = stringifyArgs(Array.from(arguments));
        handleConsoleErrorMessage(tracer, message);
      }

      return original.apply(this, arguments);
    };
  });
}


export function captureErrors(provider) {
  const tracer = provider.getTracer('error');
  registerTracekitListener(tracer);
  captureConsoleError(tracer);
  // FIXME https://developer.mozilla.org/en-US/docs/Web/Events/unhandledrejection
  // FIXME https://www.w3.org/TR/reporting/#reporting-observer
  // FIXME expose SfxRum.report(err)
}