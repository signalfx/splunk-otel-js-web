> The official Splunk documentation for this page is [Install the Browser RUM agent for Splunk RUM](https://quickdraw.splunk.com/redirect/?product=Observability&location=github.rum.get.started&version=current). For instructions on how to contribute to the docs, see [CONTRIBUTING.md](../CONTRIBUTING.md#documentation).

# Content Security Policy

If you're using [Content Security Policy (CSP)](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP) to mitigate potential impact from exploits such as XSS, you need to make sure the policy allows Splunk RUM:

- If you use our CDN to load the agent make sure to allow `script-src` `cdn.signalfx.com`
  - Cases of self-hosting and npm installation should already be covered by your site, as otherwise interactivity on your site wouldn't work.
- Add the host from `beaconUrl` value to `connect-src`, ie. `connect-src` `app.us1.signalfx.com`
