# INP Root Cause Detectability in OTel RUM

## Summary

The three INP phases used as the starting point for this RCA are correct. They
match Chrome's recommended INP breakdown:

1. Input Delay
2. Processing Duration
3. Presentation Delay

"Processing Time" (as it sometimes appears in internal write-ups) maps to the
canonical `web-vitals` / Chrome name "Processing Duration." No phase is
missing.

The key answer is that browser APIs can surface the INP interaction and phase
timings programmatically, but root cause detection varies by cause:

- Some supporting signals are directly measurable today in Splunk OTel JS Web
  RUM.
- Some likely causes are indirectly inferable today from interaction,
  long-task, resource, fetch, and XHR spans, but not tied to the final INP
  candidate without attribution.
- Some require INP attribution, Long Animation Frame timing, CLS attribution,
  framework/app marks, backend trace correlation, or product-side heuristics.

The most important current gap is INP attribution. The SDK currently imports
the standard `web-vitals` build and reports only the metric value on
`webvitals` spans. Once we switch to `web-vitals/attribution`, we can collect
the INP interaction target, interaction type, interaction timestamp, phase
timings, processed Event Timing entries, load state, and Long Animation Frame
summaries when the browser supports them.

The second important gap is that current interaction spans are app-event spans,
not INP candidate spans. They are useful for correlating handlers and child
fetch/XHR work, but they do not by themselves identify the page's INP
interaction or explain the browser's input delay, processing duration, and
presentation delay.

### INP thresholds

| Rating            | INP value                |
| ----------------- | ------------------------ |
| Good              | `<= 200ms`               |
| Needs improvement | `> 200ms` and `<= 500ms` |
| Poor              | `> 500ms`                |

Field-data convention (matching CrUX and `web-vitals` reporting) is to evaluate
these thresholds against the p75 of INP across page loads. INP is page-lifetime
based, not per-interaction: `web-vitals` reports the highest qualifying
interaction latency observed so far, and updates it as worse interactions
occur. BFCache restores are a lifecycle exception: `web-vitals` creates a new
metric instance with a new metric ID and `navigationType = back-forward-cache`.

### TL;DR by phase

| Phase               | Detectable today                                                                                                     | Unlocked by INP attribution (`web-vitals/attribution`)                                                        | Needs additional APIs / app cooperation                                                           |
| ------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Input Delay         | Long tasks, page-load resource activity, and prior interaction spans as candidate context, but not tied to final INP | `inputDelay`, `interactionTime`, `interactionType`, `interactionTarget`, `loadState`, processed event entries | LoAF for script attribution; task attribution heuristics; app marks for scheduled work            |
| Processing Duration | Synchronous duration of patched app event listeners; child fetch/XHR span links as interaction context               | `processingDuration`, processed Event Timing entries, phase-dominant classification                           | LoAF script attribution; framework render marks; explicit custom spans around expensive handlers  |
| Presentation Delay  | Long tasks after candidate handlers, resource/route activity, and large DOM updates inferred from app behavior       | `presentationDelay`, `nextPaintTime`, LoAF totals for script/style/layout/paint where available               | LoAF instrumentation; layout/style/paint heuristics; app marks for render/hydration/state commits |

## Current SDK Signals

