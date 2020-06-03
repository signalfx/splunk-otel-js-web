import {ConsoleSpanExporter, SimpleSpanProcessor} from '@opentelemetry/tracing';
import {WebTracerProvider} from '@opentelemetry/web';
import {DocumentLoad} from '@opentelemetry/plugin-document-load';
import {XMLHttpRequestPlugin} from '@opentelemetry/plugin-xml-http-request';
import * as api from '@opentelemetry/api';
import {hrTimeToMicroseconds} from '@opentelemetry/core';


// Plug in your beacon URL here.  Obviously this needs an API like init( { beaconUrl: '' })...
const exportUrl = 'http://127.0.0.1:9080/api/v2/spans';


if (!document.cookie.includes("rumSessionID")) {
    var id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx".replace(/x/g, function (c) {
        return ((Math.random() * 16) | 0).toString(16);
    });
    document.cookie = "rumSessionID=" + id + "; path=/";
}
var rumSessionId = function () {
    console.log("doc.cookie is " + document.cookie);
    var decodedCookie = decodeURIComponent(document.cookie);
    var cookies = decodedCookie.split(';');
    for (var i = 0; i < cookies.length; i++) {
        var c = cookies[i].trim();
        if (c.indexOf("rumSessionID=") === 0) {
            return c.substring("rumSessionID=".length, c.length);
        }
    }
    return undefined;
}();

const provider = new WebTracerProvider({
    plugins: [
        new DocumentLoad(),
        new XMLHttpRequestPlugin(),
    ],
    defaultAttributes: {
        'sfx.rumSessionId': rumSessionId
    }
});


// FIXME this is a nasty copy+paste hack to get the zipkin exporter able to work in a browser context.
class MySpanExporter {
    constructor() {
    }

    export(spans, resultCallback) {
        const zspans = spans.map(span => this.toZipkinSpan(span, 'browser'));
        const zJson = JSON.stringify(zspans);
        const useBeacon = true;
        if (useBeacon) {
            navigator.sendBeacon(exportUrl, zJson);
        } else { // FIXME causes CORS problems typically - figure out how it's supposed to work long-term
            const xhr = new XMLHttpRequest();
            xhr.open('POST', exportUrl);
            //xhr.setRequestHeader(collectorTypes.OT_REQUEST_HEADER, '1');
            xhr.setRequestHeader('Accept', 'application/json');
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.send(zJson);
            // don't bother waiting for answer
        }
        resultCallback("SUCCESS");
    }

    shutdown() {
    }


    toZipkinTags(attrs, status, statusCodeTagName, statusDescriptionTagName, resource) {
        const tags = {};
        for (const key of Object.keys(attrs)) {
            tags[key] = String(attrs[key]);
        }
        tags[statusCodeTagName] = String(api.CanonicalCode[status.code]);
        if (status.message) {
            tags[statusDescriptionTagName] = status.message;
        }
        Object.keys(resource.labels).forEach(
            name => (tags[name] = resource.labels[name])
        );
        tags['sfx.rumSessionId'] = rumSessionId;
        return tags;
    }

    toZipkinAnnotations(events) {
        return events.map(event => ({
            timestamp: hrTimeToMicroseconds(event.time),
            value: event.name,
        }));
    }

    toZipkinSpan(span, serviceName) {
        const ZIPKIN_SPAN_KIND_MAPPING = {
            [api.SpanKind.CLIENT]: 'CLIENT',
            [api.SpanKind.SERVER]: 'SERVER',
            [api.SpanKind.CONSUMER]: 'CONSUMER',
            [api.SpanKind.PRODUCER]: 'PRODUCER',
            // When absent, the span is local.
            [api.SpanKind.INTERNAL]: undefined,
        };
        return {
            traceId: span.spanContext.traceId,
            parentId: span.parentSpanId,
            name: span.name,
            id: span.spanContext.spanId,
            kind: ZIPKIN_SPAN_KIND_MAPPING[span.kind],
            timestamp: hrTimeToMicroseconds(span.startTime),
            duration: hrTimeToMicroseconds(span.duration),
            localEndpoint: {serviceName},
            tags: this.toZipkinTags(
                span.attributes,
                span.status,
                'ot.status_code',
                'ot.status_description',
                span.resource
            ),
            annotations: span.events.length
                ? this.toZipkinAnnotations(span.events)
                : undefined,
        };
    }


}

provider.addSpanProcessor(new SimpleSpanProcessor(new ConsoleSpanExporter()));
provider.addSpanProcessor(new SimpleSpanProcessor(new MySpanExporter()));
provider.register();

