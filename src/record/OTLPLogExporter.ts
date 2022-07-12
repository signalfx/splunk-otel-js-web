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

import { Resource } from '@opentelemetry/resources';
import { gzipSync } from 'fflate';
import type { Root } from 'protobufjs';
import { JsonArray, JsonObject, JsonValue } from 'type-fest';

import * as proto from './LogsProto.js';
import { Log } from './types';
import { VERSION } from '../version.js';

interface OTLPLogExporterConfig {
  headers?: Record<string, string>;
  beaconUrl: string;
  resource: Resource;
  debug?: boolean;
}

const defaultHeaders = {
  'Content-Type': 'application/x-protobuf',
  'Content-Encoding': 'gzip',
  'X-Rum-Magic': '1'
};

const LogsData = (proto as unknown as {default: Root}).default.lookupType('opentelemetry.proto.logs.v1.LogsData') as unknown as typeof proto.opentelemetry.proto.logs.v1.LogsData;

function isArray(value: JsonValue): value is JsonArray {
  return Array.isArray(value);
}

function isObject(value: JsonValue): value is JsonObject {
  return !!value && typeof value === 'object' && !isArray(value);
}

function convertToAnyValue(value: JsonValue): proto.opentelemetry.proto.common.v1.IAnyValue {
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

  constructLogData(logs: Log[]): proto.opentelemetry.proto.logs.v1.ILogsData {
    return {
      resourceLogs: [{
        resource: {
          attributes: convertToAnyValue(this.config.resource?.attributes || {}).kvlistValue.values,
        },
        scopeLogs: [{
          scope: { name: 'splunk.rr-web', version: VERSION },
          logRecords: logs.map(log => ({
            body: convertToAnyValue(log.body),
            timeUnixNano: log.timeUnixNano,
            attributes: convertToAnyValue(log.attributes || {}).kvlistValue.values,
          }))
        }]
      }],
    };
  }

  export(logs: Log[]): void {
    if (logs.length === 0) {
      return;
    }

    const logsData = this.constructLogData(logs);
    if (this.config.debug) {
      console.log('otlp request', logsData);
    }
    const buffer = LogsData.encode(logsData).finish();
    const compressed = gzipSync(buffer);

    const updatedHeaders = this.config.headers
      ? Object.assign({}, defaultHeaders, this.config.headers)
      : defaultHeaders;

    fetch(this.config.beaconUrl, {
      method: 'POST',
      body: compressed,
      headers: updatedHeaders,
    });
  }
}
