import {UserInteractionPlugin} from '../deps/opentelemetry-js-contrib/plugins/web/opentelemetry-plugin-user-interaction/build/src';

const whitelistEventTypes = {
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
    return whitelistEventTypes[eventType];
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
          // FIXME names of attributes/span/component
          const tracer = window.SplunkRum._provider.getTracer('route');
          const span = tracer.startSpan('route change');
          span.setAttribute('component', plugin.moduleName);
          span.setAttribute('prev.href', oldHref);
          // location.href set with new value by default
          span.end(span.startTime);
        }
        return result;
      };
    };
  }
}
