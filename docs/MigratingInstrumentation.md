> The official Splunk documentation for this page is [Manually instrument browser-based web applications](https://quickdraw.splunk.com/redirect/?product=Observability&location=github.rum.manual.instrumentation&version=current). For instructions on how to contribute to the docs, see [CONTRIBUTING.md](../CONTRIBUTING.md#documentation).

# Migrating Manual Instrumentation

If you have some existing manual instrumentation of your app with, e.g., another
vendor's API, you can usually translate this code fairly easily to use OpenTelemetry 
conventions.  This document will walk you through a few examples.

## "Actions" or "Events"

You may have instrumentation that captures custom timestamps or time ranges for activity
within your app.  For example, you might have code hooked up to a CPU-intensive 
`calculateEstateTax` function so that you can know how its performance is affecting your
users.  OpenTelemetry represents operations like this with spans; in addition to capturing a start
and end time, you can also include additional details in key-value pairs called attributes:

```javascript
import {trace} from '@opentelemetry/api'

function calculateEstateTax(estate) {
    const span = trace.getTracer('estate').startSpan('calculateEstateTax');
    span.setAttribute('estate.jurisdictionCount', estate.jurisdictions.length);
    var taxOwed = 0;
    // ...
    span.setAttribute('isTaxOwed', taxOwed > 0);
    span.end();
    return taxOwed;
}
```

## "Custom Properties" / "Tags" / "Attributes"

You might have a feature where you capture additional tags or properties about the 
page and include that information in your RUM data stream.  For example, you might
be capturing details about A/B tests, account categorization (gold/silver/bronze), 
the relase version of the app, or UI modes.  OpenTelemetry attributes are simple 
key-value pairs and are a great way to organize this information.

If the relevant properties are known at the time the page is loaded, you can simply use
`globalAttributes`:

```js
SplunkRum.init( {
    beaconEndpoint: '...',
    rumAccessToken: '...',
    globalAttributes: {
        'account.type': goldStatus,
        'app.release': getReleaseNumber(),
    },
});
```

If the properties are not known until later or can change over the lifetime of
the page, you can update/add them dynamically like this:

```js
SplunkRum.setGlobalAttributes({
    'account.type': goldStatus,
    'app.release': getReleaseNumber(),
    'dark_mode.enabled': darkModeToggle.status,
});
```

Note that `setGlobalAttributes` replaces anything set in `init()`'s `globalAttributes` so be sure 
the two code blocks are in agreement.  The easiest way to achieve this is to factor
out a common `computeGlobalAttributes` and then call it for both `init` and whenever you want 
to `setGlobalAttributes`.

## Capturing errors

You may have instrumentation that reports errors that are captured/handled in your code.  
We've provided a (non-OpenTelemetry) simple convenience function for reporting these:

```js
try {
    doSomething();
} catch (e) {
    SplunkRum.error(e);
}
```

`SplunkRum.error` can accept strings (or arrays of them), `Error`s, and `ErrorEvent`s.
