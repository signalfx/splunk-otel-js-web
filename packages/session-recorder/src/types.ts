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

import type { JsonObject, JsonValue } from 'type-fest';

export interface Log {
  body?: JsonValue;
  timeUnixNano: number;
  attributes?: JsonObject;
}

export interface LogExporter {
  export(
    spans: Log[]
    // resultCallback: (result: ExportResult) => void
  ): void;

  /** Stops the exporter. */
  // shutdown(): Promise<void>;
}

// OTLP Logs Interfaces
export interface IAnyValue {
  /** AnyValue stringValue */
  stringValue?: (string|null);

  /** AnyValue boolValue */
  boolValue?: (boolean|null);

  /** AnyValue intValue */
  intValue?: (number|null);

  /** AnyValue doubleValue */
  doubleValue?: (number|null);

  /** AnyValue arrayValue */
  // eslint-disable-next-line no-use-before-define
  arrayValue?: (IArrayValue|null);

  /** AnyValue kvlistValue */
  // eslint-disable-next-line no-use-before-define
  kvlistValue?: (IKeyValueList|null);

  /** AnyValue bytesValue */
  bytesValue?: (Uint8Array|null);
}

export interface IArrayValue {
  /** ArrayValue values */
  values?: (IAnyValue[]|null);
}

export interface IKeyValue {

  /** KeyValue key */
  key?: (string|null);

  /** KeyValue value */
  value?: (IAnyValue|null);
}

export interface IKeyValueList {

  /** KeyValueList values */
  values?: (IKeyValue[]|null);
}

