#!/usr/bin/env node
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


// require.main.filename = './node_modules/.bin/nightwatch';
require.main.filename = './node_modules/nightwatch/bin/nightwatch';
// note: shebang and process filename attribution are necessarry
// otherwise nightwatch doesn't understand that we're the test runner

require('dotenv').config();

const Nightwatch = require('nightwatch');
const browserstack = require('browserstack-local');

let browserstackLocal;

function createTunnel() {
  return new Promise((resolve, reject) => {
    Nightwatch.browserstackLocal = browserstackLocal = new browserstack.Local();

    if (!process.env.BROWSERSTACK_KEY) {
      throw new Error('You need to provide environment variable: BROWSERSTACK_KEY.');
    }
    browserstackLocal.start({'key': process.env.BROWSERSTACK_KEY }, function(error) {
      if (error) {
        reject(error);
      } else {
        resolve({
          close: () => new Promise(r => browserstackLocal.stop(r)),
        });
      }
    });
  });
}

(async function() {
  try {
    console.log('Starting tunnel.');
    const tunnelHandle = await createTunnel();
    console.log('Tunnel started.');

    // TODO: restructure so that we don't have to rely on a path to the config file
    await Nightwatch.runTests(
      {
        'env': 'chrome,safari,edge',
        'config': './integration-tests/utils/browserstack.conf.js',
      },
      {},
    );
    console.log('Tests finished.');

    await tunnelHandle.close();
  } catch(e) {
    console.log('There was an error while starting the test runner:\n\n');
    process.stderr.write(e.stack + '\n');
    process.exit(2);
  }
}());
