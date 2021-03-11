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

import * as assert from 'assert';
import { deinit, initWithDefaultConfig, SpanCapturer } from './utils';
import { SpanKind } from '@opentelemetry/api';

describe('can produce websocket events', () => {
  let capturer;

  beforeEach(() => {
    capturer = new SpanCapturer();
    initWithDefaultConfig(capturer, {
      capture: {
        websocket: true
      }
    });
  });
  afterEach(() => {
    deinit();
  });

  it('can produce a series of spans from basic usage', (done) => {
    const socket = new WebSocket('ws://127.0.0.1:8979/', 'foo');
    const openListener = function() {
      socket.send('Hello server');
      socket.removeEventListener('open', openListener);
    };
    const msgListener = function() {
      socket.removeEventListener('message', msgListener);
      // last span won't happen until my message callback is done
      setTimeout(() => {
        const wsSpans = capturer.spans.filter(span => span.attributes.component === 'websocket');
        assert.strictEqual(3, wsSpans.length);

        wsSpans.forEach( span => {
          assert.strictEqual('ws://127.0.0.1:8979/', span.attributes['http.url']);
        });
        assert.strictEqual('connect', wsSpans[0].name);
        assert.strictEqual(SpanKind.CLIENT, wsSpans[0].kind);
        assert.strictEqual('foo', wsSpans[0].attributes.protocols);
        assert.strictEqual('send', wsSpans[1].name);
        assert.strictEqual(SpanKind.PRODUCER, wsSpans[1].kind);
        assert.strictEqual(12, wsSpans[1].attributes['http.request_content_length']);
        assert.strictEqual('foo', wsSpans[1].attributes.protocol);
        assert.strictEqual('onmessage', wsSpans[2].name);
        assert.strictEqual(SpanKind.CONSUMER, wsSpans[2].kind);
        assert.strictEqual(8, wsSpans[2].attributes['http.response_content_length']);
        assert.strictEqual('foo', wsSpans[2].attributes.protocol);
        socket.close();
        done();
      }, 100);
    };
    socket.addEventListener('open', openListener);
    socket.addEventListener('message', msgListener);
    // Handful of misc listener calls to exercise some code while we have a test fixture handy
    socket.addEventListener('message', msgListener); // has no effect
    socket.removeEventListener('message', function() { /* never actually added */ });
  });

  it ('can handle EventListener', (done) => {
    const socket = new WebSocket('ws://127.0.0.1:8979/', ['foo', 'bar']);
    socket.addEventListener('open', () => {
      socket.send('Hello server');
    });
    socket.addEventListener('message', {
      handleEvent() {
        setTimeout(() => {
          const wsSpans = capturer.spans.filter(span => span.attributes.component === 'websocket');
          assert.strictEqual(3, wsSpans.length);
          assert.strictEqual('["foo","bar"]', wsSpans[0].attributes.protocols);
          assert.strictEqual('foo', wsSpans[1].attributes.protocol);
          socket.close();
          done();
        }, 100);
      }
    }, {once:true});
  });

  // FIXME find a way to make send throw..

  it ('can report failed connect to non-listening port', (done) => {
    capturer.clear();
    const socket = new WebSocket('ws://127.0.0.1:31874/', ['foo', 'bar']); // assuming no ws server running there...
    socket.addEventListener('error', () => {
      setTimeout(() => {
        const wsSpans = capturer.spans.filter(span => span.attributes.component === 'websocket');
        assert.strictEqual(1, wsSpans.length);
        assert.strictEqual('ws://127.0.0.1:31874/', wsSpans[0].attributes['http.url']);
        assert.strictEqual('websocket', wsSpans[0].attributes.component);
        assert.strictEqual('connect', wsSpans[0].name);
        assert.strictEqual(true, wsSpans[0].attributes.error);
        done();
      }, 100);
    });
  });
  // note: skipping, because it breaks in chrome 88
  it.skip('can report failed connect to blocked port', () => {
    capturer.clear();
    try {
      new WebSocket('ws://127.0.0.1:53/'); // assuming no ws server running there...
      assert.ok(false); // shouldn't get here
    } catch (expectedErr) {
      assert.strictEqual(1, capturer.spans.length);
      assert.strictEqual('ws://127.0.0.1:53/', capturer.spans[0].attributes['http.url']);
      assert.strictEqual('websocket', capturer.spans[0].attributes.component);
      assert.strictEqual('connect', capturer.spans[0].name);
      assert.strictEqual(true, capturer.spans[0].attributes.error);
    }
  });
  it ('can report invalid WebSocket constructor', () => {
    capturer.clear();
    try {
      new WebSocket('invalid url format'); // assuming no ws server running there...
      assert.ok(false); // shouldn't get here
    } catch (expectedErr) {
      assert.strictEqual(1, capturer.spans.length);
      assert.strictEqual('invalid url format', capturer.spans[0].attributes['http.url']);
      assert.strictEqual('websocket', capturer.spans[0].attributes.component);
      assert.strictEqual('connect', capturer.spans[0].name);
      assert.strictEqual(true, capturer.spans[0].attributes.error);
    }
  });
});
