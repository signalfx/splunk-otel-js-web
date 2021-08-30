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

import { context, diag, Span, trace, Tracer, TracerProvider } from '@opentelemetry/api';
import { hrTime } from '@opentelemetry/core';
import { InstrumentationConfig, isWrapped } from '@opentelemetry/instrumentation';
import { UserInteractionInstrumentation } from '@opentelemetry/instrumentation-user-interaction';

export type UserInteractionEventsConfig = {
  [type: string]: boolean;
};

export const DEFAULT_AUTO_INSTRUMENTED_EVENTS: UserInteractionEventsConfig = {
  // pointer
  click: true,
  dblclick: true,
  mousedown: true,
  mouseup: true,

  // form
  submit: true,
  reset: true,
  change: true,

  // drap & drop
  dragend: true,
  drop: true,

  // media
  ended: true,
  pause: true,
  play: true,
};

const ROUTING_INSTRUMENTATION_NAME = 'route';
const ROUTING_INSTRUMENTATION_VERSION = '1';

export interface SplunkUserInteractionInstrumentationConfig extends InstrumentationConfig {
  events?: UserInteractionEventsConfig;
}

export class SplunkUserInteractionInstrumentation extends UserInteractionInstrumentation {
  private readonly _autoInstrumentedEvents: UserInteractionEventsConfig;
  private _routingTracer: Tracer;
  private __hashChangeHandler: (ev: HashChangeEvent) => void;

  constructor(config: SplunkUserInteractionInstrumentationConfig = {}) {
    super(config);

    const { events } = config;
    this._autoInstrumentedEvents = Object.assign({}, DEFAULT_AUTO_INSTRUMENTED_EVENTS, events);

    this._routingTracer = trace.getTracer(ROUTING_INSTRUMENTATION_NAME, ROUTING_INSTRUMENTATION_VERSION);

    const _superCreateSpan = (this as any)._createSpan.bind(this);
    (this as any)._createSpan = (element: HTMLElement | Document, eventName: string, parentSpan: Span) => {
      // Fix: No span is created when event is captured from document
      if (element === document) {
        element = document.documentElement;
      }

      return _superCreateSpan(element, eventName, parentSpan);
    };

    // open-telemetry/opentelemetry-js-contrib#643 - wrong this in event listeners
    (this as any)._patchAddEventListener = function() {
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      const plugin = this;
      return (original: EventTarget['addEventListener']) => {
        // eslint-disable-next-line consistent-return
        return function addEventListenerPatched(
          this: HTMLElement,
          type: any,
          listener: any,
          useCapture: any
        ) {
          const once = useCapture && useCapture.once;
          const patchedListener = function (this: HTMLElement, ...args: any[]) {
            let parentSpan: Span | undefined;
            const event: Event | undefined = args[0];
            const target = event?.target;
            if (event) {
              parentSpan = plugin._eventsSpanMap.get(event);
            }
            if (once) {
              plugin.removePatchedListener(this, type, listener);
            }
            const span = plugin._createSpan(target, type, parentSpan);
            if (span) {
              if (event) {
                plugin._eventsSpanMap.set(event, span);
              }
              return context.with(
                trace.setSpan(context.active(), span),
                () => {
                  const result = plugin._invokeListener(listener, this, args);
                  // no zone so end span immediately
                  span.end();
                  return result;
                }
              );
            } else {
              return plugin._invokeListener(listener, this, args);
            }
          };
          if (plugin.addPatchedListener(this, type, listener, patchedListener)) {
            return original.call(this, type, patchedListener, useCapture);
          }
        };
      };
    };
  }

  setTracerProvider(tracerProvider: TracerProvider): void {
    super.setTracerProvider(tracerProvider);
    this._routingTracer = tracerProvider.getTracer(ROUTING_INSTRUMENTATION_NAME, ROUTING_INSTRUMENTATION_VERSION);
  }

  getZoneWithPrototype(): undefined {
    // FIXME work out ngZone issues with Angular  PENDING
    return undefined;
  }

  enable(): void {
    this.__hashChangeHandler = (event) => {
      this._emitRouteChangeSpan(event.oldURL);
    };

    // Hash can be changed with location.hash = '#newThing', no way to hook that directly...
    window.addEventListener('hashchange', this.__hashChangeHandler);

    // Current parent implementation patches HTMLElement's prototype, which causes it to miss document.addEvenetListener:
    // HTMLElementPrototype -> ElementPrototype -> NodePrototype -> EventTargetPrototype -> Object
    // HTMLDocumentPrototype -> DocumentPrototype -> NodePrototype -> EventTargetPrototype -> Object
    // Most browsers have addEventListener on EventTargetPrototype, except for IE for which it doesn't exist and uses NodePrototype
    if (this.getZoneWithPrototype()) {
      super.enable();
    } else {
      (this as any)._zonePatched = false;
      if (isWrapped(Node.prototype.addEventListener)) {
        this._unwrap(Node.prototype, 'addEventListener');
        diag.debug('removing previous patch from method addEventListener');
      }
      if (isWrapped(Node.prototype.removeEventListener)) {
        this._unwrap(Node.prototype, 'removeEventListener');
        diag.debug('removing previous patch from method removeEventListener');
      }
      this._wrap(Node.prototype, 'addEventListener', (this as any)._patchAddEventListener());
      this._wrap(Node.prototype, 'removeEventListener', (this as any)._patchRemoveEventListener());

      this._patchHistoryApi();
    }
  }

  disable(): void {
    // parent unwraps calls to addEventListener so call before us
    if ((this as any)._zonePatched) {
      super.disable();
    } else {
      if (isWrapped(Node.prototype.addEventListener)) {
        this._unwrap(Node.prototype, 'addEventListener');
      }
      if (isWrapped(Node.prototype.removeEventListener)) {
        this._unwrap(Node.prototype, 'removeEventListener');
      }
      this._unpatchHistoryApi();
    }

    window.removeEventListener('hashchange', this.__hashChangeHandler);
  }

  // FIXME find cleaner way to patch
  _patchHistoryMethod(): (original: any) => (this: History, ...args: unknown[]) => any {
    const plugin = this;
    return (original) => {
      return function patchHistoryMethod(...args) {
        const oldHref = location.href;
        const result = original.apply(this, args);
        const newHref = location.href;
        if (oldHref !== newHref) {
          plugin._emitRouteChangeSpan(oldHref);
        }
        return result;
      };
    };
  }

  protected _allowEventType(eventType: string): boolean {
    return !!this._autoInstrumentedEvents[eventType];
  }

  private _emitRouteChangeSpan(oldHref) {
    const now = hrTime();
    const span = this._routingTracer.startSpan('routeChange', { startTime: now });
    span.setAttribute('component', this.moduleName);
    span.setAttribute('prev.href', oldHref);
    // location.href set with new value by default
    span.end(now);
  }
}
