#!/usr/bin/env node
require.main.filename = './node_modules/.bin/nightwatch';
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

    // const commitId = process.env.CIRCLE_SHA1 || 'local-commit';
    // const author = process.env.CIRCLE_PR_USERNAME || 'unknown';

    // TODO: restructure so that we don't have to rely on a path to the config file
    await Nightwatch.runTests(
      {
        'env': 'chrome,firefox,safari,edge,iphone,android',
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
