/* eslint-disable @typescript-eslint/no-this-alias, consistent-return, @typescript-eslint/ban-types, @typescript-eslint/explicit-module-boundary-types, header/header */
/*
 * Copyright The OpenTelemetry Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * 
 * Modifications: Copyright 2023 Splunk Inc.
 * Removed dependencies from zone.js
 */

import { isWrapped, InstrumentationBase } from '@opentelemetry/instrumentation';

import * as api from '@opentelemetry/api';
import { getElementXPath } from '@opentelemetry/sdk-trace-web';
import { AttributeNames } from './enums/AttributeNames';
import {
  EventName,
  ShouldPreventSpanCreation,
  UserInteractionInstrumentationConfig,
} from './types';
import {
  SpanData,
} from './internal-types';
import { VERSION } from './version';

const EVENT_NAVIGATION_NAME = 'Navigation:';
const DEFAULT_EVENT_NAMES: EventName[] = ['click'];

function defaultShouldPreventSpanCreation() {
  return false;
}

/**
 * This class represents a UserInteraction plugin for auto instrumentation.
 * If zone.js is available then it patches the zone otherwise it patches
 * addEventListener of HTMLElement
 */
export class UserInteractionInstrumentation extends InstrumentationBase<unknown> {
  readonly version = VERSION;
  readonly moduleName: string = 'user-interaction';
  private _spansData = new WeakMap<api.Span, SpanData>();
  private _zonePatched?: boolean;
  // for addEventListener/removeEventListener state
  private _wrappedListeners = new WeakMap<
    Function | EventListenerObject,
    Map<string, Map<HTMLElement, Function>>
  >();
  // for event bubbling
  private _eventsSpanMap: WeakMap<Event, api.Span> = new WeakMap<
    Event,
    api.Span
  >();
  private _eventNames: Set<EventName>;
  private _shouldPreventSpanCreation: ShouldPreventSpanCreation;

  constructor(config?: UserInteractionInstrumentationConfig) {
    super('@opentelemetry/instrumentation-user-interaction', VERSION, config);
    this._eventNames = new Set(config?.eventNames ?? DEFAULT_EVENT_NAMES);
    this._shouldPreventSpanCreation =
      typeof config?.shouldPreventSpanCreation === 'function'
        ? config.shouldPreventSpanCreation
        : defaultShouldPreventSpanCreation;
  }

  init() {}

  /**
   * Controls whether or not to create a span, based on the event type.
   */
  protected _allowEventName(eventName: EventName): boolean {
    return this._eventNames.has(eventName);
  }

  /**
   * Creates a new span
   * @param element
   * @param eventName
   * @param parentSpan
   */
  private _createSpan(
    element: EventTarget | null | undefined,
    eventName: EventName,
    parentSpan?: api.Span
  ): api.Span | undefined {
    if (!(element instanceof HTMLElement)) {
      return undefined;
    }
    if (!element.getAttribute) {
      return undefined;
    }
    if (element.hasAttribute('disabled')) {
      return undefined;
    }
    if (!this._allowEventName(eventName)) {
      return undefined;
    }
    const xpath = getElementXPath(element, true);
    try {
      const span = this.tracer.startSpan(
        eventName,
        {
          attributes: {
            [AttributeNames.EVENT_TYPE]: eventName,
            [AttributeNames.TARGET_ELEMENT]: element.tagName,
            [AttributeNames.TARGET_XPATH]: xpath,
            [AttributeNames.HTTP_URL]: window.location.href,
          },
        },
        parentSpan
          ? api.trace.setSpan(api.context.active(), parentSpan)
          : undefined
      );

      if (this._shouldPreventSpanCreation(eventName, element, span) === true) {
        return undefined;
      }

      this._spansData.set(span, {
        taskCount: 0,
      });

      return span;
    } catch (e) {
      this._diag.error('failed to start create new user interaction span', e);
    }
    return undefined;
  }

  /**
   * Returns true iff we should use the patched callback; false if it's already been patched
   */
  private addPatchedListener(
    on: HTMLElement,
    type: string,
    listener: Function | EventListenerObject,
    wrappedListener: Function
  ): boolean {
    let listener2Type = this._wrappedListeners.get(listener);
    if (!listener2Type) {
      listener2Type = new Map();
      this._wrappedListeners.set(listener, listener2Type);
    }
    let element2patched = listener2Type.get(type);
    if (!element2patched) {
      element2patched = new Map();
      listener2Type.set(type, element2patched);
    }
    if (element2patched.has(on)) {
      return false;
    }
    element2patched.set(on, wrappedListener);
    return true;
  }

  /**
   * Returns the patched version of the callback (or undefined)
   */
  private removePatchedListener(
    on: HTMLElement,
    type: string,
    listener: Function | EventListenerObject
  ): Function | undefined {
    const listener2Type = this._wrappedListeners.get(listener);
    if (!listener2Type) {
      return undefined;
    }
    const element2patched = listener2Type.get(type);
    if (!element2patched) {
      return undefined;
    }
    const patched = element2patched.get(on);
    if (patched) {
      element2patched.delete(on);
      if (element2patched.size === 0) {
        listener2Type.delete(type);
        if (listener2Type.size === 0) {
          this._wrappedListeners.delete(listener);
        }
      }
    }
    return patched;
  }

