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

import SplunkOtelWeb from '@splunk/otel-web';

SplunkOtelWeb.init({
  // These fields get filled out from .env file by bundler
  beaconUrl: process.env.REACT_APP_RUM_BEACON_URL,
  rumAuth: process.env.REACT_APP_RUM_TOKEN,
  app: 'RUM Todo Example Frontend',
  // Ignore 30s ping
  ignoreUrls: [/\/ping/],
  // Redact ID from url
  exporter: {
    onAttributesSerializing: (attributes) => ({
      ...attributes,
      'http.url': typeof attributes['http.url'] === 'string'
        ? attributes['http.url'].replace(/(\/items\/)\d+(\/?)/, '$1<id>$2')
        : attributes['http.url'],
    }),
  },
});
