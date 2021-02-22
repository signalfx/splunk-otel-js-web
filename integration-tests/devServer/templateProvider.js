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

const path = require('path');
const fs = require('fs');
const packageConfig = require('../../package.json');

const INJECT_TEMPLATE = `<script src="<%= file -%>"></script>
  <script>
    <%if (noInit) { %>
      window.SplunkRumOptions = <%- options -%>
    <% } else { %>  
      window.SplunkRum && window.SplunkRum.init(<%- options -%>)
    <% } %> 
  </script>
`;

exports.registerTemplateProvider = ({app, addHeaders, enableHttps, render}) => {
  app.use(function(req, res, next) {  
    const filepath = path.resolve(__dirname, '../tests', req.path.substring(1));
    if (fs.existsSync(filepath)) {
      const beaconUrl = new URL(`${enableHttps ? 'https' : 'http'}://${req.headers.host}/api/v2/spans`);
      if (req.query.beaconPort) {
        beaconUrl.port = req.query.beaconPort;
      }

      addHeaders(res);
      return res.render(filepath, {
        renderAgent(userOpts = {}, noInit = false, file = '/dist/splunk-rum.js', cdn = false) {
          const options = {
            beaconUrl: beaconUrl.toString(),
            app: 'splunk-otel-js-dummy-app',
            debug: true,
            bufferTimeout: require('../utils/globals').GLOBAL_TEST_BUFFER_TIMEOUT,
            ...userOpts
          };

          if (cdn) {
            options.file = `https://cdn.signalfx.com/o11y-gdi-rum/v${packageConfig.version}/splunk-rum.js`;
          }

          return render(INJECT_TEMPLATE, {
            file,
            noInit,
            options: JSON.stringify(options)
          });
        },
      });
    } 
    return next();
  });
};
