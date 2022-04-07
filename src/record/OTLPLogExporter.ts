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

import { JsonArray, JsonObject, JsonValue } from 'type-fest';
import * as proto from './LogsProto.js';

import { Log } from './types';

interface OTLPLogExporterConfig {
  headers?: Record<string, string>;
  beaconUrl: string;
}

const defaultHeaders = {
  'Content-Type': 'application/x-protobuf',
};

const { LogsData } = proto.opentelemetry.proto.logs.v1;

function isObject(value: JsonValue): value is JsonObject {
  return typeof value === 'object';
}

function isArray(value: JsonValue): value is JsonArray {
  return Array.isArray(value);
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
          attributes: [
            { key: 'telemetry.sdk.name', value: { stringValue: 'webjs' } },
          ]
        },
        scopeLogs: [{
          scope: { name: 'webjs.replay', version: '0.0.1' },
          logRecords: logs.map(log => ({
            body: convertToAnyValue(log.body),
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
    const buffer = LogsData.encode(logsData).finish();

    const updatedHeaders = this.config.headers
      ? Object.assign({}, defaultHeaders, this.config.headers)
      : defaultHeaders;

    fetch(this.config.beaconUrl, {
      method: 'POST',
      body: buffer,
      headers: updatedHeaders,
    });
  }
}
