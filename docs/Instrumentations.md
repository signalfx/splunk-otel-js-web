# Instrumentations

In this section, all instrumentations are described, along with their purpose and the description of the data model produced. 

## Instrumentation: Document Load

Document load instrumentation produces spans about resources that have loaded by the time [`Window:load`](https://developer.mozilla.org/en-US/docs/Web/API/Window/load_event) event fires. The root span generated is `documentLoad`. Following `documentFetch` and `resourceFetch` spans should have their `parentId` set as `documentLoad.id`. 

If the page load request has a `server-timing` header present it is used to link `documentFetch` span to backend span via link tags. Page loads in Safari browsers are not linked with the backend trace, as `server-timing` API is not currently supported on Safari. Resources loading during page load are captured via [`performance.getEntriesByType(‘resource’)`](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceResourceTiming) API. 

Splunk Browser Agent supports capturing different resources, such as: `script, link, css - font, iframe, XHR/fetch, img, favicon` and `manifest.json`.Notice that if any of these resources has a `server-timing` header set in the response headers, such resources will also be linked to the APM trace.

### documentLoad

Following tags are captured from the information captured by the `documentLoad` instrumentation:

|Name|Type|Description|Example|
|---|---|---|---|
|`document.referrer`|`string`|URI of the page that referred to this page via `a href`.|`"https://subdomain.example.com/"`|
|`screen.xy`|`string`|Width(x) and height(y) of the display.|`"2560x1440"`|

Following annotations are captured from the  navigation timings, as specified by the [W3C specification](https://w3c.github.io/navigation-timing/#sec-PerformanceNavigationTiming). The timestamps represent the NavigationTimings API events during a page load:

![Navigation Timing](https://www.w3.org/TR/navigation-timing/timing-overview.png)

|Name|Description|
|---|---|
|`fetchStart`|A timestamp immediately before the browser starts to fetch the resource.|
|`unloadEventStart`|A timestamp immediately before the user agent starts the unload event of the previous document.|
|`unloadEventEnd`|A timestamp immediately after the user agent finishes the unload event of the previous document.|
|`domInteractive`|A timestamp immediately before the user agent sets the current document readiness of the current document to interactive.|
|`domContentLoadedEventStart`|A timestamp representing the time value equal to the time immediately before the user agent fires the DOMContentLoaded event at the current document.|
|`domContentLoadedEventEnd`|A timestamp representing the time value equal to the time immediately after the current document's DOMContentLoaded event completes.|
|`domComplete`|A timestamp representing a time value equal to the time immediately before the browser sets the current document readiness of the current document to complete.|
|`loadEventStart`|A timestamp immediately before the load event of the current document is fired.|
|`loadEventEnd`|A timestamp when the load event of the current document is completed.|

### documentFetch

Following tags are captured by instrumenting the `documentFetch` invocations:

|Name|Type|Description|
|---|---|---|
|`http.response_content_length`|`number`|The size of the document received from the payload body as specified [here](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceResourceTiming/encodedBodySize).|
|`link.traceId`|`string`|Trace identifier, captured from `server-timing` response header set by the APM agent|
|`link.spanId`|`string`|Span identifier, captured from `server-timing` response header set by the APM agent|


### resourceFetch

Following tags are captured by instrumenting the `resourceFetch` invocations:

|Name|Type|Description|
|---|---|---|
|`http.response_content_length`|`number`|The size of the document received from the payload body as specified [here](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceResourceTiming/encodedBodySize).|
|`link.traceId`|`string`|Trace identifier, captured from `server-timing` response header set by the APM agent|
|`link.spanId`|`string`|Span identifier, captured from `server-timing` response header set by the APM agent|
|`http.url`|||

## Instrumentation: XHR/fetch

## Instrumentation: Web Vitals

## Instrumentation: Post document load

## Instrumentation: User Interactions

### History API

## Instrumentation: Long tasks

## Instrumentation: Websockets

### connect

### send and onmessage
