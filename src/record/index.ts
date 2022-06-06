/*
Copyright 2022 Splunk Inc.

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

import { ProxyTracerProvider, trace } from '@opentelemetry/api';
import { record } from 'rrweb';
import OTLPLogExporter from './OTLPLogExporter';
import { BatchLogProcessor, convert } from './BatchLogProcessor';
import { BasicTracerProvider } from '@opentelemetry/sdk-trace-base/build/src/BasicTracerProvider';

type RRWebOptions = Parameters<typeof record>[0];

export type SplunkRumRecorderConfig = RRWebOptions & {
  /** Destination for the captured data */
  beaconUrl?: string;

  /** Temporary! Auth token */
  apiToken?: string;
};

const MAX_RECORDING_LENGTH = 5 * 60 * 1000;

let inited: (() => void) | false = false;
let startTime = 0;
let capturing = false;

const SplunkRumRecorder = {
  get inited(): boolean {
    return Boolean(inited);
  },

  init(config: SplunkRumRecorderConfig): void {
    if (inited) {
      return;
    }

    let tracerProvider: BasicTracerProvider | ProxyTracerProvider = trace.getTracerProvider() as BasicTracerProvider;
    if (tracerProvider && 'getDelegate' in tracerProvider) {
      tracerProvider = (tracerProvider as ProxyTracerProvider).getDelegate() as BasicTracerProvider;
    }
    if (!(tracerProvider?.resource)) {
      console.error('Splunk OTEL Web must be inited before recorder.');
      return;
    }

    const resource = tracerProvider.resource;

    const { beaconUrl, ...rrwebConf } = config;

    const headers = {};
    if (config.apiToken) {
      headers['X-SF-Token'] = config.apiToken;
    }

    const exporter = new OTLPLogExporter({ beaconUrl, headers, resource });
    const processor = new BatchLogProcessor(exporter, {});

    startTime = Date.now();
    capturing = true;

    inited = record({
      maskAllInputs: true,
      maskTextSelector: '*',
      ...rrwebConf,
      emit(event) {
        if (!capturing) {
          return;
        }

        if (event.timestamp > startTime + MAX_RECORDING_LENGTH) {
          capturing = false;

          return;
        }

        processor.onLog(convert(event));
      },
    });
  },
  resume(): void {
    if (!inited) {
      return;
    }

    const oldCapturing = capturing;
    startTime = Date.now();
    capturing = true;
    if (!oldCapturing) {
      record.takeFullSnapshot();
    }
  },
  stop(): void {
    capturing = false;
  },
  deinit(): void {
    if (!inited) {
      return;
    }

    inited();
    inited = false;
  },
};

export default SplunkRumRecorder;
