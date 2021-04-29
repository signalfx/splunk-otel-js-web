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

import * as shimmer from 'shimmer';
import { getElementXPath } from '@opentelemetry/web';
import { limitLen } from './utils';
import { Span } from '@opentelemetry/api';
import { hrTime } from '@opentelemetry/core';
import { InstrumentationBase, InstrumentationConfig } from '@opentelemetry/instrumentation';

// FIXME take timestamps from events?

const STACK_LIMIT = 4096;
const MESSAGE_LIMIT = 1024;

function useful(s) {
  return s && s.trim() !== '' && !s.startsWith('[object') && s !== 'error';
}

function addStackIfUseful(span: Span, err: Error) {
  if (err && err.stack && useful(err.stack)) {
    span.setAttribute('error.stack', limitLen(err.stack.toString(), STACK_LIMIT));
  }
}

export const ERROR_INSTRUMENTATION_NAME = 'errors';
export const ERROR_INSTRUMENTATION_VERSION = '1';

export class SplunkErrorInstrumentation extends InstrumentationBase {
  private readonly _consoleErrorHandler = (original: Console['error']) => {
    return (...args: any[]) => {
      this.report('console.error', args);
      return original.apply(this, args);
    };
  };

  private readonly _unhandledRejectionListener = (event: PromiseRejectionEvent) => {
    this.report('unhandledrejection', event.reason);
  };

  private readonly _errorListener = (event: ErrorEvent) => {
    this.report('onerror', event);
  };

  private readonly _documentErrorListener = (event: ErrorEvent) => {
    this.report('eventListener.error', event);
  };

  constructor(config: InstrumentationConfig) {
    super(ERROR_INSTRUMENTATION_NAME, ERROR_INSTRUMENTATION_VERSION, config);
  }

  init(): void {}

  enable(): void {
    shimmer.wrap(console, 'error', this._consoleErrorHandler);
    window.addEventListener('unhandledrejection', this._unhandledRejectionListener);
    window.addEventListener('error', this._errorListener);
    document.documentElement.addEventListener('error', this._documentErrorListener, { capture: true });
  }

  disable(): void {
    shimmer.unwrap(console, 'error');
    window.removeEventListener('unhandledrejection', this._unhandledRejectionListener);
    window.removeEventListener('error', this._errorListener);
    document.documentElement.removeEventListener('error', this._documentErrorListener, { capture: true });
  }

  protected reportError(source: string, err: Error): void {
    const msg = err.message || err.toString();
    if (!useful(msg) && !err.stack) {
      return;
    }

    const now = hrTime();
    const span = this.tracer.startSpan(source, { startTime: now });
    span.setAttribute('component', 'error');
    span.setAttribute('error', true);
    span.setAttribute('error.object', useful(err.name) ? err.name : err.constructor && err.constructor.name ? err.constructor.name : 'Error');
    span.setAttribute('error.message', limitLen(msg, MESSAGE_LIMIT));
    addStackIfUseful(span, err);
    span.end(now);
  }

  protected reportString(source: string, message: string, firstError?: Error): void {
    if (!useful(message)) {
      return;
    }

    const now = hrTime();
    const span = this.tracer.startSpan(source, { startTime: now });
    span.setAttribute('component', 'error');
    span.setAttribute('error', true);
    span.setAttribute('error.object', 'String');
    span.setAttribute('error.message', limitLen(message, MESSAGE_LIMIT));
    if (firstError) {
      addStackIfUseful(span, firstError);
    }
    span.end(now);
  }

  protected reportErrorEvent(source: string, ev: ErrorEvent): void {
    if (ev.error) {
      this.report(source, ev.error);
    } else if (ev.message) {
      this.report(source, ev.message);
    }
  }

  protected reportEvent(source: string, ev: Event): void {
    // FIXME consider other sources of global 'error' DOM callback - what else can be captured here?
    if (!ev.target && !useful(ev.type)) {
      return;
    }

    const now = hrTime();
    const span = this.tracer.startSpan(source, { startTime: now });
    span.setAttribute('component', 'error');
    span.setAttribute('error.type', ev.type);
    if (ev.target) {
      // TODO: find types to match this
      span.setAttribute('target_element', (ev.target as any).tagName);
      span.setAttribute('target_xpath', getElementXPath(ev.target, true));
      span.setAttribute('target_src', (ev.target as any).src);
    }
    span.end(now);
  }

  public report(source: string, arg: string | Event | ErrorEvent | Array<any>): void {
    if (Array.isArray(arg) && arg.length === 0) {
      return;
    }
    if (arg instanceof Array && arg.length === 1) {
      arg = arg[0];
    }
    if (arg instanceof Error) {
      this.reportError(source, arg);
    } else if (arg instanceof ErrorEvent) {
      this.reportErrorEvent(source, arg);
    } else if (arg instanceof Event) {
      this.reportEvent(source, arg);
    } else if (typeof arg === 'string') {
      this.reportString(source, arg);
    } else if (arg instanceof Array) {
      // if any arguments are Errors then add the stack trace even though the message is handled differently
      const firstError = arg.find(x => x instanceof Error);
      this.reportString(source, arg.map(x => x.toString()).join(' '), firstError);
    } else {
      this.reportString(source, (arg as any).toString()); // FIXME or JSON.stringify?
    }
  }
}
