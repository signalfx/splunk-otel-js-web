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


import 'mocha';

// Manually maintain this list, as old webpack require-based mechanism isn't working under rollup
import './init.test.js';
import './patchchecks.test.js';
import './servertiming.test.js';
import './utils.test.js';
import './session.test.js';
import './websockets.test.js';
import './SplunkExporter.test';
