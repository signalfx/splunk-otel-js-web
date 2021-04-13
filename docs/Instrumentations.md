# Instrumentations

In this section, all instrumentations are described, along with their purpose and the description of the data model produced. 

## Instrumentation: Document Load

Document load instrumentation produces spans about resources that have loaded by the time [`Window:load`](https://developer.mozilla.org/en-US/docs/Web/API/Window/load_event) event fires. The root span generated is `documentLoad`. Following `documentFetch` and `resourceFetch` spans should have their `parentId` set as `documentLoad.id`. 

If the page load request has a `server-timing` header present it is used to link `documentFetch` span to backend span via link tags. Page loads in Safari browsers are not linked with the backend trace, as `server-timing` API is not currently supported on Safari. Resources loading during page load are captured via `[performance.getEntriesByType(‘resource’)](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceResourceTiming)` API. 

Splunk Browser Agent supports capturing different resources, such as: `script, link, css - font, iframe, XHR/fetch, img, favicon` and `manifest.json`.Notice that if any of these resources has a `server-timing` header set in the response headers, such resources will also be linked to the APM trace.

### documentLoad

Following tags are captured from the information captured by the `documentLoad` instrumentation:

|Name|Type|Description|Example|
|---|---|---|---|
|`document.referrer`|`string`|URI of the page that referred to this page via `a href`.|`"https://subdomain.example.com/"`|
|`screen.xy`|`string`|Width(x) and height(y) of the display.|`"2560x1440"`|

### documentFetch

### resourceFetch

## Instrumentation: XHR/fetch

## Instrumentation: Web Vitals

## Instrumentation: Post document load

## Instrumentation: User Interactions

### History API

## Instrumentation: Long tasks

## Instrumentation: Websockets

### connect

### send and onmessage
