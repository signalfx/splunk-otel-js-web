import * as assert from 'assert';
import * as api from '@opentelemetry/api';

require('../src/sfx-rum.js');

describe('test setup', () => {
  window.SfxRum.init( {beaconUrl: 'http://127.0.0.1:9999/foo' } );
  console.log('OK!');
  it ('should have created a session cookie', () => {
    assert.ok(document.cookie.includes("rumSessionID"));
 });
});
