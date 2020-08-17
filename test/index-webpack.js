// This file is the webpack entry point for the browser Karma tests. It requires
// all modules ending in "test" from the current folder and all its subfolders.
// eslint-disable-next-line no-unused-vars
import * as assert from 'assert';
// eslint-disable-next-line no-unused-vars
import * as mocha from 'mocha';

import './init.test.js';
import './patchchecks.test.js';
import './servertiming.test.js';
import './utils.test.js';
