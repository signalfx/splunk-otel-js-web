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
const WebSocket = require('ws');
const {renderFile} = require('ejs');
const {
  handleReactBundleRequest,
  generateReactBundleTags,
} = require('./reactBundleProvider');
const {
  handleSplunkRumRequest, generateSplunkRumTags,
} = require('./splunkRumProvider');
const compression = require('compression');
const { handleRandomImageRequest, generateRandomImageTags } = require('./randomImageProvider');
const {
  buildPromisifiedClose,
  buildBasicLocalServer,
  startLocalHttpServer,
} = require('../../test-utils/server/index');
const { generateServerTiming, setServerTimingHeader } = require('../../test-utils/server/serverTiming');

function getRumScript({beaconHost, beaconPort}) {
  return `
    <script src="https://${beaconHost}:${beaconPort}/dist/splunk-rum.js"></script>
    <script>
      SplunkRum.init({"beaconUrl":"https://${beaconHost}:${beaconPort}/api/v2/spans", app:"perf-test-app", debug:true});
    </script>
  `;
}

function startWebsocketServer({ enableHttps, listener }) {
  const { server, serverOptions } = buildBasicLocalServer({ enableHttps, listener });
  return new Promise((resolve, reject) => {
    const websocketServer = new WebSocket.Server({ server });    
    
    server.on('listening', () => {
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

function getSpans(spanOrSpans) {
  if (Array.isArray(spanOrSpans)) {
    return spanOrSpans.flatMap(getSpans);
  }

  return [{
    name: spanOrSpans.name,
    tags: spanOrSpans.tags,
  }];
}

async function run({onSpanReceived, enableHttps, port}) {
  enableHttps = enableHttps || false;
  let lastServerTiming;
  function addHeaders(response) {
    lastServerTiming = generateServerTiming();
    setServerTimingHeader(response, lastServerTiming)
  }

  if (!onSpanReceived) {
    onSpanReceived = () => {};
  }

  const app = express();
  app.engine('html', renderFile);
  app.engine('ejs', renderFile);
  app.set('views', path.resolve(__dirname, '..'));

  app.use(bodyParser.json({ type: 'text/plain' }));  
  app.use(bodyParser.json({ type: 'application/json' }));
  app.use(compression());

  handleReactBundleRequest(app);
  handleSplunkRumRequest(app);
  handleRandomImageRequest(app);

  app.get('/', function(req, res) {
    const imageCount = req.query.imageCount || 20;

    const headContents = [];
    const bodyBottomContents = [];

    if (req.query.rumHead === 'true') {
      headContents.push(generateSplunkRumTags());
    } else if (req.query.rumBottom === 'true') {
      bodyBottomContents.push(generateSplunkRumTags());
    } else if (req.query.rumHead !== 'false') {
      headContents.push(generateSplunkRumTags());
    }

    bodyBottomContents.push(generateReactBundleTags());

    addHeaders(res);
    return res.render('dummy-app-react/index.html', {
      headResources: headContents.join(''),
      markup: generateRandomImageTags(imageCount),
      bodyBottomResources: bodyBottomContents.join(''),
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
  } = await startLocalHttpServer({ enableHttps, listener: app, port });

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

  return {
    close: () => Promise.all([closeHttpServer(), closeWebsocketServer()]),
    port: httpPort,
    websocketsPort: wsPort,
    getLastServerTiming: () => lastServerTiming,
  };
};

module.exports = {
  run,
  getRumScript,
};
