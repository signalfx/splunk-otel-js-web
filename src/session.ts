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

import { findCookieValue, generateId, isIframe } from './utils';

/*
    The basic idea is to let the browser expire cookies for us "naturally" once
    IntactivityTimeout is reached.  Activity (including any page load)
    extends the session.  The true startTime of the session is set in the cookie value
    and if an extension would ever exceed MaxAge it doesn't happen.
    We use a background periodic timer to check for expired cookies and initialize new ones.
    Session state is stored in the cookie as uriencoded json and is of the form
    {
        id: 'sessionIdAsHex',
        startTime: startTimeAsNewDate_getTime
    }
    Future work can add more fields though note that the fact that the value doesn't change
    once created makes this very robust when used in multiple tabs/windows - tabs don't compete/
    race to do anything but set the max-age.
*/


const MaxSessionAgeMillis = 4 * 60 * 60 * 1000;
const InactivityTimeoutSeconds = 15 * 60;
const PeriodicCheckSeconds = 60;
export const COOKIE_NAME = '_splunk_rum_sid';

type SessionIdType = string
let rumSessionId: SessionIdType = generateId(64); // will be overwritten in init() with scriptInstance; only here as extreme fallback
let recentActivity = false;
let cookieDomain: string;

function markActivity() {
  recentActivity = true;
}

function pastMaxAge(startTime: number): boolean {
  const now = Date.now();
  return startTime > now || now > startTime + MaxSessionAgeMillis;
}

function parseCookieToSessionState() {
  const rawValue = findCookieValue(COOKIE_NAME);
  if (!rawValue) {
    return undefined;
  }
  const decoded = decodeURIComponent(rawValue);
  if (!decoded) {
    return undefined;
  }
  let ss: any = undefined;
  try {
    ss = JSON.parse(decoded);
  } catch (error) {
    return undefined;
  }
  // should exist and be an object
  if (!ss || typeof ss !== 'object') {
    return undefined;
  }
  // id validity
  if (!ss.id || typeof ss.id !== 'string' || !ss.id.length || ss.id.length !== 32) {
    return undefined;
  }
  // startTime validity
  if (!ss.startTime || typeof ss.startTime !== 'number' || pastMaxAge(ss.startTime)) {
    return undefined;
  }
  return ss;
}

function newSessionState() {
  return {
    id: generateId(128),
    startTime: Date.now()
  };
}

function renewCookieTimeout(sessionState) {
  if (pastMaxAge(sessionState.startTime)) { // safety valve
    return;
  }
  const cookieValue = encodeURIComponent(JSON.stringify(sessionState));
  const domain  = cookieDomain ? `domain=${cookieDomain};` : '';
  let cookie = COOKIE_NAME + '=' + cookieValue + '; path=/;' + domain + 'max-age=' + InactivityTimeoutSeconds ;

  if (isIframe()) {
    cookie += ';SameSite=None; Secure';
  } else {
    cookie += ';SameSite=Strict';
  }
  document.cookie = cookie;
}

// This is called periodically and has two purposes:
// 1) Check if the cookie has been expired by the browser; if so, create a new one
// 2) If activity has occured since the last periodic invocation, renew the cookie timeout
// (Only exported for testing purposes.)
export function updateSessionStatus(): void {
  let sessionState = parseCookieToSessionState();
  if (!sessionState) {
    sessionState = newSessionState();
    recentActivity = true;  // force write of new cookie
  }
  rumSessionId = sessionState.id;
  if (recentActivity) {
    renewCookieTimeout(sessionState);
  }
  recentActivity = false;
}

export function initSessionTracking(instanceId: SessionIdType, domain?: string): void {
  if (domain) {
    cookieDomain = domain;
  }
  rumSessionId = instanceId;
  recentActivity = true; // document loaded implies activity
  updateSessionStatus();
  setInterval(updateSessionStatus, PeriodicCheckSeconds * 1000);
  [
    'click', 'scroll', 'mousedown', 'keydown', 'touchend', 'visibilitychange'
  ].forEach(type => document.addEventListener(type, markActivity, { capture:true, passive: true }));
  // FIXME have span creation also markActivity?
}

export function getRumSessionId(): SessionIdType {
  return rumSessionId;
}
