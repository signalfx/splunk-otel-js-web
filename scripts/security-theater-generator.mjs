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

import { readFile, writeFile } from 'node:fs/promises';
import MagicString from 'magic-string';

const source = await readFile('packages/web/dist/artifacts/splunk-otel-web.js', { encoding: 'utf-8' });

const string = new MagicString(source);
string.replaceAll('Math.random()', '(crypto.getRandomValues(new Uint32Array(1))[0]/4294967295)');

writeFile('packages/web/dist/artifacts/splunk-otel-web-security-theater-edition.js', string.toString());
// future (rollup plugin?) - can we do something with sourcemap from string.generateMap?
