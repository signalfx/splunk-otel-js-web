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

import { context, Context, propagation } from '@opentelemetry/api';
import { Span, BatchSpanProcessor } from '@opentelemetry/tracing';

export const SYNTHETIC_RUN_ID_FIELD = 'Synthetics-RunId';
const SyntheticRunIdRegex = /^[0-9a-z]{32}$/;

export class SplunkBatchSpanProcessor extends BatchSpanProcessor {
  onStart(_span: Span, parentContext: Context = context.active()): void {
    super.onStart(_span);

    const syntheticsId = propagation.getBaggage(parentContext)?.getEntry(
      SYNTHETIC_RUN_ID_FIELD
    )?.value;
    if (syntheticsId && SyntheticRunIdRegex.test(syntheticsId)) {
      _span.setAttribute(SYNTHETIC_RUN_ID_FIELD, syntheticsId);
    }
  }
}
