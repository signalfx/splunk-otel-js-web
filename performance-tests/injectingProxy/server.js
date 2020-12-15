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

const Proxy = require('http-mitm-proxy');
const zlib = require('zlib');

const { HtmlInjectorTransform } = require('./HtmlInjectorTransform');

function buildInjectingStream(headers, transformer) {
  let headStream = null, tailStream = null;
  switch (headers['content-encoding']) {
    case 'gzip':
      headStream = zlib.createGunzip()
      tailStream = headStream.pipe(transformer).pipe(zlib.createGzip());
      break;
    case 'deflate':
      headStream = zlib.createInflate()
      tailStream = headStream.pipe(transformer).pipe(zlib.createDeflate());
      break;
    default:
      tailStream = headStream = transformer;
      break;
  }
  return { headStream, tailStream };
}

async function run({matchingInjectionPrefix, contentToInject, disableInjection}) {
  const proxy = Proxy();

  // TODO: remove? we don't need this
  proxy.onError(function(ctx, err) {
    const ignoredErrs = [
      // note: this isn't really an error, it's how browsers usually close sockets
      'ECONNRESET',
      
      // TODO: understand what this meanas
      'ENOTFOUND',

      // TODO: this seems like an issue in our implementation of stream-based injections
      // but the stack trace is unclear
      'EPIPE',
    ];

    if (!ignoredErrs.includes(err.code)) {
      console.error('proxy error:', err);
    }
  });

  proxy.onRequest(function(ctx, callback) {
    if (ctx.clientToProxyRequest.headers.host == 'github.com'
      && ctx.clientToProxyRequest.url.indexOf('/') == 0
      && !disableInjection) {

      let headStream, tailStream;
      ctx.onResponse((ctx, callback) => {
        const injectingStream = new HtmlInjectorTransform({
          matchingSuffix: matchingInjectionPrefix,
          contentToInject,
        });
        const pipeline = buildInjectingStream(ctx.serverToProxyResponse.headers, injectingStream);
        headStream = pipeline.headStream;
        tailStream = pipeline.tailStream;

        // note: manual pipe(), because 'finish' events of these streams are to be detached from
        // one another, lack of backpressure handling is fine, because amount of data is low
        tailStream.on('data', (chunk) => {
          ctx.proxyToClientResponse.write(chunk)
        });
        callback();
      });

      ctx.onResponseData(function(_, chunk, callback) {
        headStream.write(chunk);
        return callback(null, undefined);
      });

      ctx.onResponseEnd((_, callback) => {
        headStream.end();
        tailStream.on('close', () => {
          callback(undefined);
        });
      });

      ctx.onResponse((_, callback) => {
        const toFilterOut = [
          'strict-transport-security',
          'content-security-policy',
        ];

        Object.keys(ctx.serverToProxyResponse.headers).forEach(headerName => {
          if (toFilterOut.includes(headerName.toLowerCase())) {
            delete ctx.serverToProxyResponse.headers[headerName];    
          }
        });
        callback();
      });
    }
    return callback();
  });

  await new Promise(resolve => proxy.listen({port: 0}, resolve));
  return {
    port: proxy.httpPort,
    close: () => Promise.resolve(proxy.close()),
  };
}

module.exports = {
  run,
};