| Signal                                 | Present today?                        | Evidence                                                                                                                                                                                      | What it can help diagnose                                                                                                                                                                       |
| -------------------------------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| INP value                              | Yes                                   | `SplunkWebVitalsInstrumentation` calls `onINP` and stores `inp` on a `webvitals` span.                                                                                                        | Confirms poor INP, but not the reason.                                                                                                                                                          |
| INP attribution                        | No                                    | Current import is from `web-vitals`, not `web-vitals/attribution`.                                                                                                                            | Needed to identify the INP interaction target, interaction type, phase timings, Event Timing entries, and LoAF summaries.                                                                       |
| Interaction spans                      | Yes                                   | `SplunkUserInteractionInstrumentation` patches event listeners and emits spans with `event_type`, `target_element`, `target_xpath`, and click text/data attributes subject to privacy config. | Synchronous patched-listener duration, target element context, and parent context for child async work. Not equivalent to full browser interaction duration or INP attribution.                 |
| Fetch/XHR spans                        | Yes                                   | Fetch and XHR instrumentations create HTTP spans and capture `Server-Timing` traceparent hints. With `separateTraces`, they add `link.interaction.*` back to the active interaction span.     | API calls triggered from handlers, backend correlation, request/response duration, HTTP status where available.                                                                                 |
| Long tasks                             | Yes, with container-level attribution | Long task instrumentation observes `PerformanceObserver` type `longtask` and emits `longtask` spans with `longtask.attribution.*`.                                                            | Main-thread blocking during the page and near candidate interactions. Attribution is container-level, not script/function-level, and not tied to the final INP interaction without attribution. |
| Long Animation Frames                  | Not yet                               | No current LoAF instrumentation in the SDK.                                                                                                                                                   | Needed for stronger script, style/layout, and paint attribution for slow interactions.                                                                                                          |
| Resource timing                        | Yes                                   | `resourceFetch` spans are emitted for document-load resources and selected post-load resources.                                                                                               | Script/image/CSS loading around candidate interactions, especially during page load. Cross-origin details need `Timing-Allow-Origin`.                                                           |
| CLS value                              | Yes                                   | `SplunkWebVitalsInstrumentation` calls `onCLS` and stores `cls` on a `webvitals` span.                                                                                                        | Confirms poor CLS, but not which element shifted or why.                                                                                                                                        |
| CLS attribution / layout-shift entries | No                                    | Current import is from `web-vitals`, not `web-vitals/attribution`, and there is no dedicated `layout-shift` instrumentation.                                                                  | Needed to identify the largest shift target/source and correlate shifts to INP presentation delay or poor visual stability.                                                                     |
| SPA route completion                   | Yes, but not INP attribution          | `routeChange` spans wait for in-flight resources and a quiet period.                                                                                                                          | Slow route transitions after interactions. Not the same as the INP candidate or next-paint timing.                                                                                              |
| Visibility/connectivity                | Optional                              | `visibility` and `connectivity` instrumentations exist but are disabled by default.                                                                                                           | Background tabs, offline periods, page lifecycle context.                                                                                                                                       |

## Phase And Root Cause Detectability

The "Can detect today?" column uses a small vocabulary:

- **Partial** — we have a related signal (e.g., synchronous listener duration
  or long task) but not the phase itself, so we can imply but not measure the
  cause.
- **Limited** — we only have weak indirect evidence (e.g., absence of long
  tasks combined with high INP).
- **Indirect** — we cannot observe the cause directly and must rely on
  unrelated context such as page metadata or known route shape.
- **Usually not part of Event Timing** — the cause exists but the browser
  does not attribute it to INP, so we should not label it as INP processing.

