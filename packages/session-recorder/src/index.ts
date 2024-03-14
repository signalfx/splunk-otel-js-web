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

import { ProxyTracerProvider, TracerProvider, trace, Tracer } from '@opentelemetry/api';
import { record } from 'rrweb';
import OTLPLogExporter from './OTLPLogExporter';
import { BatchLogProcessor, convert } from './BatchLogProcessor';
import { VERSION } from './version';
import { getGlobal } from './utils';

import type { Resource } from '@opentelemetry/resources';
import type { SplunkOtelWebType } from '@splunk/otel-web';

interface BasicTracerProvider extends TracerProvider {
  readonly resource: Resource;
}

type RRWebOptions = Parameters<typeof record>[0];

export type SplunkRumRecorderConfig = RRWebOptions & {
  /** Destination for the captured data */
  beaconEndpoint?: string;

  /** Destination for the captured data 
   * @deprecated Use beaconEndpoint
   */
  beaconUrl?: string;

  /**
   * The name of your organization’s realm. Automatically configures beaconUrl with correct URL
   */
  realm?: string;

  /**
   * RUM authorization token for data sending. Please make sure this is a token
   * with only RUM scope as it's visible to every user of your app
   **/
  rumAccessToken?: string;

  /**
   * RUM authorization token for data sending. Please make sure this is a token
   * with only RUM scope as it's visible to every user of your app
   * @deprecated Renamed to `rumAccessToken`
   **/
  rumAuth?: string;

  /**
   * @deprecated Use RUM token in rumAccessToken
  */
  apiToken?: string;

  /** Debug mode */
  debug?: boolean;
};

function migrateConfigOption(config: SplunkRumRecorderConfig, from: keyof SplunkRumRecorderConfig, to: keyof SplunkRumRecorderConfig) {
  if (from in config && !(to in config)) {
    // @ts-expect-error There's no way to type this right
    config[to] = config[from];
  }
}

/**
 * Update configuration based on configuration option renames
 */
function migrateConfig(config: SplunkRumRecorderConfig) {
  migrateConfigOption(config, 'beaconUrl', 'beaconEndpoint');
  migrateConfigOption(config, 'rumAuth', 'rumAccessToken');
  return config;
}

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

    const SplunkRum = getGlobal<SplunkOtelWebType>('splunk.rum');

    let tracerProvider: BasicTracerProvider | ProxyTracerProvider = trace.getTracerProvider() as BasicTracerProvider;
    if (tracerProvider && 'getDelegate' in tracerProvider) {
      tracerProvider = (tracerProvider as unknown as ProxyTracerProvider).getDelegate() as BasicTracerProvider;
    }
    if (!SplunkRum || !SplunkRum.resource) {
      console.error('Splunk OTEL Web must be inited before session recorder.');
      return;
    }

    const resource = SplunkRum.resource;

    migrateConfig(config);

    const { apiToken, beaconEndpoint, debug, realm, rumAccessToken, ...rrwebConf } = config;
    tracer = trace.getTracer('splunk.rr-web', VERSION);
    const span = tracer.startSpan('record init');

    // Check if sampler is ignoring this
    if (!span.isRecording()) {
      return;
    }
    span.end();

    let exportUrl = beaconEndpoint;
    if (realm) {
      if (!exportUrl) {
        exportUrl = `https://rum-ingest.${realm}.signalfx.com/v1/rumreplay`;
      } else {
        console.warn('Splunk Session Recorder: Realm value ignored (beaconEndpoint has been specified)');
      }
    }

    if (!exportUrl) {
      console.error('Session recorder could not determine `exportUrl`, please ensure that `realm` or `beaconEndpoint` is specified and try again');
      return;
    }

    const headers = {};
    if (apiToken) {
      headers['X-SF-Token'] = apiToken;
    }

    if (rumAccessToken) {
      exportUrl += `?auth=${rumAccessToken}`;
    }

    const exporter = new OTLPLogExporter({
      beaconUrl: exportUrl,
      debug,
      headers, 
      getResourceAttributes() {
        return {
          ...resource.attributes,
          'splunk.rumSessionId': SplunkRum.getSessionId()!
        };
      }
    });
    const processor = new BatchLogProcessor(exporter, {});

    lastKnownSession = SplunkRum.getSessionId() as string;
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
        if (SplunkRum.getSessionId() !== lastKnownSession) {
          if (document.hidden) {
            return;
          }
          lastKnownSession = SplunkRum.getSessionId() as string;
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
