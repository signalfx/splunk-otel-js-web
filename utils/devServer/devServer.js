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

const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const WebSocket = require('ws');
const { Server: SIOServer } = require('socket.io');
const { renderFile } = require('ejs');
const { buildBasicLocalServer } = require('../../utils/server');
const { 
  generateServerTiming,
  setServerTimingHeader,
} = require('../../utils/server/serverTiming');
const { registerTemplateProvider } = require('./templateProvider');

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

function startHttpServer({ enableHttps, listener, port }) {
  const { server, serverOptions, close } = buildServer({ enableHttps, listener });
  return new Promise((resolve, reject) => {
    server.on('listening', () => {
      console.info('Listening now at: ', server.address());
      resolve({
        close,
        address: server.address(),
        serverOptions,
        server,
      });
    });

    server.on('error', (e) => {
      console.error(e);
      reject(e);
    });

    // 0 acquires a random available port
    // 127.0.0.1 has been found to work with Circle CI and Browserstack well
    server.listen(port, '127.0.0.1');
  });
}

function startWebsocketServer({ enableHttps, listener, port }) {
  const { server, serverOptions, close } = buildServer({ enableHttps, listener });
  return new Promise((resolve, reject) => {
    const websocketServer = new WebSocket.Server({ server });    
    
    server.on('listening', () => {
      console.info('Listening now at: ', server.address());
      resolve({
        close,
        address: server.address(),
        serverOptions,
        server,
        websocketServer,
      });
    });

    server.on('error', (e) => {
      console.error(e);
      reject(e);
    });

    // 0 acquires a random available port
    // 127.0.0.1 has been found to work with Circle CI and Browserstack well
    server.listen(port, '127.0.0.1');
  });
}

function getSpans(spanOrSpans) {
  if (Array.isArray(spanOrSpans)) {
    return spanOrSpans.flatMap(getSpans);
  }

  return [{
    name: spanOrSpans.name,
    timestamp: spanOrSpans.timestamp,
    duration: spanOrSpans.duration,
    tags: spanOrSpans.tags,
    kind: spanOrSpans.kind,
    annotations: spanOrSpans.annotations,
    traceId: spanOrSpans.traceId,
    id: spanOrSpans.id,
    parentId: spanOrSpans.parentId,
  }];
}

exports.runIntegrationDevelopmentServer = async function run({
  onSpanReceived,
  enableHttps,
  httpPort: requestedHttpPort,
  websocketsPort: requestedWebsocketsPort,
}) {
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
  app.use(cors());

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

  registerTemplateProvider({ app, addHeaders, enableHttps });

  app.get('/utils/devServer/assets/no-cache.png', function(req, res) {
    res.sendFile(path.join(__dirname, './assets/no-cache.png'), {
      etag: false,
      lastModified: false,
      headers: {
        'Cache-Control': 'no-store, max-age=0'
      }
    });
  });
  app.use(express.static(path.join(__dirname, '../../')));

  app.post('/api/v2/spans', (req, res) => {
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

  app.post('/echo', (req, res) => {
    res.send(req.body);
  });

  app.get('/no-server-timings', (_, res) => { res.sendStatus(200); });

  const { 
    close: closeHttpServer, 
    address: { port: httpPort }, 
    server: httpServer,
    serverOptions: httpOptions,
  } = await startHttpServer({ enableHttps, listener: app, port: requestedHttpPort });
  app.set('httpPort', httpPort);

  const { 
    close: closeWebsocketServer, 
    address: { port: websocketsPort }, 
    serverOptions: wsOptions,
    websocketServer,
  } = await startWebsocketServer({ enableHttps, port: requestedWebsocketsPort });

  websocketServer.on('connection', function connection(ws) {
    console.log('websocket connected');
    ws.on('message', function incoming(message) {
      console.log('ws received: ', message);
      ws.send('success');
    });
  });

  const io = new SIOServer(httpServer);

  io.on('connection', function (socket) {
    console.log('socket.io connected', socket.id);
    socket.on('hello', () => {
      // Nothing
    });
    socket.on('ping', () => {
      socket.emit('pong');
    });
  });

  return {
    close: () => Promise.all([closeHttpServer(), closeWebsocketServer()]),
    httpHostname: httpOptions.hostname,
    httpPort,
    httpProtocol: enableHttps ? 'https' : 'http',
    websocketsHostname: wsOptions.hostname,
    websocketsPort,
    websocketsProtocol: enableHttps ? 'wss' : 'ws',
    getLastServerTiming: () => lastServerTiming,
  };
};