| Phase               | Root cause                                                                                  | Can detect today?                | What we can use today                                                                                                                                                     | Additional instrumentation needed                                                                                                                                                                                                                                                                                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Input Delay         | Main thread busy with long tasks when input occurs                                          | Partial                          | `longtask` spans around candidate interaction times; page-load resource/script activity. Without INP attribution, we do not know the final INP interaction timestamp.     | INP attribution for `interactionTime` and `inputDelay`; LoAF for script/function attribution.                                                                                                                                                                                                                                                                                             |
| Input Delay         | Script parsing/evaluation during page load                                                  | Partial                          | Long tasks during page load; document/resource spans for scripts. Without INP `loadState`, page-load correlation is heuristic.                                            | INP `loadState`; LoAF script attribution; script resource classification.                                                                                                                                                                                                                                                                                                                 |
| Input Delay         | Prior interaction still processing                                                          | Partial                          | Adjacent user-interaction spans; long tasks; synchronous patched-listener durations.                                                                                      | INP attribution plus interaction-id/time correlation across Event Timing entries.                                                                                                                                                                                                                                                                                                         |
| Input Delay         | Timer, interval, analytics, ad, or third-party callback fires before input                  | Partial                          | Long-task spans and container-level attribution can suggest competing work.                                                                                               | LoAF script attribution; app/vendor tagging; task source heuristics.                                                                                                                                                                                                                                                                                                                      |
| Input Delay         | Network callbacks or promise continuations crowd the task queue                             | Partial                          | Fetch/XHR spans ending near candidate interactions; long tasks after response callbacks.                                                                                  | LoAF/script attribution and app marks around response processing.                                                                                                                                                                                                                                                                                                                         |
| Input Delay         | Interaction occurs in iframe or embedded context                                            | Limited                          | Top-page RUM cannot see iframe interactions directly. Long-task attribution may expose container metadata, but detailed metrics require frame cooperation.                | Instrument same-origin/subframes and aggregate with `postMessage`; INP attribution within each frame; cooperation from embedded content for detailed attribution.                                                                                                                                                                                                                         |
| Processing Duration | Heavy synchronous event handler logic                                                       | Partial                          | Synchronous duration of patched listeners; long tasks during that listener.                                                                                               | INP `processingDuration`; processed Event Timing entries; LoAF longest script summary.                                                                                                                                                                                                                                                                                                    |
| Processing Duration | Framework synchronous render/re-render caused by handler                                    | Partial                          | Synchronous listener duration, long tasks, route/resource spans.                                                                                                          | Framework marks or custom spans around render/commit/hydration; LoAF script and style/layout totals.                                                                                                                                                                                                                                                                                      |
| Processing Duration | Large sort/filter/JSON parse/state update in handler                                        | Partial                          | Synchronous listener duration and long tasks.                                                                                                                             | Custom spans or LoAF script attribution to name the code path.                                                                                                                                                                                                                                                                                                                            |
| Processing Duration | Forced synchronous layout / layout thrashing                                                | Limited                          | Long tasks around candidate handlers; no direct forced-layout span today.                                                                                                 | LoAF `forcedStyleAndLayoutDuration`/style-layout totals where available; app-side marks.                                                                                                                                                                                                                                                                                                  |
| Processing Duration | Synchronous XHR or other blocking browser APIs                                              | Partial                          | Long tasks and synchronous listener duration; XHR spans may exist but sync XHR details are not explicit.                                                                  | Explicit blocking API detection or app instrumentation.                                                                                                                                                                                                                                                                                                                                   |
| Processing Duration | Awaited async network call inside handler                                                   | Usually not part of Event Timing | Fetch/XHR spans linked to the interaction can show that the handler triggered network work.                                                                               | Product heuristics must avoid claiming this as INP processing unless synchronous work blocks the next paint. The handler returns synchronously at the `await`, which closes `processingDuration`; however, synchronous work in the microtask continuation (state updates, large re-renders) that runs before the next paint shows up in `presentationDelay`, not in `processingDuration`. |
| Presentation Delay  | Large DOM update after handler                                                              | Partial                          | Synchronous listener duration, long tasks after candidate handlers, route/resource activity.                                                                              | INP `presentationDelay`; LoAF style/layout/paint totals; app render/commit marks.                                                                                                                                                                                                                                                                                                         |
| Presentation Delay  | Style recalculation/layout/paint is expensive                                               | Limited                          | Long tasks may show main-thread congestion, but not style/layout/paint breakdown or the INP presentation window.                                                          | LoAF `totalStyleAndLayoutDuration`, `totalPaintDuration`, and script summaries.                                                                                                                                                                                                                                                                                                           |
| Presentation Delay  | ResizeObserver, IntersectionObserver, or `requestAnimationFrame` callbacks run before paint | Limited                          | Long tasks after candidate handler completion.                                                                                                                            | LoAF attribution and app marks.                                                                                                                                                                                                                                                                                                                                                           |
| Presentation Delay  | SPA route change rebuilds a large view                                                      | Partial                          | `routeChange` spans, resource spans, long tasks, interaction spans. Without INP attribution, this is route-feedback context rather than confirmed INP presentation delay. | Correlate `routeChange` to INP attribution window; framework route/render marks.                                                                                                                                                                                                                                                                                                          |
| Presentation Delay  | Layout shift or unstable content changes after interaction                                  | Partial for CLS value only       | Existing `cls` value can show visual instability at page level.                                                                                                           | CLS attribution and layout-shift entries; correlation between shift time and INP presentation window.                                                                                                                                                                                                                                                                                     |
| Presentation Delay  | Compositor/GPU/raster work delays the frame                                                 | Limited                          | Large presentation delay with little long-task evidence may imply off-main-thread paint/composite cost.                                                                   | LoAF paint totals where available; browser support is required.                                                                                                                                                                                                                                                                                                                           |
| Presentation Delay  | Very large DOM or complex CSS selectors                                                     | Indirect                         | High presentation delay plus long tasks and known page context.                                                                                                           | DOM size/style complexity metadata from app or optional DOM scan; LoAF style/layout totals.                                                                                                                                                                                                                                                                                               |

