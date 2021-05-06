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
import { buildInternalEventTarget } from '../src/EventTarget';
import { initSessionTracking, COOKIE_NAME, getRumSessionId, updateSessionStatus } from '../src/session';

describe('Session tracking', () => {
  it('should correctly handle expiry, garbage values, (in)activity, etc.', (done) => {
    // First clear the cookie so we start from a known quantity
    document.cookie = COOKIE_NAME+'=garbageValue;expires=Thu, 01 Jan 1970 00:00:00 GMT';
    // the init tests have possibly already started the setInterval for updateSessionStatus.  Try to accomodate this.
    initSessionTracking('1234', buildInternalEventTarget());
    const firstSessionId = getRumSessionId();
    assert.strictEqual(firstSessionId.length, 32);
    // no marked activity, should keep same state
    updateSessionStatus();
    assert.strictEqual(firstSessionId, getRumSessionId());
    // set cookie to expire in 2 seconds, mark activity, and then updateSessionStatus.
    // Wait 4 seconds and cookie should still be there (having been renewed)
    const cookieValue = encodeURIComponent(JSON.stringify({ id:firstSessionId, startTime: new Date().getTime() }));
    document.cookie = COOKIE_NAME + '=' + cookieValue + '; path=/; max-age=' + 2;
    document.body.dispatchEvent(new Event('click'));
    updateSessionStatus();
    setTimeout(()=>{
      // because of activity, same session should be there
      assert.ok(document.cookie.includes(COOKIE_NAME));
      assert.strictEqual(firstSessionId, getRumSessionId());

      // Finally, set a fake cookie with startTime 5 hours ago, update status, and find a new cookie with a new session ID
      // after max age code does its thing
      const fiveHoursMillis = 5 * 60 * 60 * 1000;
      const tooOldCookieValue = encodeURIComponent(JSON.stringify({ id:firstSessionId, startTime: new Date().getTime()-fiveHoursMillis }));
      document.cookie = COOKIE_NAME + '=' + tooOldCookieValue + '; path=/; max-age=' + 4;

      updateSessionStatus();
      assert.ok(document.cookie.includes(COOKIE_NAME));
      const newSessionId = getRumSessionId();
      assert.strictEqual(newSessionId.length, 32);
      assert.ok(firstSessionId !== newSessionId);

      done();
    }, 4000);
  });
});
