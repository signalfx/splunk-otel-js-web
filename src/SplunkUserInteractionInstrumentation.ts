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
import { InstrumentationConfig } from '@opentelemetry/instrumentation';
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

    // fix bug: angular checks passive event listener support with "null" event listener,
    // which cannot be used as a WeakMap key
    const _origAddPatchedListener = (this as any).addPatchedListener.bind(this);
    (this as any).addPatchedListener = (
      on: HTMLElement,
      type: string,
      // eslint-disable-next-line @typescript-eslint/ban-types
      listener: Function | EventListenerObject,
      // eslint-disable-next-line @typescript-eslint/ban-types
      wrappedListener: Function
    ) => {
      if (!listener) {
        return true;
      }

      return _origAddPatchedListener(on, type, listener, wrappedListener);
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