## What Browser APIs Can Surface

### Direct INP phase timing

INP is built on the Event Timing API. `PerformanceEventTiming` exposes
timestamps such as:

- `startTime`
- `processingStart`
- `processingEnd`
- `duration`
- `interactionId`
- `target`

From these, for the interaction's first event entry, input delay is
`processingStart - startTime`, synchronous event processing is
`processingEnd - processingStart`, and the remaining time to the next paint
is presentation delay. An INP interaction can include several event entries
(`pointerdown` / `pointerup` / `click`), so the canonical phase math is over
the grouped entries, not a single row — which is why we should prefer the
`web-vitals/attribution` fields below over computing this ourselves.

The `web-vitals` attribution build already exposes the higher-level INP
fields we want:

- `interactionTarget`
- `interactionTime`
- `interactionType`
- `nextPaintTime`
- `processedEventEntries`
- `inputDelay`
- `processingDuration`
- `presentationDelay`
- `loadState`
- `longAnimationFrameEntries`
- `longestScript`
- `totalScriptDuration`
- `totalStyleAndLayoutDuration`
- `totalPaintDuration`
- `totalUnattributedDuration`

That means we do not need to invent the phase math. We should prefer
`web-vitals/attribution` and map a privacy-reviewed subset onto spans.

### Long tasks and Long Animation Frames

Long Tasks show that the main thread was blocked for more than 50 ms. The SDK
already emits `longtask` spans and can correlate them by timestamp to the INP
window. This is enough to say "the main thread was busy," but not always enough
to say which script or function caused it.

Long Animation Frame timing gives better attribution for slow frames. When
available, it can expose script entries and style/layout timing for animation
frames that overlap the INP window. `web-vitals` 5.2.0 already includes LoAF
summaries in INP attribution when the browser provides the underlying entries.

### Network calls

What we surface today:

- Fetch/XHR spans that start during or just after the interaction can be listed.
- Existing context propagation can link child fetch/XHR spans to interaction
  spans, or record `link.interaction.*` when `separateTraces` is enabled.
- Backend traces can be correlated through trace context and `Server-Timing`
  traceparent hints.

### Common misinterpretation: "slow fetch caused poor INP"

Asynchronous network latency is not automatically part of INP. INP measures
the next paint after the interaction's event processing. If a click starts
`fetch()` and the browser paints a loading state immediately, the slow
network request does not hurt INP. If the UI waits to update until after the
response and synchronous response processing blocks the next paint, then the
root cause is usually delayed rendering, response processing, or missing
immediate feedback rather than "network time" alone.

The product RCA layer should therefore not label an INP regression as
network-bound purely because a long fetch is linked to the interaction; it
should require evidence of synchronous work between response and next paint
(long tasks, LoAF script entries, or app render marks in the presentation
window).

