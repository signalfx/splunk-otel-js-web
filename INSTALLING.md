# Installation Options for splunk-rum.js

You have a number of options for how you place the script into your pages/apps.  This document walks you through some
of them and discusses their tradeoffs.  The best choice for you will depend on the design of your app/pages, the performance
variables you cast most about, and how much complexity/work you want to put into your integration.


## Default Recommendation

Our recommendation for getting started is simple: host `splunk-rum.js` as your own asset
(so that it is served over the same HTTP connection as your pages/scripts/images) and apply the following scripts in
your `<head>`:

```html
<script src="http://your-site.com/whatever/splunk-rum.js"></script>
<script>
  window.SplunkRum.init(
    {
      // Your beaconUrl should be provided by your friendly Splunk representative
      beaconUrl: 'http://example.com/v1/rum',
      // You can generate or get your rumAuth token from your friendly Splunk representative
      rumAuth: 'ABC123...789',
      app: 'my-awesome-app'
    });
</script>
```

Our uncompressed script is currently around 70 kb raw / 18 kb compressed.  Serving it over the same connection 
as your other assets increases the likelihood that the only penalty you will pay is bandwidth/download speed and not connection/TLS
negotiation.  Besides this latency (which will obviously vary by connection speed), nearly all the work of the script is done asynchronously - it adds around 10-20 ms of javascript processing to initialize.

We recommend that you start with this and measure.  If you then still concerned about the overhead of placing this script in your `<head>`, read on for a discussion of your options.

## Data Completeness

Other options for script placement all have implications for data completeness:

- **Missing DOM errors**: our script listens for DOM errors as soon as it is initialized.  Activating the script later in the page load sequence means that it will miss DOM errors that occur before it is loaded.  For example, if an `<img src=` element fails to load before `SplunkRum.init()`, we will not be able to report that.
- **Missing activity from third-party components**: as with DOM errors, anything (besides the page load itself) that occurs before our script is loaded will generally be missing from our data stream.  For example, if our script is placed before your own app but after a number of third-party components (e.g., a script to load a chat widget, or an iframe to embed a video player), we might not report the initial behaviors of those components.
- **Caching uninstrumented APIs**: our script uses instrumentation to capture data from the browser's activity.  For example, we replace the `fetch` API with a thin wrapper that times/observes the fetch call in action.  If your app (or any third-party library.component) caches a pointer to `fetch` before our instrumentation happens, then we will be blind to that activity "forever".

## Placement elsewhere on page

Because our `document-load` information comes from the browser's `performance` APIs, you can place the same `<script>` tags nearly anywhere in your page and we will still be able to report information about the document-load sequence.  Per the above notes on [data completeness](#data-completeness), this will cause some data to be missing.  If not the `<head>`, the next best places for our sript initialization are (in priority order):
- Just before the initialization of any third-party `<script>` or `<iframe>`.
- Just before the first `<script>` of your app
- At the bottom of the page (e.g., just before `</body>`)

## Inlining / manual bundling

If you have build-time infrastructure to support it, you can inline our script in your page (again, at any point you wish, being aware of the data completeness tradeoffs) to avoid paying the penalty of a separate HTTP request.  If you have an existing pipeline where you bundle commonly-used scripts into one download, you could also integrate our script (and its initialization) with that.

## Async/defer options

W**We do not recommend this approach.**.  In addition to placing elsewhere, you can also load our script `async` or `defer`.   This has all the data completeness drawbacks discussed above while also introducing randomness/variability into the process - three different page loads might miss different amounts of monitoring data.   If you want to use `async`, it might look like the following:
```html
<script>
function initializeSplunkRum() {
  window.SplunkRum.init( ... );   
}
</script>
<script src="http://your-site.com/whatever/splunk-rum.js" async onload="initializeSplunkRum()"></script>
```
