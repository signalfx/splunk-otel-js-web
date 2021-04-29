/*
Copyright 2020 Splunk Inc.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

// FIXME convert into otel-js-contrib Plugin and upstream
import shimmer from 'shimmer';
import {SpanKind, setSpan, context, Span} from '@opentelemetry/api';
import {isUrlIgnored} from '@opentelemetry/core';
import { version } from '../package.json';

import {
  InstrumentationBase, InstrumentationConfig,
} from '@opentelemetry/instrumentation';

function size(o) {
  return o.byteLength || o.size || o.length || undefined;
}

interface SplunkWebSocketInstrumentationConfig extends InstrumentationConfig {
  ignoreUrls?: (string|RegExp)[];
}

export class SplunkWebSocketInstrumentation extends InstrumentationBase {
  listener2ws2patched = new WeakMap();
  protected _config: SplunkWebSocketInstrumentationConfig;

  constructor(config: SplunkWebSocketInstrumentationConfig) {
    super('splunk-websocket', version, config);
    this._config = config;
  }

  init() {}

  protected startSpan(ws: WebSocket, name: string, spanKind: SpanKind) {
    const span = this.tracer.startSpan(name, {kind: spanKind});
    span.setAttribute('component', 'websocket');
    span.setAttribute('protocol', ws.protocol);
    span.setAttribute('http.url', ws.url);
    // FIXME anything else?
    return span;
  }

  protected patchSend(ws: WebSocket) {
    const instrumentation = this;
    const origSend = ws.send;
    ws.send = function instrumentedSend() {
      const span = instrumentation.startSpan(ws, 'send', SpanKind.PRODUCER);
      const sendSize = arguments.length > 0 ? size(arguments[0]) : undefined;
      span.setAttribute('http.request_content_length', sendSize);
      let retVal = undefined;

      try {
        retVal = origSend.apply(ws, arguments);
      } catch (err) {
        instrumentation.endSpanExceptionally(span, err);
        throw err;
      }

      if (retVal === false) { // Gecko 6.0
        instrumentation.endSpanExceptionally(span, new Error('Failed to send frame.'));
      }
      span.end();
      return retVal;
    };
  }

  // Returns true iff we should use the patched callback; false if it's already been patched
  protected addPatchedListener(ws: WebSocket, origListener, patched) {
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
  protected removePatchedListener(ws, origListener) {
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

  // FIXME need to share logic better with userinteraction instrumentation
  protected patchEventListener(ws: WebSocket) {
    const instrumentation = this;
    const origAEL: WebSocket['addEventListener'] = ws.addEventListener.bind(ws);

    ws.addEventListener = function instrumentedAddEventListener<K extends keyof WebSocketEventMap>(
      type: K,
      callback: ((this: WebSocket, ev: WebSocketEventMap[K]) => any) | EventListenerObject,
      options?: boolean | AddEventListenerOptions,
    ): any {
      if (type !== 'message') { // only patching message event listeners
        // TODO: remove any once typing is corrected
        // currently there's 2 overloaded versions of WebSocket['addEventListener']
        // this prevents function parameter inference,
        // and in consequence makes TS unable to match the arguments in the call below, even though they are correct
        return origAEL(type, callback as any, options);
      }

      const once = typeof options == 'boolean' ? undefined : options?.once;
      const patchedCallback = function patchedAddEventListenerCallback() {
        const capturedThiz = this;
        const capturedArgs = arguments;
        if (once) {
          instrumentation.removePatchedListener(ws, callback);
        }
        const span = instrumentation.startSpan(ws, 'onmessage', SpanKind.CONSUMER);
        if (capturedArgs && capturedArgs[0] && capturedArgs[0].data) {
          span.setAttribute('http.response_content_length', size(capturedArgs[0].data));
        }
        // FIXME fill out message details, size, etc.
        context.with(setSpan(context.active(), span), () => {
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
      if (instrumentation.addPatchedListener(ws, callback, patchedCallback)) {
        origAEL.apply(ws, [type, patchedCallback, options]);
      }
    };

    const origREL = ws.removeEventListener;
    ws.removeEventListener = function(type, callback) {
      if (type !== 'message') {
        return origREL.apply(ws, arguments);
      }
      const patchedCallback = instrumentation.removePatchedListener(ws, callback);
      if (patchedCallback) {
        return origREL.apply(ws, [type, patchedCallback]);
      } else {
        return origREL.apply(ws, arguments);
      }
    };

  }

  public enable() {
    const instrumentation = this;
    shimmer.wrap(window, 'WebSocket', function (original) {
      return function instrumentedWebSocket(url: string, protocols?: string | string[]) {
        if (isUrlIgnored(url, instrumentation._config.ignoreUrls)) {
          return new original(url, protocols);
        }

        let connectSpan = instrumentation.tracer.startSpan('connect', {
          kind: SpanKind.CLIENT,
          attributes: {
            'component': 'websocket',
          },
        });
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
        function instrumentedConstructor(): WebSocket {
          try {
            return new original(url, protocols);
          } catch (constructorException) {
            instrumentation.endSpanExceptionally(connectSpan, constructorException);
            throw constructorException;
          }
        }

        const ws = instrumentedConstructor();
        ws.addEventListener('open', function () {
          connectSpan.end();
        });
        ws.addEventListener('error', function (event: ErrorEvent) {
          if (connectSpan.isRecording()) {
            instrumentation.endSpanExceptionally(connectSpan, new Error(event.error || event.message || 'Could not connect.'));
          } else {
            // error occured after connect... report that
            instrumentation.startSpan(ws, 'error', SpanKind.CLIENT).end();
          }
        });
        instrumentation.patchSend(ws);
        instrumentation.patchEventListener(ws);
        return ws;
      };
    });
  }

  public disable() {
    shimmer.unwrap(window, 'WebSocket');
  }

  protected endSpanExceptionally(span: Span, err: Error) {
    span.setAttribute('error', true);
    span.setAttribute('error.message', err.message);
    span.setAttribute('error.object', err.name ?  err.name : err.constructor && err.constructor.name ? err.constructor.name : 'Error');
    //TODO Should we do span.setStatus( someErroCode ) ? Currently all failed spans are CanonicalCode.OK
    span.end();
  }
}