### Frame and cross-origin limitations

Several limitations cut across INP, LoAF, layout-shift, iframe content, and
resource timing at once. They are worth treating as a single class when
designing correlation and UI:

- The `web-vitals` library and the underlying JavaScript APIs do not measure
  iframe content from the top page, even for same-origin iframes. Same-origin
  frames can be measured only by running instrumentation in each frame and
  aggregating results in the parent page.
- User-perceived field data such as CrUX may include iframe contributions that
  top-page JavaScript RUM cannot see. This can create expected differences
  between browser/RUM measurements and CrUX.
- INP can be affected by interactions in embedded content, but JavaScript-level
  attribution (target, script source) is not available to the top page without
  frame cooperation.
- The Layout Instability API does not reliably expose layout shifts inside
  cross-origin iframes to the top page's JavaScript, even though users still
  perceive those shifts and CrUX may include them.
- Long Animation Frame entries from cross-origin iframes are not exposed to
  the top page.
- Cross-origin resource timing details (transfer size, server timing,
  response start) require `Timing-Allow-Origin` on the resource.
- Long-task `attribution` is container-level, so iframe long tasks appear
  but are not attributed to specific frame scripts.

These should be reflected in confidence scoring in the RCA layer rather than
treated as bugs to fix in the SDK.

## SDK Signals Versus Product RCA

It helps to separate two responsibilities:

- **SDK collection:** capture accurate, privacy-reviewed facts from browser
  APIs and attach them to spans or events. Examples: INP phase timings,
  interaction type, sanitized target, processed event entry summaries,
  overlapping long tasks, LoAF summaries, and linked fetch/XHR spans.
- **Product RCA:** correlate those signals across spans, traces, sessions,
  route changes, backend traces, and UI metadata to explain the likely cause.
  Examples: "INP was dominated by input delay from a long task," "the handler
  spent 380 ms in synchronous processing," or "presentation delay was dominated
  by style/layout work."

The SDK should avoid claiming a root cause when the browser only provides a
symptom. It should emit precise facts and low-risk derived signals. The product
or backend can then apply heuristics, show confidence, and combine browser
data with server/CDN/app context.

## What We Can Detect Today

### Strong today

- Whether a page has poor INP.
- Whether synchronous patched app event listeners are slow.
- Which patched event type and element/xpath produced a user-interaction span.
- Whether fetch/XHR work was triggered from an active interaction span.
- Whether backend trace correlation is available through propagated trace
  context or `Server-Timing`.
- Whether long tasks happened during the page or near candidate app
  interactions.
- Whether the page has poor CLS as a page-level score.

### Partial today

- Whether a candidate slow interaction likely happened during page load, by
  correlating app interaction and long-task timestamps to document/resource
  spans.
- Whether a prior interaction or timer likely delayed the next interaction.
- Whether route changes or API calls after an interaction likely contributed to
  slow feedback.
- Whether presentation delay is likely, by finding a high INP value with no
  matching long synchronous listener duration and long tasks after candidate
  handlers.
- Whether cross-origin or iframe work is involved, through long-task container
  attribution.

### Not reliable today

- Which interaction was the final INP candidate.
- The INP interaction target/type/timestamp from browser attribution.
- The three INP phase values on the RUM event.
- Which Event Timing entries made up the INP interaction.
- Whether the dominant cause was input delay, processing duration, or
  presentation delay.
- Which script/function caused the blocking work.
- Whether style/layout/paint, rather than JS, caused presentation delay.
- Which element/source caused the largest CLS contribution.
- Whether CLS happened inside a cross-origin iframe.

## Missing Aspects Beyond The Three INP Phases

The three phases are the right timing model, but useful RCA also needs context
that does not fit cleanly into one phase:

- **Interaction identity:** target selector, target element metadata,
  interaction type, route, and whether the target was removed after the
  interaction.
