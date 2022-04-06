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

import { record } from "rrweb";
import OTLPLogExporter from "./OTLPLogExporter";
import { BatchLogProcessor, convert } from "./BatchLogProcessor";

type RRWebOptions = Parameters<typeof record>[0];

export type SplunkRumRecorderConfig = RRWebOptions & {
  /** Destination for the captured data */
  beaconUrl?: string;

  /** Temporary! Auth token */
  apiToken?: string;
};

let inited: (() => void) | false = false;

const SplunkRumRecorder = {
  get inited(): boolean {
    return Boolean(inited);
  },

  init(config: SplunkRumRecorderConfig): void {
    if (inited) {
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { beaconUrl, ...rrwebConf } = config;

    const exporter = new OTLPLogExporter({ beaconUrl });
    const processor = new BatchLogProcessor(exporter, {});

    inited = record({
      ...rrwebConf,
      emit(event) {
        console.log("Event from rrweb", event);
        processor.onLog(convert(event));
      },
    });
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
