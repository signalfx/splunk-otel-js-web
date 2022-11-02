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

const { URL } = require('url');
const lighthouse = require('lighthouse');
const chromeLauncher = require('chrome-launcher');
const { run: runDevServer, getRumScript } = require('./devServer/devServer');
const { run: runInjectingProxy } = require('./injectingProxy/server');

const DEFAULT_OPTIONS = {
  rumScriptPosition: 'head',
  proxyUrl: null,
  debug: false,
  beaconPort: 3100,

  disableInjection: false,
  disableProxy: false,

  // RUM script will be injected and initiated right before the first instance of
  // the string in the property below
  // only used if disableInjection is not disabled
  matchingInjectionPrefix: '<script',
};

async function run(options) {
  options = Object.assign({}, DEFAULT_OPTIONS, options);

  const {
    beaconHost,
    beaconPort,
    disableInjection,
  } = options;

  const injectingProxy = await runInjectingProxy({
    matchingInjectionPrefix: options.matchingInjectionPrefix,
    contentToInject: getRumScript({ beaconHost, beaconPort }),
    disableInjection,
  });

  const chrome = await chromeLauncher.launch({
    chromeFlags: [
      options.debug ? '--headless' : '',
      '--ignore-certificate-errors',
      options.disableProxy ? '' : `--proxy-server=http://localhost:${injectingProxy.port}`,
    ],
  });

  const lighthouseOpts = {
    logLevel: 'error',
    output: 'json',
    onlyCategories: ['performance'],
    port: chrome.port,
    throttling: {
      rttMs: 100,
      throughputKbps: 1000,
      cpuSlowdownMultiplier: 2,
    },
  };

  console.log('Profiling', options.url.toString());
  const runnerResult = await lighthouse(options.url.toString(), lighthouseOpts);

  const report = JSON.parse(runnerResult.report);
  console.log('\tFCP', report.audits['first-contentful-paint'].displayValue);
  console.log('\tFirst CPU Idle', report.audits['first-cpu-idle'].displayValue);
  console.log('\tTBT', report.audits['total-blocking-time'].displayValue);
  console.log('\tEstimated FID', report.audits['estimated-input-latency'].displayValue);
  console.log('\tFirst paint', report.audits['first-meaningful-paint'].displayValue);

  const bootupAudit = report.audits['bootup-time'];
  if (bootupAudit) {
    console.log('\tJS bootup time', bootupAudit.numericValue.toFixed(2) + ' ms');
  }

  // TODO: extract unit from the `headings` field
  const mainthreadAudit = runnerResult.lhr.audits['mainthread-work-breakdown'];
  if (mainthreadAudit) {
    const scriptParseCompileAudit = mainthreadAudit.details.items.find(item => item.group === 'scriptParseCompile');
    if (scriptParseCompileAudit) {
      console.log('\tScript compilation', scriptParseCompileAudit.duration.toFixed(2) + 'ms');
    }

    const scriptEvaluationAudit = mainthreadAudit.details.items.find(item => item.group === 'scriptEvaluation');
    if (scriptEvaluationAudit) {
      console.log('\tScript evaluation', scriptEvaluationAudit.duration.toFixed(2) + 'ms');
    }
  }

  const renderBlockingAudit = report.audits['render-blocking-resources'];
  if (renderBlockingAudit.numericValue > 0) {
    console.log('\tRender blocking', renderBlockingAudit.displayValue);
    if (renderBlockingAudit.details && renderBlockingAudit.details.items) {
      renderBlockingAudit.details.items.forEach(item => {
        console.log(`\t\t${item.url} wasted ${item.wastedMs} ms.`);
      });
    }
  } else {
    console.log('\tNo render blocking occurred.');
  }

  await chrome.kill();
  await injectingProxy.close();
}

(async function () {
  const beacon = await runDevServer({
    enableHttps: true,
    onSpanReceived: (span) => {},
  });

  const artificialBaseUrl = new URL(`https://localhost:${beacon.port}`);
  console.log('Splunk RUM sync in head (artificial)');
  await run({
    url: artificialBaseUrl,
    disableProxy: true,
    beaconPort: beacon.port,
  });
  
  console.log('Splunk RUM sync before app (artificial)');
  await run({
    url: new URL('/?rumBottom=true', artificialBaseUrl),
    disableProxy: true,
    beaconPort: beacon.port,
  });

  console.log('No splunk RUM (artificial)');
  await run({
    url: new URL('/?rumHead=false', artificialBaseUrl),
    disableProxy: true,
    beaconPort: beacon.port,
  });

  const githubUrl = new URL(`https://github.com`);
  console.log('Splunk RUM injected in github.com (HEAD)');
  await run({
    url: githubUrl,
    beaconPort: beacon.port,
  });

  console.log('Splunk RUM not injected in github.com (HEAD)');
  await run({
    url: githubUrl,
    beaconPort: beacon.port,
    disableInjection: true,
  });

  await beacon.close();
})();