- **Interaction eligibility:** INP focuses on qualifying pointer and keyboard
  interactions. Hover, scroll, drag, and continuous gestures need separate UX
  treatment.
- **Load state:** interactions during `loading` or `dom-interactive` often
  suffer from startup script evaluation and hydration.
- **Frame context:** Top-page JavaScript RUM cannot measure iframe content
  directly, even for same-origin iframes. Same-origin frames require their own
  instrumentation plus parent-frame aggregation. Cross-origin embedded content
  requires cooperation from that content. See the "Frame and cross-origin
  limitations" callout above for the full set of cross-frame caveats that apply
  to INP, LoAF, layout shift, and resource timing together.
- **Immediate feedback:** a slow backend request is less harmful to INP if the
  page paints quick feedback. Lack of optimistic/loading UI often appears as
  presentation delay or slow route feedback.
- **Device capability:** low-end CPU, memory pressure, battery saver, and
  thermal throttling often amplify input delay and presentation delay.
- **BFCache and lifecycle:** `web-vitals` may invoke metric callbacks multiple
  times during a page lifetime, including on visibility changes and after
  BFCache restores. With `reportAllChanges: true`, it can also report metric
  increases before page hide. The SDK currently suppresses repeated reports per
  metric name via a `reported[name]` map. Combined, this means today the SDK
  can miss post-BFCache restore INP for the same page, intermediate INP updates
  during long sessions, and INP/CLS changes for "second SPA visits" within one
  app instance.
- **Privacy and selector stability:** interaction targets, text, URLs, and DOM
  attributes must follow existing privacy defaults and avoid unstable or
  sensitive identifiers.

## Missing CLS Aspects

Akshit's question also asks about missing causes for poor CLS. The current SDK
can report `cls`, but cannot explain the largest shift without attribution.

Common CLS causes that should be represented in RCA:

- Images or videos without reserved dimensions or `aspect-ratio`.
- Ads, embeds, iframes, and widgets without reserved space.
- Dynamically injected content above existing content, including banners,
  consent prompts, personalization, recommendations, and live feeds.
- Containers that collapse when an ad or async widget returns no content.
- Web fonts causing FOUT/FOIT or fallback font metric mismatch.
- SPA route transitions, hydration, A/B tests, or client-side rendering that
  insert or resize content after initial paint.
- Animations or transitions that change layout-affecting properties such as
  `top`, `left`, `width`, `height`, or margins instead of using transforms.
- Virtualized lists or infinite-scroll content that recalculates item heights.
- Responsive breakpoint changes, scrollbar appearance, or viewport-dependent
  UI that changes dimensions after load.

Lifecycle considerations that are not CLS causes themselves but amplify
perceived layout instability:

- BFCache ineligibility causing users to re-experience avoidable load shifts
  on back/forward navigation.
- SPA "second visit" rendering where the SDK's per-name dedupe of metric
  reports prevents updated CLS or INP from being captured for the same page
  instance.

Browser APIs can help:

- `layout-shift` PerformanceObserver entries expose shift time, value,
  `hadRecentInput`, and `sources`.
- `web-vitals/attribution` exposes `largestShiftTarget`,
  `largestShiftTime`, `largestShiftValue`, `largestShiftEntry`,
  `largestShiftSource`, and `loadState`.

The cross-origin iframe limitation that affects layout-shift attribution is
covered in the "Frame and cross-origin limitations" callout above; it
applies symmetrically here.

## Suggested Next Builds

### 1. Add INP attribution to `webvitals` spans

Switch INP collection to `web-vitals/attribution` and add privacy-reviewed
attributes that come directly from the attribution build:

- `inp.input_delay`
- `inp.processing_duration`
- `inp.presentation_delay`
- `inp.interaction_time`
- `inp.interaction_type`
- `inp.load_state`
- `inp.next_paint_time`
- `inp.interaction_target`, only behind safe selector generation and privacy
  controls

Derived/classified attributes such as `inp.phase_dominant` and
`inp.possible_cause` belong in build #4, not here, because they are
heuristics layered on top of these raw fields.

