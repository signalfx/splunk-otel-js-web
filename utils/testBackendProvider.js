/*
Copyright 2021 Splunk Inc.

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

const { runIntegrationDevelopmentServer } = require('./devServer/devServer');

exports.buildInstrumentationBackend = async ({
  enableHttps,
  hostname,
  httpPort: requestedHttpPort,
  websocketsPort: requestedWebsocketsPort,
}) => {
  const spans = [];
  function handleSpanReceived(span) {
    spans.push(span);
  }

  const {
    close,
    httpProtocol,
    httpPort,
    websocketsProtocol,
    websocketsPort,
    getLastServerTiming,
  } = await runIntegrationDevelopmentServer({
    onSpanReceived: handleSpanReceived,
    enableHttps,
    httpPort: requestedHttpPort,
    websocketsPort: requestedWebsocketsPort,
  });

  const availableSearchParams = {
    wsProtocol: websocketsProtocol,
    wsPort: websocketsPort,
  };

  function getUrl (path = '/', includedParams = Object.keys(availableSearchParams), otherParams = {}) {
    const url = new URL(path, `${httpProtocol}://${hostname}:${httpPort}`);
    includedParams.forEach((name) => {
      url.searchParams.set(name, availableSearchParams[name]);
    });
    Object.entries(otherParams).forEach(([key, value]) => url.searchParams.set(key, value));
    return url;
  }

  function getWebsocketsUrl() {
    return new URL(`${websocketsProtocol}://${hostname}:${websocketsPort}`);
  }

  console.log(`Running integration tests server at: ${getUrl()}`);
  console.log(`Running integration tests websockets server at: ${getWebsocketsUrl()}`);

  return {
    clearReceivedSpans: () => { spans.length = 0; },
    close,
    getLastServerTiming,
    getReceivedSpans: () => { return spans; },
    getUrl,
    getWebsocketsUrl,
    httpPort,
    httpHostname: hostname,
  };
};
