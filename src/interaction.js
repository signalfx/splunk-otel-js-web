import {UserInteractionPlugin} from '@opentelemetry/plugin-user-interaction';

const allowedEventTypes = {
  click: true,
  dblclick: true,
  submit: true,
  reset: true,
  dragend: true,
  drop: true,
  ended: true,
  pause: true,
  play: true,
  change: true,
  mousedown: true,
  mouseup: true,
};


export class SplunkUserInteractionPlugin extends UserInteractionPlugin {
  getZoneWithPrototype() {
    // FIXME work out ngZone issues with Angular  PENDING
    return undefined;
  }

  _allowEventType(eventType) {
    return allowedEventTypes[eventType];
  }

  emitRouteChangeSpan(oldHref) {
    const tracer = window.SplunkRum._provider.getTracer('route');
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