Recommended privacy default:

- Collect numeric phase timings by default.
- Collect interaction type and load state by default.
- Do not collect raw target selectors by default unless the generated target is
  privacy-reviewed and configurable.
- Keep processed event entries summarized by default. Raw entries can be large
  and can contain target references.

Note: switching the import from `web-vitals` to `web-vitals/attribution`
also unlocks LCP attribution (`target`, `url`, `timeToFirstByte`,
`resourceLoadDelay`, `resourceLoadDuration`, `elementRenderDelay`) at no extra
cost. The team should decide in this same pass whether to capture a
privacy-reviewed subset of LCP attribution rather than leaving it for a
separate change.

Before finalizing the `inp.*` names above, check the current OpenTelemetry
browser/web semantic conventions. Where semconv covers a field, use it
directly; reserve the custom `inp.*` namespace only for INP-specific phase
timings and identifiers that have no semconv equivalent. The same principle
applies to LCP and CLS attribute naming.

### 2. Fix lifecycle and repeated metric reporting

Switching to attribution does not by itself fix lifecycle reporting. The SDK
should also revisit the per-metric `reported[name]` dedupe so it can safely
emit later INP reports when `web-vitals` provides meaningful updates.

Recommended behavior:

- Preserve the default low-volume behavior for production.
- Allow updated INP reports after BFCache restore, visibility/page-hide
  reporting, and configured `reportAllChanges` updates.
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

                  These apply equally to LCP and CLS and should be added uniformly to all
                  `webvitals` spans, not just INP.

- Avoid reporting every interaction as INP. `reportAllChanges` reports only
  metric increases (each new highest qualifying interaction latency), not
  every input, and the SDK should preserve that distinction.

### 3. Correlate INP with existing spans

Once we have `interactionTime`, `nextPaintTime`, and phase timings, correlate
the INP event with:

- nearest matching user-interaction span by time, event type, and target
- overlapping `longtask` spans
- LoAF entries and script/style/layout/paint totals
- fetch/XHR spans linked to the interaction or starting inside the interaction
  window
- route changes starting near the interaction
- CLS/layout-shift entries during the presentation window

This lets the backend or UI answer "which span likely explains this INP?"
without relying only on manual session waterfall inspection.

### 4. Add low-risk root cause tags

Add derived attributes or backend-side classifications such as:

- `inp.phase_dominant = input_delay | processing_duration | presentation_delay`
- `inp.possible_cause = main_thread_busy | slow_handler | style_layout_work | paint_composite_work | slow_route_feedback | unknown`
- `inp.longtask_overlap_ms`
- `inp.longtask_before_processing_ms`
- `inp.longtask_during_processing_ms`
- `inp.longtask_after_processing_ms`
- `inp.fetch_xhr_count_after_interaction`
- `inp.route_change_nearby = true | false`
- `inp.cls_nearby = true | false`
- `inp.loaf_total_script_duration`
- `inp.loaf_total_style_layout_duration`
- `inp.loaf_total_paint_duration`

These should be framed as signals or likely causes, not absolute truth.

### 5. Add Long Animation Frame instrumentation (planned)

