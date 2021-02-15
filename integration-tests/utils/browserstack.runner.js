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

require('dotenv').config();

const Nightwatch = require('nightwatch');
const browserstack = require('browserstack-local');
const { generateBuildId } = require('./buildApi');


function generateHex(length) {
  return [...Array(length).keys()].map(() => parseInt(Math.random() * 16).toString(16)).join('');
}

let browserstackLocal;
function createTunnel({localIdentifier}) {
  return new Promise((resolve, reject) => {
    Nightwatch.browserstackLocal = browserstackLocal = new browserstack.Local();

    const key = process.env.BROWSERSTACK_KEY;
    if (!key) {
      throw new Error('You need to provide environment variable: BROWSERSTACK_KEY.');
    }

    browserstackLocal.start({ 
      key,
      verbose: true,
      localIdentifier,
    }, function(error) {
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

async function runTests(argv) {
  const buildId = generateBuildId();
  try {
    console.log(`Starting build ${buildId}`);

    console.log('Starting tunnel.');
    const localIdentifier = generateHex(32);
    const tunnelHandle = await createTunnel({localIdentifier});
    console.log('Tunnel started.');

    const finalArgs = {
      ...argv,
      ...argv.env === 'safari-10.1' ? {'tag': 'safari-10.1'} : {}
      // note: this can be used to scope down tests, leaving here so I don't need to search for this in the future
      // test: path.join(__dirname, '..', 'tests', 'websocket', 'websockets.spec.js')
    };
    const runner = new Nightwatch.CliRunner(finalArgs);
    runner.setup({
      desiredCapabilities: {
        'browserstack.localIdentifier': localIdentifier,
        build: generateBuildId(),
      },
    });
    await runner.runTests();

    if (runner.testRunner.hasTestFailures) {
      console.warn('Tests failed.');
      process.exitCode = 1;
    } else {
      console.log('Tests finished.');
    }

    await tunnelHandle.close();
  } catch(e) {
    console.log('There was an error while starting the test runner:\n\n');
    process.stderr.write(e.stack + '\n');
    process.exit(2);
  } finally {
    console.log(`Finished build ${buildId}`);
  }
}

Nightwatch.cli(runTests);
