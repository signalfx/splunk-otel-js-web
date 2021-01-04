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

import {UserInteractionPlugin} from '@opentelemetry/plugin-user-interaction';

const allowedEventTypes = [
  // pointer
  'click',
  'dblclick',
  'mousedown',
  'mouseup',

  // form
  'submit',
  'reset',
  'change',

  // drap & drop
  'dragend',
  'drop',

  // media
  'ended',
  'pause',
  'play',

  // keyboard
  'keydown',
  'keyup',
];

export class SplunkUserInteractionPlugin extends UserInteractionPlugin {
  getZoneWithPrototype() {
    // FIXME work out ngZone issues with Angular  PENDING
    return undefined;
  }

  _allowEventType(eventType) {
    return allowedEventTypes.includes(eventType);
  }

  emitRouteChangeSpan(oldHref) {
    const tracer = window.SplunkRum.provider.getTracer('route');
    const span = tracer.startSpan('routeChange');
    span.setAttribute('component', this.moduleName);
    span.setAttribute('prev.href', oldHref);
    // location.href set with new value by default
    span.end(span.startTime);
  }

  patch() {
    const plugin = this;
    // Hash can be changed with location.hash = '#newThing', no way to hook that directly...
    window.addEventListener('hashchange', function(event) {
      plugin.emitRouteChangeSpan(event.oldURL);
    });
    return super.patch();
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
