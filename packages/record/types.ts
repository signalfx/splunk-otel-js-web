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

import { JsonObject, JsonValue } from 'type-fest';

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
