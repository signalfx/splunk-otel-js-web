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

const fs = require('fs');
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const WebSocket = require('ws');
const {render, renderFile} = require('ejs');
const { buildBasicLocalServer } = require('../../test-utils/server');
const { 
  generateServerTiming,
  setServerTimingHeader,
} = require('../../test-utils/server/serverTiming');

const INJECT_TEMPLATE = `<script src="<%= file -%>"></script>
  <script>
    <%if (noInit) { %>
      window.SplunkRumOptions = <%- options -%>
    <% } else { %>  
      window.SplunkRum && window.SplunkRum.init(<%- options -%>)
    <% } %> 
  </script>
`;

function buildServer({ enableHttps, listener }) {
  const { server, serverOptions } = buildBasicLocalServer({ enableHttps, listener });

  const sockets = {};
  let nextSocketId = 0;
  server.on('connection', function (socket) {
    const socketId = nextSocketId++;
    sockets[socketId] = socket;
    socket.on('close', () => { delete sockets[socketId]; });
  });

  function close() {
    return new Promise((resolve, reject) => {
      for (const socketId in sockets) { sockets[socketId].destroy(); }

      const address = server.address();
      server.close((err) => {
        if (err) {
          console.error(`Unable to close server at port ${address.port}`, err);
          reject(err);
        } else {
          console.debug(`Closed server at port ${address.port}`);
          resolve();
        }
      });
    });
  }

  return { server, serverOptions, close };
}

function startHttpServer({ enableHttps, listener }) {
  const { server, serverOptions, close } = buildServer({ enableHttps, listener });
  return new Promise((resolve, reject) => {
    server.on('listening', () => {
      console.info('Listening now at: ', server.address());
      resolve({
        close,
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
    server.listen(0, '127.0.0.1');
  });
}

function startWebsocketServer({ enableHttps, listener }) {
  const { server, serverOptions, close } = buildServer({ enableHttps, listener });
  return new Promise((resolve, reject) => {
    const websocketServer = new WebSocket.Server({ server });    
    
    server.on('listening', () => {
      console.info('Listening now at: ', server.address());
      resolve({
        close,
        address: server.address(),
        serverOptions,
        websocketServer,
      });
    });

    server.on('error', (e) => {
      console.error(e);
      reject(e);
    });

    // 0 acquires a random available port
    // 127.0.0.1 has been found to work with Circle CI and Browserstack well
    server.listen(0, '127.0.0.1');
  });
}

function getSpans(spanOrSpans) {
  if (Array.isArray(spanOrSpans)) {
    return spanOrSpans.flatMap(getSpans);
  }

  return [{
    name: spanOrSpans.name,
    tags: spanOrSpans.tags,
    kind: spanOrSpans.kind,
    annotations: spanOrSpans.annotations,
    traceId: spanOrSpans.traceId,
    id: spanOrSpans.id,
    parentId: spanOrSpans.parentId,
  }];
}

exports.run = async function run({onSpanReceived, enableHttps}) {
  enableHttps = enableHttps || false;
  let lastServerTiming;
  function addHeaders(response) {
    lastServerTiming = generateServerTiming();
    setServerTimingHeader(response, lastServerTiming);
  }

  if (!onSpanReceived) {
    onSpanReceived = () => {};
  }

  const app = express();
  app.engine('html', renderFile);
  app.engine('ejs', renderFile);

  app.use(bodyParser.json({ type: 'text/plain' }));  
  app.use(bodyParser.json({ type: 'application/json' }));
  app.get('/', function(_, res) {
    addHeaders(res);
    return res.render(path.resolve(__dirname, 'index.html'));
  });
  app.get('/empty-page', (_, res) => { res.send('<html><head></head><body></body></html>'); });

  app.use(function(req, res, next) {
    if (req.query && req.query.t) {
      const timeout = parseInt(req.query.t);
      setTimeout(next, timeout);
    } else {
      next();
    }
  });

  app.use(function(req, res, next) {  
    const filepath = path.resolve(__dirname, '../tests', req.path.substring(1));
    if (fs.existsSync(filepath)) {
      const host = `${enableHttps ? 'https' : 'http'}://${req.headers.host}`;
      addHeaders(res);
      return res.render(filepath, {
        renderAgent(userOpts = {}, noInit = false, file = '/dist/splunk-rum.js') {
          const options = {
            beaconUrl: `${host}/api/v2/spans`,
            app: 'splunk-otel-js-dummy-app',
            debug: true,
            bufferTimeout: require('../utils/globals').GLOBAL_TEST_BUFFER_TIMEOUT,
            ...userOpts
          };
    
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

  app.get('/integration-tests/assets/no-cache.png', function(req, res) {
    res.sendFile(path.join(__dirname, '../assets/no-cache.png'), {
      etag: false,
      lastModified: false,
      headers: {
        'Cache-Control': 'no-store, max-age=0'
      }
    });
  });
  app.use(express.static(path.join(__dirname, '../../')));

  app.post('/*', (req, res) => {
    getSpans(req.body).forEach(onSpanReceived);
    res.send('');
  });

  app.get('/some-data', (req, response) => {
    setServerTimingHeader(response);
    response.send({
      key1: 'value1',
      key2: 'value2',
      key3: 'value3',
    });
  });

  app.get('/no-server-timings', (_, res) => { res.sendStatus(200); });

  const { 
    close: closeHttpServer, 
    address: { port: httpPort }, 
    serverOptions: httpOptions,
  } = await startHttpServer({ enableHttps, listener: app });

  const { 
    close: closeWebsocketServer, 
    address: { port: wsPort }, 
    serverOptions: wsOptions,
    websocketServer,
  } = await startWebsocketServer({ enableHttps });

  websocketServer.on('connection', function connection(ws) {
    console.log('websocket connected');
    ws.on('message', function incoming(message) {
      console.log('ws received: ', message);
      ws.send('success');
    });
  });

  console.log(`App accessible at: ${enableHttps ? 'https' : 'http'}://${httpOptions.hostname}:${httpPort}/`);
  console.log(`Websockets accessible at: ${enableHttps ? 'wss' : 'ws'}://${wsOptions.hostname}:${wsPort}/`);

  return {
    close: () => Promise.all([closeHttpServer(), closeWebsocketServer()]),
    port: httpPort,
    websocketsPort: wsPort,
    getLastServerTiming: () => lastServerTiming,
  };
};
