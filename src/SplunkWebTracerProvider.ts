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

import { WebTracerConfig, WebTracerProvider } from '@opentelemetry/web';
import { getRumSessionId } from './session';
import { version as SplunkRumVersion } from '../package.json';
import { propagation, context, trace, SpanAttributes } from '@opentelemetry/api';
import { Tracer } from '@opentelemetry/tracing';

export interface SplunkWebTracerProviderConfig extends WebTracerConfig {
  app: string;
  instanceId: string;
  globalAttributes: SpanAttributes;
}

export class SplunkWebTracerProvider extends WebTracerProvider {
  private readonly _app: string;
  private readonly _instanceId: string;
  private readonly _globalAttributes: SpanAttributes;

  constructor(config: SplunkWebTracerProviderConfig) {
    super(config);

    this._app = config.app;
    this._instanceId = config.instanceId;
    this._globalAttributes = config.globalAttributes ?? {};
  }

  getTracer(name: string, version?: string): Tracer {
    const tracer = super.getTracer(name, version);
    const origStartSpan = tracer.startSpan;

    // TODO: subclass Tracer to implement this
    tracer.startSpan = (...args) => {
      const span = origStartSpan.apply(tracer, args);
      span.setAttribute('location.href', location.href);
      // FIXME does otel want this stuff in Resource?
      span.setAttribute('splunk.rumSessionId', getRumSessionId());
      span.setAttribute('splunk.rumVersion', SplunkRumVersion);
      span.setAttribute('app', this._app);
      span.setAttribute('splunk.scriptInstance', this._instanceId);
      span.setAttributes(this._globalAttributes);
      return span;
    };
    return tracer;
  }

  setGlobalAttributes(attributes: SpanAttributes): void {
    if (attributes) {
      Object.assign(this._globalAttributes, attributes);
    } else {
      for (const key of Object.keys(this._globalAttributes)) {
        delete this._globalAttributes[key];
      }
    }
  }

  shutdown(): Promise<void> {
    return new Promise<void>((resolve) => {
      // TODO: upstream
      // note: BasicTracerProvider registers the propagator given to it in config
      // if the global propagator is the same as the one we registered, then we should deregister it
      propagation.disable();
      context.disable();
      trace.disable();
      resolve();
    }).then(() => super.shutdown());
  }
}