LoAF is the highest-leverage addition for INP RCA because it can identify
script, style/layout, and paint work in the frames that matter. Even if we use
`web-vitals/attribution` for INP summaries, dedicated LoAF spans would help
session waterfalls explain slow interactions outside the final INP candidate.
This is the same LoAF instrumentation called out in
[`lcp-rum-root-cause-analysis.md` § Suggested Next Builds → 5](./lcp-rum-root-cause-analysis.md#5-add-long-animation-frame-instrumentation-planned);
treat as one shared SDK addition rather than two separate efforts.

### 6. Add CLS attribution

CLS attribution is covered in detail in
[`cls-rum-root-cause-analysis.md` § Suggested Next Builds](./cls-rum-root-cause-analysis.md#suggested-next-builds).
Because poor INP presentation delay and poor CLS frequently share rendering
causes (large DOM updates, hydration, route transitions, ad/widget insertion,
layout-property animations), the team should land CLS attribution in the same
pass as INP attribution rather than in a separate change. See the
[CLS And INP Overlap](./cls-rum-root-cause-analysis.md#cls-and-inp-overlap)
section for the shared causes.

### 7. Encourage app and backend marks

For better diagnosis, recommend customers or framework integrations expose:

- custom spans around expensive event handlers, render commits, hydration, and
  route transitions
- immediate-feedback marks for interactions that trigger slow backend work
- `Server-Timing` for API/backend phases
- `Timing-Allow-Origin` for critical cross-origin resources
- stable, privacy-safe component IDs for key UI controls

## Conclusion

The three INP phases are the right model for RCA and are already exposed by
the `web-vitals` attribution build. The blocking gap in Splunk OTel JS Web
today is that we do not collect INP attribution, so the INP interaction
target, phase timings, Event Timing entries, and LoAF summaries are
unavailable to the backend.

The recommended next step is to switch to `web-vitals/attribution`, add the
attribution-derived attributes from build #1, and fix repeated lifecycle
reporting from build #2. Then layer timestamp-based correlation (build #3) and
conservative RCA tags (build #4) on top of existing interaction, long-task,
fetch/XHR, resource, and route signals. CLS attribution and LoAF
instrumentation should follow in the same pass or shortly after, because poor
presentation delay and poor CLS often share layout/rendering causes.

## References

- [web.dev: Optimize Interaction to Next Paint](https://web.dev/articles/optimize-inp)
- [web.dev: Find slow interactions in the field](https://web.dev/articles/find-slow-interactions-in-the-field)
- [web.dev: Optimize Cumulative Layout Shift](https://web.dev/articles/optimize-cls)
- [web-vitals attribution docs](https://github.com/GoogleChrome/web-vitals)
- [MDN: PerformanceEventTiming](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceEventTiming)
- [MDN: LayoutShift](https://developer.mozilla.org/en-US/docs/Web/API/LayoutShift)
- Local SDK: `packages/web/src/instrumentations/splunk-webvitals-instrumentation.ts` —
  imports `onCLS`/`onINP`/`onLCP` from the standard `web-vitals` build, not
  `web-vitals/attribution`. `SplunkWebVitalsInstrumentation.enable` registers
  `onINP`; `SplunkWebVitalsInstrumentation.reportMetric` writes only the
  metric value onto a `webvitals` span and dedupes per name via
  `reported[name]`.
- Local SDK: `packages/web/src/instrumentations/splunk-user-interaction-instrumentation.ts` —
  `SplunkUserInteractionInstrumentation._emitRouteChangeSpan` emits SPA
  `routeChange` spans. User-interaction spans are emitted via the upstream
  listener patches.
- Local SDK: `packages/web/src/upstream/user-interaction/instrumentation.ts` —
  wraps `addEventListener` and records interaction target/event attributes.
- Local SDK: `packages/web/src/instrumentations/splunk-long-task-instrumentation.ts` —
  `SplunkLongTaskInstrumentation._createSpanFromEntry` emits `longtask` spans
  with container-level `longtask.attribution.*` from
  `PerformanceLongTaskTiming`.
- Local SDK: `packages/web/src/instrumentations/splunk-fetch-instrumentation.ts` —
  captures `Server-Timing` traceparent hints on fetch spans via
  `applyCustomAttributesOnSpan`.
- Local SDK: `packages/web/src/instrumentations/splunk-xhr-instrumentation.ts` —
  records `link.interaction.spanId` / `link.interaction.traceId` when
  `separateTraces` is enabled.
- Local SDK: `packages/web/src/instrumentations/splunk-post-doc-load-resource-instrumentation.ts` —
  `SplunkPostDocLoadResourceInstrumentation._createSpan` emits selected
  post-load `resourceFetch` spans.
