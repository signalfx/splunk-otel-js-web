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

import { trace } from '@opentelemetry/api';
import {UserInteractionInstrumentation} from '@opentelemetry/instrumentation-user-interaction';

export const DEFAULT_AUTO_INSTRUMENTED_EVENTS = {
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
const ROUTING_INSTRUMENTATION_VERSION = 1;

export class SplunkUserInteractionInstrumentation extends UserInteractionInstrumentation {
  constructor(config) {
    super(config);

    const { events } = config;
    this._autoInstrumentedEvents = Object.assign({}, DEFAULT_AUTO_INSTRUMENTED_EVENTS, events);
    
    this._routingTracer = trace.getTracer(ROUTING_INSTRUMENTATION_NAME, ROUTING_INSTRUMENTATION_VERSION);
  }

  setTracerProvider(tracerProvider) {
    super.setTracerProvider(tracerProvider);
    this._routingTracer = tracerProvider.getTracer(ROUTING_INSTRUMENTATION_NAME, ROUTING_INSTRUMENTATION_VERSION);
  }

  getZoneWithPrototype() {
    // FIXME work out ngZone issues with Angular  PENDING
    return undefined;
  }

  _allowEventType(eventType) {
    return !!this._autoInstrumentedEvents[eventType];
  }

  emitRouteChangeSpan(oldHref) {
    const span = this._routingTracer.startSpan('routeChange');
    span.setAttribute('component', this.moduleName);
    span.setAttribute('prev.href', oldHref);
    // location.href set with new value by default
    span.end(span.startTime);
  }

  enable() {
    this.__hashChangeHandler = (event) => {
      this.emitRouteChangeSpan(event.oldURL);
    };

    // Hash can be changed with location.hash = '#newThing', no way to hook that directly...
    window.addEventListener('hashchange', this.__hashChangeHandler);

    // parent wraps calls to addEventListener so call after us
    super.enable();
  }

  disable() {
    // parent unwraps calls to addEventListener so call before us
    super.disable();
    window.removeEventListener('hashchange', this.__hashChangeHandler);
  }

  // FIXME find cleaner way to patch
  _patchHistoryMethod() {
    const plugin = this;
    return (original) => {
      return function patchHistoryMethod(...args) {
        const oldHref = location.href;
        const result = original.apply(this, args);
        const newHref = location.href;
        if (oldHref !== newHref) {
          plugin.emitRouteChangeSpan(oldHref);
        }
        return result;
      };
    };
  }
}