  // utility method to deal with the Function|EventListener nature of addEventListener
  private _invokeListener(
    listener: Function | EventListenerObject,
    target: any,
    args: any[]
  ): any {
    if (typeof listener === 'function') {
      return listener.apply(target, args);
    } else {
      return listener.handleEvent(args[0]);
    }
  }

  /**
   * This patches the addEventListener of HTMLElement to be able to
   * auto instrument the click events
   * This is done when zone is not available
   */
  private _patchAddEventListener() {
    const plugin = this;
    return (original: EventTarget['addEventListener']) => {
      return function addEventListenerPatched(
        this: HTMLElement,
        type: keyof HTMLElementEventMap,
        listener: EventListenerOrEventListenerObject | null,
        useCapture?: boolean | AddEventListenerOptions
      ) {
        // Forward calls with listener = null
        if (!listener) {
          return original.call(this, type, listener, useCapture);
        }

        // filter out null (typeof null === 'object')
        const once =
          useCapture && typeof useCapture === 'object' && useCapture.once;
        const patchedListener = function (this: HTMLElement, ...args: any[]) {
          let parentSpan: api.Span | undefined;
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
            return api.context.with(
              api.trace.setSpan(api.context.active(), span),
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
  }

  /**
   * This patches the removeEventListener of HTMLElement to handle the fact that
   * we patched the original callbacks
   * This is done when zone is not available
   */
  private _patchRemoveEventListener() {
    const plugin = this;
    return (original: Function) => {
      return function removeEventListenerPatched(
        this: HTMLElement,
        type: any,
        listener: any,
        useCapture: any
      ) {
        const wrappedListener = plugin.removePatchedListener(
          this,
          type,
          listener
        );
        if (wrappedListener) {
          return original.call(this, type, wrappedListener, useCapture);
        } else {
          return original.call(this, type, listener, useCapture);
        }
      };
    };
  }

  /**
   * Most browser provide event listener api via EventTarget in prototype chain.
   * Exception to this is IE 11 which has it on the prototypes closest to EventTarget:
   *
   * * - has addEventListener in IE
   * ** - has addEventListener in all other browsers
   * ! - missing in IE
   *
   * HTMLElement -> Element -> Node * -> EventTarget **! -> Object
   * Document -> Node * -> EventTarget **! -> Object
   * Window * -> WindowProperties ! -> EventTarget **! -> Object
   */
  private _getPatchableEventTargets(): EventTarget[] {
    return window.EventTarget
      ? [EventTarget.prototype]
      : [Node.prototype, Window.prototype];
  }

  /**
   * Patches the history api
   */
  _patchHistoryApi() {
    this._unpatchHistoryApi();

    this._wrap(history, 'replaceState', this._patchHistoryMethod());
    this._wrap(history, 'pushState', this._patchHistoryMethod());
    this._wrap(history, 'back', this._patchHistoryMethod());
    this._wrap(history, 'forward', this._patchHistoryMethod());
    this._wrap(history, 'go', this._patchHistoryMethod());
  }

  /**
   * Patches the certain history api method
   */
  _patchHistoryMethod() {
    const plugin = this;
    return (original: any) => {
      return function patchHistoryMethod(this: History, ...args: unknown[]) {
        const url = `${location.pathname}${location.hash}${location.search}`;
        const result = original.apply(this, args);
        const urlAfter = `${location.pathname}${location.hash}${location.search}`;
        if (url !== urlAfter) {
          plugin._updateInteractionName(urlAfter);
        }
        return result;
      };
    };
  }

  /**
   * unpatch the history api methods
   */
  _unpatchHistoryApi() {
    if (isWrapped(history.replaceState)) {this._unwrap(history, 'replaceState');}
    if (isWrapped(history.pushState)) {this._unwrap(history, 'pushState');}
    if (isWrapped(history.back)) {this._unwrap(history, 'back');}
    if (isWrapped(history.forward)) {this._unwrap(history, 'forward');}
    if (isWrapped(history.go)) {this._unwrap(history, 'go');}
  }

  /**
   * Updates interaction span name
   * @param url
   */
  _updateInteractionName(url: string) {
    const span: api.Span | undefined = api.trace.getSpan(api.context.active());
    if (span && typeof span.updateName === 'function') {
      span.updateName(`${EVENT_NAVIGATION_NAME} ${url}`);
    }
  }

  /**
   * implements enable function
   */
  override enable() {
    this._zonePatched = false;
    const targets = this._getPatchableEventTargets();
    targets.forEach(target => {
      if (isWrapped(target.addEventListener)) {
        this._unwrap(target, 'addEventListener');
        this._diag.debug(
          'removing previous patch from method addEventListener'
        );
      }
      if (isWrapped(target.removeEventListener)) {
        this._unwrap(target, 'removeEventListener');
        this._diag.debug(
          'removing previous patch from method removeEventListener'
        );
      }
      this._wrap(target, 'addEventListener', this._patchAddEventListener());
      this._wrap(
        target,
        'removeEventListener',
        this._patchRemoveEventListener()
      );
    });

    this._patchHistoryApi();
  }

  /**
   * implements unpatch function
   */
  override disable() {
    const targets = this._getPatchableEventTargets();
    targets.forEach(target => {
      if (isWrapped(target.addEventListener)) {
        this._unwrap(target, 'addEventListener');
      }
      if (isWrapped(target.removeEventListener)) {
        this._unwrap(target, 'removeEventListener');
      }
    });

    this._unpatchHistoryApi();
  }

  /**
   * returns Zone
   */
  getZoneWithPrototype(): undefined {
    return undefined;
  }
}
