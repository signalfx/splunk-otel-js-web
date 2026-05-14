# LCP Root Cause Detectability in OTel RUM

## Summary

LCP RCA in this document uses the four canonical LCP phases as defined by
Chrome and `web-vitals`:

1. Time to First Byte
2. Resource Load Delay
3. Resource Load Duration
4. Element Render Delay

The key answer is that browser APIs can surface the phase timings
programmatically, but root cause detection varies by cause:

- Some causes are directly measurable today in Splunk OTel JS Web RUM.
- Some are indirectly inferable today from correlated spans and attributes.
- Some require LCP attribution, additional element/resource metadata, server
  headers, backend trace correlation, or product-side heuristics.

Beyond browser APIs and the SDK itself, several causes are only diagnosable
with cooperation from the server or CDN — `Server-Timing` for backend/edge
phases, `Timing-Allow-Origin` for cross-origin resource timing, cache status
headers, and backend trace correlation through propagated trace context. Today
the SDK uses `Server-Timing` primarily for `traceparent` correlation; exporting
backend/edge phase names and durations would require additional mapping.

The most important current gap is LCP attribution. The SDK currently imports the
standard `web-vitals` build and reports only the metric value (plus existing
span context such as `location.href`) on `webvitals` spans. Once we switch to
`web-vitals/attribution`, we can collect the four LCP subpart timings, the LCP
resource timing entry, the navigation timing entry, and privacy-reviewed LCP
element/resource identifiers.

### LCP thresholds

| Rating            | LCP value              |
| ----------------- | ---------------------- |
| Good              | `<= 2.5s`              |
| Needs improvement | `> 2.5s` and `<= 4.0s` |
| Poor              | `> 4.0s`               |

