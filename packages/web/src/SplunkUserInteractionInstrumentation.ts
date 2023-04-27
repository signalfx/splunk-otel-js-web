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

import { Span, trace, Tracer, TracerProvider } from '@opentelemetry/api';
import { hrTime } from '@opentelemetry/core';
import { UserInteractionInstrumentation } from '@opentelemetry/instrumentation-user-interaction';
import { UserInteractionInstrumentationConfig } from '@opentelemetry/instrumentation-user-interaction/build/src/types';

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
export const DEFAULT_AUTO_INSTRUMENTED_EVENT_NAMES = Object.keys(DEFAULT_AUTO_INSTRUMENTED_EVENTS) as (keyof HTMLElementEventMap)[];

const ROUTING_INSTRUMENTATION_NAME = 'route';
const ROUTING_INSTRUMENTATION_VERSION = '1';

export interface SplunkUserInteractionInstrumentationConfig extends UserInteractionInstrumentationConfig {
  events?: UserInteractionEventsConfig;
}

function isPatchableEventListner(listener: Parameters<EventTarget['addEventListener']>[1]) {
  return listener && (typeof listener === 'function' || (typeof listener === 'object' && typeof listener.handleEvent === 'function'));
}

type EventName = keyof HTMLElementEventMap;
type ExposedSuper = {
  _createSpan: (
    element: EventTarget | null | undefined,
    eventName: EventName,
    parentSpan?: Span | undefined
  ) => Span | undefined;
  _patchAddEventListener: () => ((original: EventTarget['addEventListener']) => EventTarget['addEventListener']);
};

export class SplunkUserInteractionInstrumentation extends UserInteractionInstrumentation {
  private _routingTracer: Tracer;
  private __hashChangeHandler: (ev: Event) => void;

  constructor(config: SplunkUserInteractionInstrumentationConfig = {}) {
    // Prefer otel's eventNames property
    if (!config.eventNames) {
      const eventMap = Object.assign({}, DEFAULT_AUTO_INSTRUMENTED_EVENTS, config.events);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const eventNames = Object.entries(eventMap).filter(([_eventName, enabled]) => enabled).map(([eventName]) => eventName) as (keyof HTMLElementEventMap)[];
      config.eventNames = eventNames;
    }

    super(config);

    this._routingTracer = trace.getTracer(ROUTING_INSTRUMENTATION_NAME, ROUTING_INSTRUMENTATION_VERSION);

    const _superCreateSpan = (this as unknown as ExposedSuper)._createSpan.bind(this) as ExposedSuper['_createSpan'];
    (this as unknown as ExposedSuper)._createSpan = (element: EventTarget | HTMLElement | Document | null | undefined, eventName: EventName, parentSpan?: Span) => {
      // Fix: No span is created when event is captured from document
      if (element === document) {
        element = document.documentElement;
      }

      const span = _superCreateSpan(element, eventName, parentSpan);
      if (span) {
        span.setAttribute('component', this.moduleName);
      }

      return span;
    };

    const _superPatchAddEventListener = (this as unknown as ExposedSuper)._patchAddEventListener.bind(this);
    (this as unknown as ExposedSuper)._patchAddEventListener = () => {
      const patcher = _superPatchAddEventListener();

      return (original) => {
        const patchedListener = patcher(original) as EventTarget['addEventListener'];
        // Fix: Error when .addEventListener(type, listener, null)
        return function (
          this: EventTarget,
          type: keyof HTMLElementEventMap,
          listener: EventListenerOrEventListenerObject | null,
          useCapture?: boolean | AddEventListenerOptions | null
        ) {
          // Only forward to otel if it can patch it
          if (!isPatchableEventListner(listener)) {
            return original.call(this, type, listener, useCapture);
          }

          if (useCapture === null) {
            useCapture = undefined;
          }
          return patchedListener.call(this, type, listener, useCapture);
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
    this.__hashChangeHandler = (event: Event) => {
      this._emitRouteChangeSpan((event as HashChangeEvent).oldURL);
    };

    // Hash can be changed with location.hash = '#newThing', no way to hook that directly...
    window.addEventListener('hashchange', this.__hashChangeHandler);

    super.enable();
  }

  disable(): void {
    super.disable();

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

  private _emitRouteChangeSpan(oldHref) {
    const now = hrTime();
    const span = this._routingTracer.startSpan('routeChange', { startTime: now });
    span.setAttribute('component', this.moduleName);
    span.setAttribute('prev.href', oldHref);
    // location.href set with new value by default
    span.end(now);
  }
}
