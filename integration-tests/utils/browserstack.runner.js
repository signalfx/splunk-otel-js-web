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
const { clearBuildId, generateBuildId } = require('./buildApi');
const path = require('path');

let browserstackLocal;

function createTunnel() {
  return new Promise((resolve, reject) => {
    Nightwatch.browserstackLocal = browserstackLocal = new browserstack.Local();

    const key = process.env.BROWSERSTACK_KEY;
    if (!key) {
      throw new Error('You need to provide environment variable: BROWSERSTACK_KEY.');
    }

    browserstackLocal.start({ key }, function(error) {
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
  let buildId;
  try {
    buildId = generateBuildId();
    console.log(`Starting build ${buildId}`);

    console.log('Starting tunnel.');
    const tunnelHandle = await createTunnel();
    console.log('Tunnel started.');

    // TODO: restructure so that we don't have to rely on a path to the config file
    const configPath = path.join(__dirname, 'browserstack.conf.js'); 
    console.log(`Loading config from ${configPath}`);

    const envs = ['chrome', 'safari', 'edge', 'firefox'];
    const reporters = [];
    for (const env of envs) {
      const runner = new Nightwatch.CliRunner({
        config: configPath, 
        env, 

        // note: this can be used to scope down tests, leaving here so I don't need to search for this in the future
        // test: path.join(__dirname, '..', 'tests', 'websocket', 'websockets.spec.js')
      });
      runner.setup();
      await runner.runTests();

      reporters.push(runner.testRunner);
    }

    if (reporters.some(r => r.hasTestFailures)) {
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
    clearBuildId();
    console.log(`Finished build ${buildId}`);
  }
}());
