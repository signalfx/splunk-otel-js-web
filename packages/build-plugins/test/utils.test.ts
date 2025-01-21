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
import { computeSourceMapId, computeSourceMapIdFromFile, getCodeSnippet, getSourceMapUploadUrl } from '../src/utils';

describe('getCodeSnippet', function () {
  it('inserts the source map id into the snippet', function () {
    const code = getCodeSnippet('testid123');
    expect(code).contains('window.sourceMapIds[s] = \'testid123\'');
  });

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
  it('returns a consistent id in GUID format', function () {
    const id = computeSourceMapId('console.log("Hello world")');

    expect(id).eq('d77ec5d8-4fb5-fbc8-1897-54b54e939bcd');
    expect(id).eq(computeSourceMapId('console.log("Hello world")'));
    expect(id).not.eq(computeSourceMapId('console.log("a different snippet gets a different id");'));
  });
});

describe('computeSourceMapIdFromFilePath', function () {
  it('returns an id in GUID format', async function () {
    const id = await computeSourceMapIdFromFile('package.json');
    expect(id).matches(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/);
  });
});

describe('getSourceMapUploadUrl', function () {
  it('uses the proper API based on the realm and id', function () {
    const url = getSourceMapUploadUrl('us0', 'd77ec5d8-4fb5-fbc8-1897-54b54e939bcd');
    expect(url).eq('https://api.us0.signalfx.com/v1/sourcemaps/id/d77ec5d8-4fb5-fbc8-1897-54b54e939bcd');
  });
});
