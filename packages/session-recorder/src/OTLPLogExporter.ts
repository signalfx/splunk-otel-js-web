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

import { gzipSync, strToU8 } from 'fflate';
import type { JsonArray, JsonObject, JsonValue } from 'type-fest';

import { IAnyValue, Log } from './types';
import { VERSION } from './version.js';

interface OTLPLogExporterConfig {
  headers?: Record<string, string>;
  beaconUrl: string;
  getResourceAttributes: () => JsonObject;
  debug?: boolean;
}

const defaultHeaders = {
  'Content-Type': 'application/json',
  'Content-Encoding': 'gzip'
};

function isArray(value: JsonValue): value is JsonArray {
  return Array.isArray(value);
}

function isObject(value: JsonValue): value is JsonObject {
  return !!value && typeof value === 'object' && !isArray(value);
}

function convertToAnyValue(value: JsonValue): IAnyValue {
  if (isObject(value)) {
    return {
      kvlistValue: {
        values: Object.entries(value).map(([key, value]) => ({
          key,
          value: convertToAnyValue(value),
        }))
      }
    };
  }

  if (isArray(value)) {
    return {
      arrayValue: {
        values: value.map(value => convertToAnyValue(value)),
      }
    };
  }

  if (typeof value === 'string') {
    return {
      stringValue: value
    };
  }

  if (typeof value === 'number') {
    return {
      doubleValue: value
    };
  }

  if (typeof value === 'boolean') {
    return {
      boolValue: value
    };
  }

  // never
  return {};
}

export default class OTLPLogExporter {
  config: OTLPLogExporterConfig;

  constructor(config: OTLPLogExporterConfig) {
    this.config = config;
  }

  constructLogData(logs: Log[]): JsonObject {
    return {
      resourceLogs: [{
        resource: {
          attributes: convertToAnyValue(this.config.getResourceAttributes() || {}).kvlistValue!.values as JsonArray,
        },
        scopeLogs: [{
          scope: { name: 'splunk.rr-web', version: VERSION },
          logRecords: logs.map(log => ({
            body: convertToAnyValue(log.body!) as JsonObject,
            timeUnixNano: log.timeUnixNano,
            attributes: convertToAnyValue(log.attributes || {}).kvlistValue!.values as JsonArray,
          }))
        }]
      }],
    };
  }

  export(logs: Log[]): void {
    if (logs.length === 0) {
      return;
    }

    const headers = this.config.headers
      ? Object.assign({}, defaultHeaders, this.config.headers)
      : defaultHeaders;

    const logsData = this.constructLogData(logs);
    if (this.config.debug) {
      console.log('otlp request', logsData);
    }

    const compressed = gzipSync(strToU8(JSON.stringify(logsData)));

    fetch(this.config.beaconUrl, {
      method: 'POST',
      body: compressed,
      headers: headers,
    }).catch(() => {
      // TODO remove this once we have ingest with correct cors headers
    });
  }
}
