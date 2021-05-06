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

import { expect } from 'chai';
import { SplunkWebTracerProvider } from '../src';

describe('SplunkWebTracerProvider', () => {
  describe('setting global attribute', () => {
    it('should set attributes via constructor', () => {
      const provider = new SplunkWebTracerProvider({
        app: 'app-name',
        instanceId: 'instance-id',
        globalAttributes: {
          key1: 'value1',
        },
      });

      expect(provider._experimental_getGlobalAttributes()).to.deep.eq({
        key1: 'value1',
      });
    });

    it('should patch attributes via .setGlobalAttributes()', () => {
      const provider = new SplunkWebTracerProvider({
        app: 'app-name',
        instanceId: 'instance-id',
        globalAttributes: {
          key1: 'value1',
          key2: 'value2',
        },
      });

      provider.setGlobalAttributes({
        key2: 'value2-updaged',
        key3: 'value3',
      });

      expect(provider._experimental_getGlobalAttributes()).to.deep.eq({
        key1: 'value1',
        key2: 'value2-updaged',
        key3: 'value3',
      });
    });
  });
});