Field-data convention (matching CrUX and `web-vitals` reporting) is to evaluate
these thresholds against the p75 of LCP across page loads, not against a single
session. LCP is primarily an initial page-load metric; SPA route changes need
separate soft-navigation semantics (see [Missing Aspects](#missing-aspects-beyond-the-four-phases)).
BFCache restores are a lifecycle exception: `web-vitals` creates a new metric
instance with a new metric ID and `navigationType = back-forward-cache`.

### TL;DR by phase

| Phase                  | Detectable today                                                                    | Unlocked by LCP attribution (`web-vitals/attribution`)                                          | Needs server / CDN cooperation                                                                                                                           |
| ---------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TTFB                   | `documentFetch` TTFB, DNS/connect/TLS, status code                                  | Phase value tied to the LCP navigation entry                                                    | Mapped `Server-Timing` phase values, cache status headers, backend trace correlation                                                                     |
| Resource Load Delay    | Resource waterfall shape only                                                       | LCP element, LCP resource URL, the resource load delay value, lazy-load / `fetchpriority` hints | `Timing-Allow-Origin` for cross-origin LCP resources                                                                                                     |
| Resource Load Duration | `resourceFetch` duration, response content length                                   | Confirmation that a given resource is the LCP resource, intrinsic size, decode hints            | `Timing-Allow-Origin`, `transferSize` / `nextHopProtocol`, CDN headers                                                                                   |
| Element Render Delay   | Long tasks with container-level attribution; blocking-time approximation before LCP | Render delay value tied to the LCP element, font/hydration correlation                          | FCP/TTI collection for exact TBT-style windows; Long Animation Frame (planned SDK addition) for script/function-level attribution; app-side render marks |

## Current SDK Signals

| Signal                     | Present today?                        | Evidence                                                                                                                                                                                                                              | What it can help diagnose                                                                                                                  |
| -------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| LCP value                  | Yes                                   | `SplunkWebVitalsInstrumentation` calls `onLCP` and stores `lcp` on a `webvitals` span.                                                                                                                                                | Confirms poor LCP, but not the reason.                                                                                                     |
| LCP attribution            | No                                    | Current import is from `web-vitals`, not `web-vitals/attribution`.                                                                                                                                                                    | Needed to identify LCP element, LCP resource URL, and subpart timings.                                                                     |
| Document/navigation timing | Yes                                   | Document load instrumentation emits `documentFetch` and `documentLoad` spans using browser performance entries.                                                                                                                       | TTFB, DNS, connect, TLS, request, response, document load timing; redirects require additional explicit attributes.                        |
| Resource timing            | Yes                                   | `resourceFetch` spans are emitted for document-load resources and selected post-load resources. Network events are added from `PerformanceResourceTiming`.                                                                            | Resource download timing and response content length where available. See note [1] on size fields.                                         |
| Fetch/XHR spans            | Yes                                   | Fetch and XHR instrumentations create HTTP spans and capture `Server-Timing` traceparent hints.                                                                                                                                       | API calls, server correlation, request/response duration, HTTP status where available.                                                     |
| Long tasks                 | Yes, with container-level attribution | Long task instrumentation observes `PerformanceObserver` type `longtask` and emits `longtask` spans, including `longtask.attribution.{container_type,container_src,container_id,container_name}` from the entry's `attribution` list. | Main-thread blocking during or near LCP, and which iframe/script container is implicated. Script/function-level attribution still missing. |
| SPA route completion       | Yes, but not SPA LCP                  | `routeChange` spans wait for in-flight resources and a quiet period.                                                                                                                                                                  | Soft-navigation load duration, but not the visual LCP element for the route.                                                               |
| Visibility/connectivity    | Optional                              | `visibility` and `connectivity` instrumentations exist but are disabled by default.                                                                                                                                                   | Background tabs, offline periods, page lifecycle context.                                                                                  |

## Phase And Root Cause Detectability

| Phase                  | Root cause                                                                                | Can detect today?                                    | What we can use today                                                                                                                                                                  | Additional instrumentation needed                                                                                                                                                                                                                      |
| ---------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| TTFB                   | Server slow, backend saturated, slow app render, cache miss                               | Partial                                              | High `documentFetch` TTFB; backend trace correlation when trace context is propagated through headers or `Server-Timing` traceparent hints.                                            | Server-side phase timing mapped from `Server-Timing`; stronger backend span correlation in UI; CDN cache status headers.                                                                                                                               |
| TTFB                   | Redirect chain                                                                            | Partial                                              | Browser Navigation Timing has redirect timings, but the current exported spans do not make redirect count explicit.                                                                    | Capture redirect timings/count as explicit attributes. Redirect destinations generally require server/CDN instrumentation.                                                                                                                             |
| TTFB                   | DNS/connect/TLS delay                                                                     | Yes for same-origin; partial for cross-origin        | Navigation/resource timing events: `domainLookup*`, `connect*`, `secureConnectionStart`.                                                                                               | `Timing-Allow-Origin` on cross-origin resources to expose full timing.                                                                                                                                                                                 |
| TTFB                   | User far from origin/CDN                                                                  | Partial                                              | High TTFB plus RUM geo/device/network grouping.                                                                                                                                        | CDN POP/region metadata; edge/server timing headers.                                                                                                                                                                                                   |
| TTFB                   | CDN cache miss or no CDN                                                                  | Partial                                              | High TTFB and response status; backend trace correlation if `Server-Timing` carries traceparent hints.                                                                                 | Explicit cache status headers, CDN vendor headers, mapped `Server-Timing` phase values, or backend/edge integration.                                                                                                                                   |
| Resource Load Delay    | LCP resource discovered late                                                              | No                                                   | Manual inference from resource waterfall if we know the LCP URL.                                                                                                                       | LCP attribution: `url`, `lcpResourceEntry`, `resourceLoadDelay`; optional DOM/resource discovery metadata.                                                                                                                                             |
| Resource Load Delay    | LCP image lazy-loaded                                                                     | No                                                   | Manual debugging only.                                                                                                                                                                 | LCP element attribution plus privacy-reviewed element attributes such as `loading`, `fetchpriority`, `currentSrc`.                                                                                                                                     |
| Resource Load Delay    | Missing preload/preconnect/fetchpriority                                                  | Partial                                              | Resource waterfall can show late start, but not missing hints as facts.                                                                                                                | LCP attribution plus document/head hint scan or app-provided metadata.                                                                                                                                                                                 |
| Resource Load Delay    | CSS background image or JS-created image                                                  | Partial                                              | Resource timing can show late request; current SDK cannot identify it as the LCP resource.                                                                                             | LCP attribution plus element/style metadata.                                                                                                                                                                                                           |
| Resource Load Delay    | Render-blocking CSS/JS delays discovery                                                   | Partial                                              | Document/resource spans and long tasks can show blockers before resource start.                                                                                                        | LCP attribution plus critical-resource classification and dependency heuristics.                                                                                                                                                                       |
| Resource Load Duration | Large image/font/video resource                                                           | Yes if resource is captured; better with attribution | `resourceFetch` duration and response content length where available. See note [1] on size fields.                                                                                     | LCP attribution to identify the resource as the LCP resource.                                                                                                                                                                                          |
| Resource Load Duration | Suboptimal image format or poor compression (e.g. PNG/JPEG vs. WebP/AVIF, no gzip/Brotli) | Limited                                              | Response content length and `Content-Type` (where exposed) give weak hints, but compression ratio and codec efficiency are not directly visible.                                       | Encoded/decoded body sizes, MIME type, content-encoding, and per-format size heuristics. Bytes-per-pixel additionally requires intrinsic image dimensions from LCP element attribution (next row), which `PerformanceResourceTiming` does not provide. |
| Resource Load Duration | Oversized intrinsic dimensions / missing responsive images (`srcset`)                     | Limited                                              | We can see the delivered byte size, but not whether the image was larger than the rendered box.                                                                                        | LCP element attribution plus image natural vs. rendered dimensions; optional DOM scan for `srcset`/`sizes`.                                                                                                                                            |
| Resource Load Duration | Slow CDN/origin, protocol, connection reuse                                               | Partial                                              | Resource Timing network events. Browser APIs can expose `nextHopProtocol`, but it is not currently a standard span attribute here.                                                     | CDN/edge metadata; `Timing-Allow-Origin` for cross-origin resources; explicit protocol attribute.                                                                                                                                                      |
| Resource Load Duration | Cache behavior                                                                            | Partial                                              | Response content length may help, but cache-hit inference needs `transferSize === 0` (with `encodedBodySize > 0`), which is not on spans today. See note [1].                          | Explicit cache status headers; Resource Timing `transferSize` and `deliveryType` when available.                                                                                                                                                       |
| Element Render Delay   | Main thread blocked by long tasks                                                         | Yes                                                  | `longtask` spans around LCP time, including container-level attribution (iframe/script container src/id/name).                                                                         | Correlate long tasks to LCP attribution window; script/function-level attribution will come via Long Animation Frame (`PerformanceLongAnimationFrameTiming`), which the SDK is planning to add.                                                        |
| Element Render Delay   | High blocking time before LCP                                                             | Partial                                              | Existing `longtask` spans can approximate main-thread blocking before LCP, but the SDK does not currently collect FCP or TTI, so exact TBT/FCP-to-LCP windows are not available today. | Collect FCP/TTI or another explicit start boundary, then surface a derived blocking-time attribute on the LCP/`webvitals` span.                                                                                                                        |
| Element Render Delay   | Client-side rendering/hydration delays DOM insertion                                      | Partial                                              | Large delay before LCP, long tasks, route/resource spans. Exact FCP-LCP gaps require FCP collection.                                                                                   | Framework hooks, hydration marks, custom spans around render/hydration.                                                                                                                                                                                |
| Element Render Delay   | Render-blocking CSS/JS                                                                    | Partial                                              | Resource waterfall and long tasks.                                                                                                                                                     | Classify render-blocking resources and correlate to LCP render delay.                                                                                                                                                                                  |
| Element Render Delay   | Element hidden by A/B test, consent, personalization, CSS, or JS                          | No                                                   | Manual debugging only.                                                                                                                                                                 | LCP element attribution plus privacy-reviewed computed-style/visibility metadata or app custom marks.                                                                                                                                                  |
| Element Render Delay   | Font loading delays text LCP                                                              | Partial                                              | Font resource timing may exist, but not tied to LCP today.                                                                                                                             | LCP attribution plus font resource correlation and `font-display` metadata.                                                                                                                                                                            |
| Element Render Delay   | Image decode/raster/render cost                                                           | Partial                                              | Large element render delay after resource end can imply this.                                                                                                                          | LCP attribution, image dimensions/type, decode timing where available, LoAF/render timing.                                                                                                                                                             |

[1] **Note on Resource Timing size fields.** The browser exposes `transferSize`,
`encodedBodySize`, `decodedBodySize`, and `nextHopProtocol` on
`PerformanceResourceTiming`, but the SDK currently maps only response content
length onto spans (as `http.response_content_length`). Surfacing the other
fields requires explicit mapping. Cross-origin resources expose these only when
the server sends `Timing-Allow-Origin`. The conventional browser-cache-hit
heuristic is `transferSize === 0` together with `encodedBodySize > 0` on a
same-origin or TAO-enabled resource.

## What Browser APIs Can Surface

### Direct phase timing

The four LCP subparts are calculable in JavaScript from:

- `LargestContentfulPaint`
- `PerformanceNavigationTiming`
- `PerformanceResourceTiming`

The `web-vitals` attribution build already exposes these fields for LCP:

- `timeToFirstByte`
- `resourceLoadDelay`
- `resourceLoadDuration`
- `elementRenderDelay`
- `target` — generated CSS selector for the LCP element.
- `url` — URL of the LCP resource if any.
- `navigationEntry` — raw `PerformanceNavigationTiming`.
- `lcpResourceEntry` — raw `PerformanceResourceTiming` for the LCP resource.
- `lcpEntry` — raw `LargestContentfulPaint` entry.

Do **not** serialize `navigationEntry`, `lcpResourceEntry`, or `lcpEntry`
directly onto spans; extract only sanitized scalar fields (timings, sizes,
protocol). `target` and `url` must follow the same privacy controls as other
selector/URL exports — see the privacy defaults in
[Suggested Next Builds → 1](#1-add-lcp-attribution-to-webvitals-spans).

That means we do not need to invent the phase math. We should prefer the
`web-vitals/attribution` implementation unless we need custom behavior.

### Network details

Navigation Timing and Resource Timing can expose:

- redirect timing
- DNS timing
- TCP connection timing
- TLS timing
- request start
- response start
- response end
- encoded and decoded body size
- transfer size
- next hop protocol
- response status in browsers that expose it
- `serverTiming` entries if the server sends `Server-Timing`

These are strong for network diagnosis, but cross-origin timing is limited
unless the resource sends `Timing-Allow-Origin`. Current SDK code extracts
`traceparent` hints from `Server-Timing`; exporting arbitrary backend, edge, or
cache phase entries would require an explicit attribute mapping.

### Main-thread details

Long Tasks can show the browser main thread was blocked for more than 50 ms.
That is useful for Element Render Delay. The Long Task API exposes container-
level attribution (the iframe/script container that contained the long-running
work), which the SDK already records on `longtask` spans. The limitation is
that attribution stops at the container: it does not reliably identify the
script URL, function, or framework work that caused the block.

Long Animation Frame timing (`PerformanceLongAnimationFrameTiming`) can provide
better script, style, and layout attribution in browsers that support it,
including per-script source URL and per-frame style, layout, and render work.
The SDK is planning to add LoAF instrumentation soon, which will close the
script/function-level attribution gap noted above and feed directly into
blocking-time and Element Render Delay diagnosis.

A blocking-time signal can be derived on top of long tasks: for every long task
inside a chosen window, add `duration − 50 ms`. This is useful as a proxy for
"how congested was the main thread before LCP." The SDK already emits long-task
spans, so a page-start-to-LCP approximation is possible today. Exact TBT or an
FCP-to-LCP blocking window is not fully computable today because the SDK does
not collect FCP or TTI. Adding FCP/TTI or another explicit start boundary would
make a single derived attribute, such as `lcp.blocking_time_ms`, much more
reliable for dashboards and RCA.

## SDK Signals Versus Product RCA

It helps to separate two responsibilities:

- **SDK collection:** capture accurate, privacy-reviewed evidence from browser
  APIs and attach it to spans or events. Examples: LCP phase timings, navigation
  timing, resource timing, long-task overlap, and sanitized resource identifiers.
- **Product RCA:** correlate those signals across spans, traces, sessions, and
  UI/backend metadata to explain the likely cause. Examples: "LCP was dominated
  by resource load delay," "the LCP image started late and no preload was seen,"
  or "TTFB was high and the backend trace shows slow app render."

The SDK should avoid claiming a root cause when the browser only provides a
symptom. It should emit precise facts and low-risk derived signals. The product
or backend can then apply heuristics, show confidence, and combine browser data
with server/CDN context.

## What We Can Detect Today

### Strong today

- Whether a page has poor LCP.
- Whether the initial document fetch has high TTFB.
- Whether document or resource loads are slow.
- DNS/connect/TLS/request/response timing for same-origin and TAO-enabled
  cross-origin resources.
- Whether long tasks occurred during page load.
- Whether fetch/XHR activity is slow and whether backend trace correlation is
  available through `Server-Timing` traceparent hints.

### Partial today

- Whether the LCP resource was slow, if a human can identify the LCP resource
  and match it to a `resourceFetch` span.
- Whether render-blocking resources are likely, by looking at waterfall shape
  and long-task timing before LCP. Exact FCP/LCP gaps require FCP collection.
- Whether server/cache issues are likely, by combining TTFB with backend traces,
  status codes, traceparent links, and any mapped cache/phase attributes.
- Whether SPA route transitions are slow, using `routeChange` duration, but this
  is not the same as LCP for a soft navigation.
- Whether redirects likely contributed to TTFB, but only if we add or inspect
  raw navigation timing. Redirect count is not explicit on current spans.

### Not reliable today

- Which element was the LCP element.
- Which resource was the LCP resource.
- The four LCP subpart values on the RUM event.
- Whether the LCP image was lazy-loaded.
- Whether the LCP resource was missing `preload`, `preconnect`, or
  `fetchpriority`.
- Whether an A/B test, consent gate, personalization, hydration, or CSS
  visibility rule delayed rendering.
- Text LCP root causes involving fonts, unless manually correlated.

## Missing Aspects Beyond The Four Phases

The four phases are the right timing model, but root cause analysis also needs
context that does not fit cleanly into one phase:

- **LCP candidate type:** image, text, video poster, background image, or font
  dependent text. Fix strategy changes by type.
- **Initial load versus soft navigation:** standard LCP is primarily an initial
  page-load metric. SPA route changes need separate soft-navigation semantics.
  The [Soft Navigations API](https://wicg.github.io/soft-navigations/) (origin
  trial / flag-gated in Chromium) is the emerging primitive for SPA LCP; once
  it ships, `web-vitals` can report a per-soft-navigation LCP and we can
  attach it to `routeChange` spans.
- **BFCache restores:** `web-vitals` re-fires `onLCP` for back/forward-cache
  restores with `navigationType === 'back-forward-cache'`. These look like
  cold-load LCP values but are not — the SDK should propagate `navigationType`
  so the backend can filter or bucket them separately.
- **Cache state:** cold cache, warm memory cache, service worker cache, CDN hit,
  CDN miss, and browser cache partitioning can produce different fixes.
- **Page lifecycle:** prerender, BFCache restore, hidden tab, backgrounded tab,
  and previous-page unload can affect field data interpretation.
- **Cross-origin observability:** third-party image/font/CDN resources often hide
  detailed timings unless `Timing-Allow-Origin` is configured.
- **Device capability:** low-end CPU and memory pressure often show up as render
  delay and long tasks, not resource duration.
- **Privacy and selector stability:** collecting element selectors, text, URLs,
  or DOM attributes must respect existing privacy defaults and avoid unstable or
  sensitive identifiers.

## Suggested Next Builds

### 1. Add LCP attribution to `webvitals` spans

Switch LCP collection to `web-vitals/attribution` and add privacy-reviewed
attributes. Names below are split into two groups: LCP-specific fields that
have no semconv equivalent, and HTTP/network fields that should reuse
OpenTelemetry semantic conventions where they exist.

LCP-specific phase timings and identifiers (custom `lcp.*` namespace):

- `lcp.time_to_first_byte`
- `lcp.resource_load_delay`
- `lcp.resource_load_duration`
- `lcp.element_render_delay`
- `lcp.target`
- `lcp.url`
- `lcp.resource.initiator_type`

HTTP/network fields for the LCP resource (prefer existing semconv names):

- response status — `http.response.status_code`
- transfer size — `http.response.transfer_size` if defined, otherwise
  `lcp.resource.transfer_size`
- encoded body size — `http.response.body.size` if defined for encoded bytes,
  otherwise `lcp.resource.encoded_body_size`
- decoded body size — `http.response.body.uncompressed_size` if defined,
  otherwise `lcp.resource.decoded_body_size`
- next hop protocol — `network.protocol.name`

Before finalizing the list, check the current OpenTelemetry browser/web
semantic conventions. Where semconv covers a field, use it directly; reserve
the custom `lcp.*` namespace only for LCP-specific phase timings and
identifiers that have no semconv equivalent. The same principle applies to
INP and CLS attribute naming.

This is the highest leverage change because it turns poor LCP from a single
number into an actionable phase breakdown.

Recommended privacy default:

- Collect numeric phase timings by default.
- Collect numeric resource metadata by default when already exposed by browser
  APIs and aligned with existing SDK privacy rules.
- Do not collect raw `lcp.target` by default. It is a selector, can be unstable,
  and can reveal application structure or sensitive identifiers.
- Collect `lcp.url` only through the same URL sanitization policy used elsewhere
  in RUM. At minimum, strip query strings and fragments before export.
- Allow raw target/resource identifiers only behind explicit configuration for
  customers who accept the privacy tradeoff.

### 2. Fix lifecycle and repeated metric reporting

Switching to attribution does not by itself fix lifecycle reporting. The SDK
should also revisit the per-metric `reported[name]` dedupe so it can safely
emit later LCP reports when `web-vitals` provides meaningful updates (most
relevantly after BFCache restore, where `web-vitals` re-fires `onLCP` with a
new metric ID and `navigationType = 'back-forward-cache'`).

Recommended behavior:

- Preserve the default low-volume behavior for production.
- Allow updated LCP reports after BFCache restore and configured
  `reportAllChanges` updates.
- Include enough identity on repeated metric spans to let the backend dedupe
  or replace prior values when appropriate. The canonical `web-vitals` fields
  are:
  - `webvitals.metric_id` from `metric.id` — stable identifier per page
      lifecycle; changes after BFCache restore.
  - `webvitals.delta` from `metric.delta` — the change since the last report
      for this `id`.
  - `webvitals.navigation_type` from `metric.navigationType` — one of
      `navigate`, `reload`, `back-forward`, `back-forward-cache`,
      `prerender`, `restore`.

                  These apply equally to CLS and INP and should be added uniformly to all
                  `webvitals` spans, not just LCP.

### 3. Correlate LCP with existing spans

Once we have `lcpResourceEntry` and sanitized `lcp.url`, correlate the LCP event
with:

- `documentFetch`
- `documentLoad`
- matching `resourceFetch`, preferably through the resource entry and otherwise
  through sanitized/canonical URL matching
- overlapping `longtask` spans
- fetch/XHR spans linked to server traces

This lets the backend or UI answer "which span likely explains this LCP?"
without relying only on manual waterfall inspection.

### 4. Add low-risk root cause tags

Add derived attributes or backend-side classifications such as:

- `lcp.phase_dominant = ttfb | resource_load_delay | resource_load_duration | element_render_delay`
- `lcp.possible_cause = high_ttfb | late_resource_discovery | slow_resource | main_thread_blocked | unknown`
- `lcp.has_lcp_resource = true | false`
- `lcp.longtask_overlap_ms` — total long-task time overlapping the LCP window
- `lcp.blocking_time_ms` — blocking time before LCP derived from `longtask`
  spans; exact FCP-to-LCP TBT needs FCP collection
- `lcp.cross_origin_timing_limited = true | false`

These should be framed as signals or likely causes, not absolute truth.

### 5. Add Long Animation Frame instrumentation (planned)

Long Animation Frame (`PerformanceLongAnimationFrameTiming`) is on the
near-term roadmap and is the highest-leverage addition for Element Render
Delay RCA. Once it lands it will give us per-frame `renderStart`, `styleAndLayoutStart`, and per-script source URL / duration, which closes
the script/function-level attribution gap that Long Tasks alone cannot
provide. Correlating LoAF entries to the LCP window will let us answer "which
script blocked rendering?" rather than just "the main thread was blocked."

### 6. Encourage server and CDN headers

For better diagnosis, recommend customers expose:

- `Server-Timing` for backend, edge, cache, and application phases, plus SDK
  mapping if those phase values should become RUM attributes.
- `Timing-Allow-Origin` on CDN-hosted LCP images, fonts, and other critical
  resources.
- Cache status headers where available, ideally normalized into RUM attributes.

## Conclusion

The four phases are correct and are the right way to structure LCP RCA.
They are measurable through browser APIs and already exposed by the
`web-vitals` attribution build.

In Splunk OTel JS Web today, we can detect the LCP value, document timing,
resource timing, fetch/XHR timing, long tasks, and SPA route completion. That
lets us diagnose several classes of problems, especially high TTFB, slow
resources, and main-thread blocking.

However, we cannot reliably explain an individual poor LCP event today because
we do not yet collect LCP attribution. Without the LCP element, resource URL,
resource entry, and subpart timings, many root causes remain manual inference.

The recommended next step is to add LCP attribution to `webvitals` spans, then
layer small derived root-cause heuristics on top of the existing document,
resource, and long-task spans.

## References

- [web.dev: Optimize Largest Contentful Paint](https://web.dev/articles/optimize-lcp)
- [web-vitals attribution docs](https://www.npmjs.com/package/web-vitals)
- [MDN: LargestContentfulPaint](https://developer.mozilla.org/en-US/docs/Web/API/LargestContentfulPaint)
- [MDN: PerformanceResourceTiming](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceResourceTiming)
- Local SDK: `packages/web/src/instrumentations/splunk-webvitals-instrumentation.ts` —
  `SplunkWebVitalsInstrumentation.enable` (registers `onLCP`/`onCLS`/`onINP`)
  and `SplunkWebVitalsInstrumentation.reportMetric` (writes the metric value
  onto a `webvitals` span).
- Local SDK: `packages/web/src/instrumentations/splunk-document-load-instrumentation.ts` —
  emits `documentFetch` and `documentLoad` spans from Navigation Timing.
- Local SDK: `packages/web/src/instrumentations/splunk-post-doc-load-resource-instrumentation.ts` —
  emits selected `resourceFetch` spans after document load.
- Local SDK: `packages/web/src/instrumentations/splunk-long-task-instrumentation.ts` —
  `SplunkLongTaskInstrumentation._createSpanFromEntry` (writes
  `longtask.attribution.*` from `PerformanceLongTaskTiming.attribution`).
- Local SDK: `packages/web/src/instrumentations/splunk-user-interaction-instrumentation.ts` —
  emits `routeChange` spans for SPA soft navigations.
- Local SDK: `packages/web/src/servertiming.ts` — parses `Server-Timing`
  traceparent hints for backend correlation.
