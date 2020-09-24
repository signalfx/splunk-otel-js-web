// FIXME convert into otel-js-contrib Plugin and upstream
import shimmer from 'shimmer';
import {SpanKind} from '@opentelemetry/api';

function size(o) {
  return o.byteLength || o.size || o.length || undefined;
}

export class WebSocketInstrumentation {
  constructor(provider) {
    this._tracer = provider.getTracer('websocket');
    this.listener2ws2patched = new WeakMap();
  }
  startSpan(ws, name, spanKind) {
    const span = this._tracer.startSpan(name, {kind: spanKind});
    span.setAttribute('component', 'websocket');
    span.setAttribute('protocol', ws.protocol);
    span.setAttribute('http.url', ws.url);
    // FIXME anything else?
    return span;
  }

  patchSend(ws) {
    const plugin = this;
    const origSend = ws.send;
    ws.send = function() {
      const span = plugin.startSpan(ws,'send', SpanKind.PRODUCER);
      const sendSize = arguments.length > 0 ? size(arguments[0]) : undefined;
      span.setAttribute('http.request_content_length', sendSize);
      let retVal = undefined;

      try {
        retVal = origSend.apply(ws, arguments);
      } catch (err) {
        plugin.endSpanExceptionally(span, err);
        throw err;
      }
      if (retVal === false) { // Gecko 6.0
        span.setAttribute('error', true);
      }
      span.end();
      return retVal;
    };
  }

  // Returns true iff we should use the patched callback; false if it's already been patched
  addPatchedListener(ws, origListener, patched) {
    let ws2patched = this.listener2ws2patched.get(origListener);
    if (!ws2patched) {
      ws2patched = new Map();
      this.listener2ws2patched.set(origListener, ws2patched);
    }
    if (ws2patched.has(ws)) {
      return false;
    }
    ws2patched.set(ws, patched);
    return true;
  }

  // Returns patched listener or undefined
  removePatchedListener(ws, origListener) {
    const ws2patched = this.listener2ws2patched.get(origListener);
    if (!ws2patched) {
      return undefined;
    }
    const patched = ws2patched.get(ws);
    if (patched) {
      ws2patched.delete(ws);
      if (ws2patched.size === 0) {
        this.listener2ws2patched.delete(ws);
      }
    }
    return patched;
  }

  // FIXME need to share logic better with userinteraction plugin
  patchEventListener(ws) {
    const plugin = this;
    const origAEL = ws.addEventListener;
    ws.addEventListener = function(type, callback, options) {
      if (type !== 'message') { // only patching message event listeners
        origAEL.apply(ws, arguments);
        return;
      }
      const once = options && options.once;
      const patchedCallback = function() {
        const capturedThiz = this;
        const capturedArgs = arguments;
        if (once) {
          plugin.removePatchedListener(ws, callback);
        }
        const span = plugin.startSpan(ws, 'onmessage', SpanKind.CONSUMER);
        if (capturedArgs && capturedArgs[0] && capturedArgs[0].data) {
          span.setAttribute('http.response_content_length', size(capturedArgs[0].data));
        }
        // FIXME fill out message details, size, etc.
        return plugin._tracer.withSpan(span, () => {
          let result = undefined;
          if (typeof callback === 'function') {
            result = callback.apply(capturedThiz, capturedArgs);
          } else {
            result = callback.handleEvent(arguments[0]);
          }
          span.end();
          return result;
        });

      };
      if (plugin.addPatchedListener(ws, callback, patchedCallback)) {
        origAEL.apply(ws, [type, patchedCallback, options]);
      }
    };

    const origREL = ws.removeEventListener;
    ws.removeEventListener = function(type, callback) {
      if (type !== 'message') {
        return origREL.apply(ws, arguments);
      }
      const patchedCallback = plugin.removePatchedListener(ws, callback);
      if (patchedCallback) {
        return origREL.apply(ws, [type, patchedCallback]);
      } else {
        return origREL.apply(ws, arguments);
      }
    };

  }

  endSpanExceptionally(span, err) {
    console.log('endSpanExceptionally');
    span.setAttribute('error', true);
    span.setAttribute('error.message', err.message);
    span.setAttribute('error.object', err.name ?  err.name : err.constructor && err.constructor.name ? err.constructor.name : 'Error');
    span.end();
  }

  patch() {
    const plugin = this;
    shimmer.wrap(window, 'WebSocket', function (original) {
      return function (url, protocols) {
        let connectSpan = plugin._tracer.startSpan('connect');
        connectSpan.kind = SpanKind.CLIENT;
        connectSpan.setAttribute('component', 'websocket');
        if (url) {
          connectSpan.setAttribute('http.url', arguments[0]);
        }
        if (protocols) {
          if (typeof protocols === 'string') {
            connectSpan.setAttribute('protocols', protocols);
          } else {
            connectSpan.setAttribute('protocols', JSON.stringify(protocols));
          }
        }
        let retVal = undefined;
        let constructorException = undefined;

        try {
          retVal = new original(url, protocols);
        } catch (ce) {
          constructorException = ce;
        }

        if (constructorException) {
          plugin.endSpanExceptionally(connectSpan, constructorException);
          connectSpan = undefined;
          throw constructorException;
        } else {
          const ws = retVal;
          ws.addEventListener('open', function () {
            connectSpan.end();
            connectSpan = undefined;
          });
          ws.addEventListener('error', function (ev) {
            if (connectSpan) {
              if (ev.error) {
                plugin.endSpanExceptionally(connectSpan, ev.error);
              } else {
                connectSpan.setAttribute('error', true);
                connectSpan.setAttribute('error.message', ev.message);
                connectSpan.end();
              }
              connectSpan = undefined;
            } else {
              // error occured after connect... report that
              plugin.startSpan(ws, 'error');
              plugin.endSpanExceptionally(connectSpan, ev.error);
            }
          });
          plugin.patchSend(ws);
          plugin.patchEventListener(ws);
          return retVal;
        }
      };
    });
  }
}
