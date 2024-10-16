/*
Copyright 2024 Splunk Inc.

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
import { computeSourceMapId, getCodeSnippet } from '../src/utils';

describe('getCodeSnippet', function () {
  it('does not throw error in a node environment', function () {
    const code = getCodeSnippet('testid123');
    // eslint-disable-next-line no-eval
    eval(code);
  });

  it('does not throw error when appended to code that does not end with semicolon or new line', function () {
    const code = 'let x = 5' + getCodeSnippet('testid123');
    // eslint-disable-next-line no-eval
    eval(code);
  });

});

describe('computeSourceMapId', function () {
  it('returns a consistent GUID result in base64', function () {
    const id = computeSourceMapId('console.log("Hello world")');

    expect(id).eq('d77ec5d8-4fb5-fbc8-1897-54b54e939bcd');
    expect(id).eq(computeSourceMapId('console.log("Hello world")'));
    expect(id).not.eq(computeSourceMapId('console.log("a different snippet gets a different id");'));
  });
});
