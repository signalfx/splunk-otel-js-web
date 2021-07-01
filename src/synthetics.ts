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

import { Context, propagation, Baggage, SpanAttributes } from '@opentelemetry/api';

declare global {
  interface Window {
    syntheticsRunId?: string;
  }
}

const SyntheticRunIdRegex = /^[0-9a-z]{32}$/;

export function isValidSyntheticsRunId(value: unknown): boolean {
  if (typeof value !== 'string') {
    return false;
  }

  if (!SyntheticRunIdRegex.test(value)) {
    return false;
  }

  return true;
}

export const SYNTHETIC_RUN_ID_FIELD = 'Synthetics-RunId';

export function injectSyntheticsBaggageFromWindow(context: Context): Context {
  const syntheticsRunId = window.syntheticsRunId;
  if (!isValidSyntheticsRunId(syntheticsRunId)) {
    return context;
  }

  const baggage = propagation.getBaggage(context) || propagation.createBaggage();
  const baggageWithSynthetics = baggage.setEntry(SYNTHETIC_RUN_ID_FIELD, { value: syntheticsRunId });

  return propagation.setBaggage(context, baggageWithSynthetics);
}

export function extractSyntheticsBaggageFromWindow(): Baggage | null {
  const value = window.syntheticsRunId;

  if (!isValidSyntheticsRunId(value)) {
    return null;
  }

  return propagation.createBaggage({
    [SYNTHETIC_RUN_ID_FIELD]: { value },
  });
}

export function extractSyntheticsAttributesFromContext(context: Context): SpanAttributes {
  const syntheticsRunId = propagation.getBaggage(context)?.getEntry(SYNTHETIC_RUN_ID_FIELD).value;

  if (!isValidSyntheticsRunId(syntheticsRunId)) {
    return {};
  }

  return {
    [SYNTHETIC_RUN_ID_FIELD]: syntheticsRunId,
  };
}
