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

import { WebTracerProvider } from '@opentelemetry/web';
import { getRumSessionId } from './session';
import { version as SplunkRumVersion } from '../package.json';
import { propagation, context, trace } from '@opentelemetry/api';

export class SplunkWebTracerProvider extends WebTracerProvider {
  constructor(config) {
    super(config);

    this._app = config.app;
    this._instanceId = config.instanceId;
    this._globalAttributes = config.globalAttributes ?? {};
  }

  getTracer(name, version, config) {
    const tracer = super.getTracer(name, version, config);
    const origStartSpan = tracer.startSpan;

    const that = this;
    tracer.startSpan = function () {
      const span = origStartSpan.apply(tracer, arguments);
      span.setAttribute('location.href', location.href);
      // FIXME does otel want this stuff in Resource?
      span.setAttribute('splunk.rumSessionId', getRumSessionId());
      span.setAttribute('splunk.rumVersion', SplunkRumVersion);
      span.setAttribute('app', that._app);
      span.setAttribute('splunk.scriptInstance', that._instanceId);
      span.setAttributes(that._globalAttributes);
      return span;
    };
    return tracer;
  }

  setGlobalAttributes(attributes) {
    if (attributes) {
      Object.assign(this._globalAttributes, attributes);
    } else {
      this._globalAttributes = {}; 
    }
  }

  shutdown() {
    // TODO: upstream
    // note: BasicTracerProvider registers the propagator given to it in config
    // if the global propagator is the same as the one we registered, then we should deregister it
    propagation.disable();
    context.disable();
    trace.disable();
    super.shutdown();
  }
}
