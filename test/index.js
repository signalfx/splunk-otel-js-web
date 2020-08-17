// This file is the entry for the browser Karma tests.

// eslint-disable-next-line no-unused-vars
import * as assert from 'assert';
// eslint-disable-next-line no-unused-vars
import * as mocha from 'mocha';

// Manually maintain this list, as old webpack require-based mechanism isn't working under rollup
import './init.test.js';
import './patchchecks.test.js';
import './servertiming.test.js';
import './utils.test.js';
