/* eslint-disable no-use-before-define */
const fs = require('fs');
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const https = require('https');
const http = require('http');
const WebSocket = require('ws');
const {render, renderFile} = require('ejs');

const INJECT_TEMPLATE = `<script src="<%= file -%>"></script>
  <script>
    window.SplunkRum && window.SplunkRum.init(<%- options -%>)
  </script>
`;

exports.run = async function run({onSpanReceived, enableHttps}) {
  enableHttps = enableHttps || false;
  let lastServerTiming;
  function addHeaders(res) {
    lastServerTiming = generateServerTiming();
    res.set('Access-Control-Expose-Headers', 'Server-Timing');
    res.set('Server-Timing', lastServerTiming.header);
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
    const filepath = path.resolve(__dirname, '../tests', req.path.substring(1));
    if (fs.existsSync(filepath)) {
      const host = `${enableHttps ? 'https' : 'http'}://${req.headers.host}`;
      addHeaders(res);
      return res.render(filepath, {
        renderAgent(userOpts = {}, file = '/dist/splunk-rum.js') {
          const options = {
            beaconUrl: `${host}/api/v2/spans`, 
            app: 'splunk-otel-js-dummy-app',
            debug: true,
            ...userOpts
          };  
    
          return render(INJECT_TEMPLATE, {
            file,
            options: JSON.stringify(options)
          });
        },
      });
    } 
    return next();
  });
  app.use(express.static(path.join(__dirname, '../../')));

  app.post('/*', (req, res) => {
    getSpans(req.body).forEach(onSpanReceived);
    res.send('');
  });

  app.get('/some-data', (req, res) => {
    attachServerTiming(res);
    res.send({
      key1: 'value1',
      key2: 'value2',
      key3: 'value3',
    });
  });

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
    ws.on('message', function incoming(message) {
      console.log('received: %s', message);
      ws.send(message);
    });
  
    ws.send('connected');
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

function startHttpServer({ enableHttps, listener }) {
  const { server, serverOptions } = buildServer({ enableHttps, listener });
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
    server.listen(56613, '127.0.0.1');
  });
}

function startWebsocketServer({ enableHttps, listener }) {
  const { server, serverOptions } = buildServer({ enableHttps, listener });
  return new Promise((resolve, reject) => {
    const websocketServer = new WebSocket.Server({ server });    
    
    server.on('listening', () => {
      console.info('Listening now at: ', server.address());
      resolve({
        close: buildPromisifiedClose(server),
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

function buildServer({ enableHttps, listener }) {
  const serverOptions = {
    hostname: 'localhost',
    key: fs.readFileSync(path.join(__dirname, 'certs', 'server.key'), 'utf8'),
    cert: fs.readFileSync(path.join(__dirname, 'certs', 'server.cert'), 'utf8'),
  };

  const server = (enableHttps ? https : http).createServer(serverOptions, listener);
  return { server, serverOptions };
}

function attachServerTiming(res) {
  res.set('Server-Timing', generateServerTiming().header);
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

function generateHex(length) {
  return [...Array(length).keys()].map(() => parseInt(Math.random() * 16).toString(16)).join('');
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

function getSpans(spanOrSpans) {
  if (Array.isArray(spanOrSpans)) {
    return spanOrSpans.flatMap(getSpans);
  }

  return [{
    name: spanOrSpans.name,
    tags: spanOrSpans.tags,
  }];
}
