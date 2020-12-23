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

function generateHex(length) {
  return [...Array(length).keys()].map(() => parseInt(Math.random() * 16).toString(16)).join('');
}

function generateServerTiming() {
  const traceId = generateHex(32);
  const spanId = generateHex(16);
  const formatted = `traceparent;desc="00-${traceId}-${spanId}-01"`;
  return {
    traceId,
    spanId,
    header: formatted,
  };
}

function setServerTimingHeader(responseObject, serverTiming = generateServerTiming()) {
  responseObject.set('Server-Timing', serverTiming.header);
}

module.exports = {
  generateServerTiming,
  setServerTimingHeader,
};
