/*
Copyright 2020 Splunk Inc.

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

import * as assert from 'assert';
import {PatchedZipkinExporter} from '../src/zipkin';

describe('zipkin exporter', () => {
  it('should rate limit', () => {
    const zipkin = new PatchedZipkinExporter();
    let exported = [];
    const origSendBeacon = navigator.sendBeacon;
    try {
      navigator.sendBeacon = function(url, data) {
        exported.push(JSON.parse(data));
      };
      const span = {attributes:{component: 'test'}};
      zipkin.export(new Array(101).fill(span));
      assert.strictEqual(100, exported.length);
      exported = [];
      zipkin.export(new Array(101).fill(span));
      assert.strictEqual(0, exported.length);
    } finally {
      navigator.sendBeacon = origSendBeacon;
    }
  });
});
