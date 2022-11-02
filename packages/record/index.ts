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

import { ProxyTracerProvider, trace, Tracer } from '@opentelemetry/api';
import { record } from 'rrweb';
import OTLPLogExporter from './OTLPLogExporter';
import { BatchLogProcessor, convert } from './BatchLogProcessor';
import { BasicTracerProvider } from '@opentelemetry/sdk-trace-base/build/src/BasicTracerProvider';
import { VERSION } from '../version';

type RRWebOptions = Parameters<typeof record>[0];

export type SplunkRumRecorderConfig = RRWebOptions & {
  /** Destination for the captured data */
  beaconUrl: string;

  /** Temporary! Auth token */
  apiToken?: string;

  /** Debug mode */
  debug?: boolean;
};

// Hard limit of 4 hours of maximum recording during one session
const MAX_RECORDING_LENGTH = ((4 * 60) + 1) * 60 * 1000;
const MAX_CHUNK_SIZE = 950 * 1024; // ~950KB
const encoder = new TextEncoder();
const decoder = new TextDecoder();

let inited: (() => void) | false | undefined = false;
let tracer: Tracer;
let lastKnownSession: string;
let sessionStartTime = 0;
let paused = false;
let eventCounter = 1;
let logCounter = 1;

const SplunkRumRecorder = {
  get inited(): boolean {
    return Boolean(inited);
  },

  init(config: SplunkRumRecorderConfig): void {
    if (inited) {
      return;
    }

    if (typeof window === 'undefined') {
      console.error('Session recorder can\'t be ran in non-browser environments');
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

    const { apiToken, beaconUrl, debug, ...rrwebConf } = config;
    tracer = trace.getTracer('splunk.rr-web', VERSION);
    const span = tracer.startSpan('record init');

    // Check if sampler is ignoring this
    if (!span.isRecording()) {
      return;
    }
    span.end();

    const headers = {};
    if (apiToken) {
      headers['X-SF-Token'] = apiToken;
    }

    const exporter = new OTLPLogExporter({ beaconUrl, debug, headers, resource });
    const processor = new BatchLogProcessor(exporter, {});

    lastKnownSession = resource.attributes['splunk.rumSessionId'] as string;
    sessionStartTime = Date.now();

    inited = record({
      maskAllInputs: true,
      maskTextSelector: '*',
      ...rrwebConf,
      emit(event) {
        if (paused) {
          return;
        }

        // Safeguards from our ingest getting DDOSed:
        // 1. A session can send up to 4 hours of data
        // 2. Recording resumes on session change if it isn't a background tab (session regenerated in an another tab)
        if (resource.attributes['splunk.rumSessionId'] !== lastKnownSession) {
          if (document.hidden) {
            return;
          }
          lastKnownSession = resource.attributes['splunk.rumSessionId'] as string;
          sessionStartTime = Date.now();
          // reset counters
          eventCounter = 1;
          logCounter = 1;
          record.takeFullSnapshot();
        }

        if (event.timestamp > sessionStartTime + MAX_RECORDING_LENGTH) {
          return;
        }

        const time = event.timestamp;
        const eventI = eventCounter++;
        // Research found that stringifying the rr-web event here is
        // more efficient for otlp + gzip exporting

        // Blob is unicode aware for size calculation (eg emoji.length = 1 vs blob.size() = 4)
        const body = encoder.encode(JSON.stringify(event));
        const totalC = Math.ceil(body.byteLength / MAX_CHUNK_SIZE);
        for (let i = 0; i < totalC; i++) {
          const start = i * MAX_CHUNK_SIZE;
          const end = (i + 1) * MAX_CHUNK_SIZE;
          const log = convert(
            decoder.decode(body.slice(start, end)),
            time,
            {
              'rr-web.offset': logCounter++,
              'rr-web.event': eventI,
              'rr-web.chunk': i + 1,
              'rr-web.total-chunks': totalC
            }
          );
          if (debug) {
            console.log(log);
          }
          processor.onLog(log);
        }
      },
    });
  },
  resume(): void {
    if (!inited) {
      return;
    }

    // TODO
    const oldPaused = paused;
    paused = false;
    if (!oldPaused) {
      record.takeFullSnapshot();
      tracer.startSpan('record resume').end();
    }
  },
  stop(): void {
    if (!inited) {
      return;
    }

    if (paused) {
      tracer.startSpan('record stop').end();
    }

    paused = true;
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
