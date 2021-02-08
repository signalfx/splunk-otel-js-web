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
  InstrumentationBase,
} from '@opentelemetry/instrumentation';

import { version } from '../package.json';
import { hrTime, isUrlIgnored } from '@opentelemetry/core';
import { addSpanNetworkEvents } from '@opentelemetry/web';
import { HttpAttribute } from '@opentelemetry/semantic-conventions';

const MODULE_NAME = 'splunk-post-doc-load-resource';
const defaultAllowedInitiatorTypes = ['img', 'script']; //other, css, link
export class PostDocLoadResourceObserver extends InstrumentationBase {
  
  constructor(config = {}) {
    super(MODULE_NAME, version, Object.assign({}, {allowedInitiatorTypes: defaultAllowedInitiatorTypes}, config));
    this.observer = undefined;
    this.afterInit = false;
  }

  init() {}

  _startObserver() {
    this.observer = new PerformanceObserver( (list) => {
      list.getEntries().forEach( entry => {
        if (this._config.allowedInitiatorTypes.includes(entry.initiatorType)) {
          this._createSpan(entry);
        }
      });
    });
    this.observer.observe({type: 'resource', buffered: false});
  }

  _createSpan(entry) {
    if (isUrlIgnored(entry.name, this._config.ignoreUrls)) {
      return;
    }

    const span = this._tracer.startSpan(
      //TODO use @opentelemetry/plugin-document-load AttributeNames.RESOURCE_FETCH ?,
      // AttributeNames not exported currently
      'resourceFetch', 
      {
        startTime: hrTime(entry.fetchStart),
      }
    );
    span.setAttribute('component', MODULE_NAME);
    span.setAttribute(HttpAttribute.HTTP_URL, entry.name);

    addSpanNetworkEvents(span, entry);
    //TODO look for server-timings? captureTraceParentFromPerformanceEntries(entry)
    const resEnd = entry['responseEnd'];
    if (resEnd && resEnd > 0) {
      span.end(resEnd);
    } else {
      span.end();
    }
  }

  enable() {
    if (window.PerformanceObserver) {
      if (window.document.readyState === 'complete') {
        this._startObserver();
      } else {
        window.addEventListener('load', () => {
          this._startObserver();
        });
      }
    }
  }
  
  disable() {
    if (this.observer) {
      this.observer.disconnect();
    }
  }
}