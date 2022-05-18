/*
Copyright 2021 Splunk Inc.

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

import {
  InstrumentationBase, InstrumentationConfig,
} from '@opentelemetry/instrumentation';

import { VERSION } from './version';
import { hrTime, isUrlIgnored } from '@opentelemetry/core';
import { addSpanNetworkEvents } from '@opentelemetry/sdk-trace-web';
import { SemanticAttributes } from '@opentelemetry/semantic-conventions';
import { context, Context, ROOT_CONTEXT } from '@opentelemetry/api';

export interface SplunkPostDocLoadResourceInstrumentationConfig extends InstrumentationConfig {
  allowedInitiatorTypes?: string[];
  ignoreUrls?: (string|RegExp)[];
}

const MODULE_NAME = 'splunk-post-doc-load-resource';
const defaultAllowedInitiatorTypes = ['img', 'script']; //other, css, link

const nodeHasSrcAttribute = (node: Node): node is HTMLScriptElement | HTMLImageElement => (node instanceof HTMLScriptElement || node instanceof HTMLImageElement);

export class SplunkPostDocLoadResourceInstrumentation extends InstrumentationBase {
  private observer: PerformanceObserver | undefined;
  private mutationObserver: MutationObserver | undefined;
  private urlToContextMap: Record<string, Context>;
  private config: SplunkPostDocLoadResourceInstrumentationConfig;

  constructor(config: SplunkPostDocLoadResourceInstrumentationConfig = {}) {
    const processedConfig: SplunkPostDocLoadResourceInstrumentationConfig = Object.assign(
      {},
      { allowedInitiatorTypes: defaultAllowedInitiatorTypes },
      config,
    );
    super(MODULE_NAME, VERSION, processedConfig);
    this.config = processedConfig;
    this.urlToContextMap = {};
  }

  init(): void {}

  enable(): void {
    if (window.PerformanceObserver) {
      window.addEventListener('load', () => {
        this._startObserver();
      });
    }
    if (window.MutationObserver) {
      this._startMutationObserver();
    }
  }

  disable(): void {
    if (this.observer) {
      this.observer.disconnect();
    }
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
    }
  }

  private _startObserver() {
    this.observer = new PerformanceObserver((list) => {
      if (window.document.readyState === 'complete') {
        list.getEntries().forEach(entry => {
          // TODO: check how we can amend TS base typing to fix this
          if (this.config.allowedInitiatorTypes.includes((entry as any).initiatorType)) {
            this._createSpan(entry);
          }
        });
      }
    });
    //apparently safari 13.1 only supports entryTypes
    this.observer.observe({ entryTypes: ['resource'] });
  }

  private _startMutationObserver() {
    this.mutationObserver = new MutationObserver(this._processMutationObserverRecords.bind(this));
    this.mutationObserver.observe(document.head, { childList: true });
  }

  public flushMutationObserver(): void {
    this._processMutationObserverRecords(this.mutationObserver.takeRecords());
  }

  private _processMutationObserverRecords(mutations: MutationRecord[]) {
    if (context.active() === ROOT_CONTEXT) {
      return;
    }
    mutations
      .flatMap(mutation => Array.from(mutation.addedNodes || []))
      .filter(nodeHasSrcAttribute)
      .forEach((node) => {
        const src = node.getAttribute('src');
        if (!src) {
          return;
        }
        const srcUrl = new URL(src, location.origin);
        this.urlToContextMap[srcUrl.toString()] = context.active();
      });
  }

  // TODO: discuss TS built-in types
  private _createSpan(entry: any) {
    if (isUrlIgnored(entry.name, this.config.ignoreUrls)) {
      return;
    }

    const targetUrl = new URL(entry.name, location.origin);
    const span = this.tracer.startSpan(
      //TODO use @opentelemetry/instrumentation-document-load AttributeNames.RESOURCE_FETCH ?,
      // AttributeNames not exported currently
      'resourceFetch',
      {
        startTime: hrTime(entry.fetchStart),
      },
      this.urlToContextMap[targetUrl.toString()]
    );
    span.setAttribute('component', MODULE_NAME);
    span.setAttribute(SemanticAttributes.HTTP_URL, entry.name);

    addSpanNetworkEvents(span, entry);
    //TODO look for server-timings? captureTraceParentFromPerformanceEntries(entry)
    const resEnd = entry['responseEnd'];
    if (resEnd && resEnd > 0) {
      span.end(resEnd);
    } else {
      span.end();
    }
  }
}