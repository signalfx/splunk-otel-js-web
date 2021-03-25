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

const http = require('http');
const https = require('https');
const { getCertificateConfig } = require("../certs");

const HOST = 'localhost';

function buildBasicLocalServer({ enableHttps, listener }) {
  const serverOptions = {
    hostname: 'localhost',
    ...getCertificateConfig(),
  };

  const server = (enableHttps ? https : http).createServer(serverOptions, listener);
  return { server, serverOptions };
}

function buildPromisifiedClose(server) {
  return () => new Promise((resolve, reject) => {
    const address = server.address();
    server.close((err) => {
      if (err) {
        console.error(err);
        reject(err);
      } else {
        console.debug(`Closed server at port ${address.port}`);
        resolve();
      }
    });
  });
}

async function startLocalHttpServer({ enableHttps, listener, port }) {
  enableHttps = enableHttps === undefined ? true : enableHttps;
  
  const { server, serverOptions } = buildBasicLocalServer({ enableHttps, listener });
  return new Promise((resolve, reject) => {
    server.on('listening', () => {
      console.info('Listening now at: ', server.address());
      resolve({
        close: buildPromisifiedClose(server),
        address: server.address(),
        serverOptions,
      });
    });

    server.on('error', (e) => {
      console.error(e);
      reject(e);
    });

    // 0 acquires a random available port
    // 127.0.0.1 has been found to work with Circle CI and Browserstack well
    server.listen(port === undefined ? 0 : port, HOST);
  });
}

module.exports = {
  buildBasicLocalServer,
  startLocalHttpServer,
  buildPromisifiedClose,
};
