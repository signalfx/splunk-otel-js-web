# CLS Root Cause Detectability in OTel RUM

## Summary

The commonly cited six CLS root causes are directionally correct and cover the
most common layout instability patterns:

1. Images/media without explicit dimensions
2. Web fonts causing text reflow
3. Dynamically injected content above existing content
4. Ads/embeds without reserved space
5. Late loading dynamic content
6. Animations using layout properties

The key caveat is that browser APIs usually identify the shifted element and
the shift timing, not always the element or script that caused the shift. For
example, if a banner is inserted above an article, the Layout Instability API
may report the article element as the shifted node, even though the banner
insertion is the underlying cause. A product RCA layer can still infer the
likely cause by correlating the shift time with DOM/resource changes, route
changes, long tasks, fetch/XHR spans, and known ad/widget containers.

In Splunk OTel JS Web today, we can report the page-level `cls` value, but we
do not collect CLS attribution or raw `layout-shift` entries. That means we can
confirm poor CLS, but cannot reliably explain an individual poor CLS event
without adding attribution and correlation.

The most important current gap is CLS attribution. The SDK currently imports the
standard `web-vitals` build and reports only the metric value on `webvitals`
spans. Once we switch to `web-vitals/attribution`, we can collect the largest
shift target, largest shift time/value, largest shift entry, representative
source, and load state. For stronger RCA, we should also consider optional
`layout-shift` instrumentation so product code can correlate individual shifts
to resource loads, interactions, route changes, and async content insertion.

### CLS thresholds

| Rating            | CLS value             |
| ----------------- | --------------------- |
| Good              | `<= 0.1`              |
| Needs improvement | `> 0.1` and `<= 0.25` |
| Poor              | `> 0.25`              |

Field-data convention (matching CrUX and `web-vitals` reporting) is to evaluate
these thresholds against the p75 of CLS across page loads, not against a single
session. CLS is tracked per page lifecycle, not per SPA route, so a long SPA
session usually contributes one CLS metric instance for the hard navigation.
BFCache restores are a lifecycle exception: `web-vitals` creates a new metric
instance with a new metric ID and `navigationType = back-forward-cache`.

### TL;DR by cause

This summarizes the six commonly cited causes. The full table in
[Root Cause Detectability](#root-cause-detectability) extends this with
additional cases (route transitions, hydration, virtualized lists, sticky UI,
scrollbar/viewport changes, cross-origin iframes, etc.) called out in
[Missing Aspects](#missing-aspects-beyond-the-six-common-causes).

| Root cause                               | Detectable today                                                                                 | Unlocked by CLS attribution (`web-vitals/attribution`)                                     | Needs additional instrumentation / app cooperation                                                                                                                                     |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Images/media without explicit dimensions | Page-level CLS only; possible weak correlation with image/video `resourceFetch` timing           | Largest shifted target, representative source, shift time, and source rect movement        | DOM metadata for missing `width`/`height`/`aspect-ratio`; image/video element metadata                                                                                                 |
| Web fonts causing text reflow            | Partial through font `resourceFetch` timing if captured, but not tied to CLS                     | Shift target/time and load state, often text/container target                              | Font resource correlation; CSS/font metadata such as `font-display`, preload, fallback metrics                                                                                         |
| Dynamic content injected above content   | Partial through route/fetch/XHR/resource timing near CLS                                         | Shift target/time, representative source, and whether it happened during load or post-load | DOM mutation or app marks for insertion point, component ID, banner/widget/ad identity                                                                                                 |
| Ads/embeds without reserved space        | Partial through resource/iframe timing and long-task container attribution                       | Shift target/time and representative source around ad/embed load                           | Slot metadata, reserved-size metadata, ad response/no-fill events, iframe cooperation                                                                                                  |
| Late loading async content               | Partial through fetch/XHR/resource/route spans near the shift                                    | Shift target/time, representative source, and post-load classification                     | App marks for async content insertion, skeleton/placeholder metadata, component IDs                                                                                                    |
| Layout-property animations               | Limited; the current SDK emits only the first CLS metric report, and long tasks may be unrelated | Shift target, representative source, and sequence timing                                   | Optional per-shift entries; CSS-property heuristics on the shifted node (animating `top`/`left`/`width`/`height` vs `transform`/`opacity`); animation/transition metadata or app marks |

## Current SDK Signals

| Signal                  | Present today?                        | Evidence                                                                                                                                                                               | What it can help diagnose                                                                                                                                   |
| ----------------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CLS value               | Yes                                   | `SplunkWebVitalsInstrumentation` calls `onCLS` and stores `cls` on a `webvitals` span.                                                                                                 | Confirms poor CLS, but not the shifted element or cause.                                                                                                    |
| CLS attribution         | No                                    | Current import is from `web-vitals`, not `web-vitals/attribution`.                                                                                                                     | Needed to identify the largest shift target, representative source, largest shift value/time, and load state.                                               |
| Layout-shift entries    | No                                    | There is no dedicated `layout-shift` PerformanceObserver instrumentation in the SDK.                                                                                                   | Needed for per-shift timelines, shift clusters, source rects, and correlation to route/resource/interaction windows.                                        |
| Resource timing         | Yes                                   | `resourceFetch` spans are emitted for document-load resources and selected post-load resources. Post-load collection defaults to `img` and `script` initiator types unless configured. | Image, font, iframe, script, ad, and widget resource timing near shifts when those resources are captured. Cross-origin details need `Timing-Allow-Origin`. |
| Fetch/XHR spans         | Yes                                   | Fetch and XHR instrumentations create HTTP spans and capture `Server-Timing` traceparent hints.                                                                                        | API calls that complete shortly before content insertion or route updates that cause shifts.                                                                |
| User interaction spans  | Yes                                   | `SplunkUserInteractionInstrumentation` patches event listeners and emits spans with event and target attributes subject to privacy config.                                             | Helps separate expected interaction-driven shifts from unexpected post-interaction shifts, but does not replace `hadRecentInput`.                           |
| Long tasks              | Yes, with container-level attribution | Long task instrumentation observes `PerformanceObserver` type `longtask` and emits `longtask` spans with `longtask.attribution.*`.                                                     | JS work near a shift and iframe/container involvement. Long tasks do not prove a layout shift root cause.                                                   |
| SPA route completion    | Yes                                   | `routeChange` spans wait for in-flight resources and a quiet period.                                                                                                                   | Route transitions that insert, remove, or resize page content.                                                                                              |
| Visibility/connectivity | Optional                              | `visibility` and `connectivity` instrumentations exist but are disabled by default.                                                                                                    | Hidden tabs, lifecycle transitions, and offline periods that affect field-data interpretation.                                                              |

## Root Cause Detectability

The "Can detect today?" column uses a small vocabulary:

- **Partial** means we have related timing or span context, but not the CLS
  attribution needed to tie it to the final CLS contribution.
- **Limited** means the signal is weak and mostly useful for manual debugging.
- **No** means the current SDK does not expose enough evidence to diagnose this
  cause programmatically.

| Root cause                                                                                                  | Can detect today? | What we can use today                                                                                                                                                                                                 | Additional instrumentation needed                                                                                            |
| ----------------------------------------------------------------------------------------------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Image without `width`/`height` or CSS `aspect-ratio`                                                        | Limited           | Page-level CLS plus nearby image `resourceFetch` spans. A human may infer the cause from page knowledge.                                                                                                              | CLS attribution; optional DOM scan or element metadata for image/video dimensions and rendered rect.                         |
| Responsive image or `<picture>` source changes aspect ratio across breakpoints                              | No                | Manual debugging only.                                                                                                                                                                                                | CLS attribution plus image/source metadata, viewport size, media query/breakpoint context.                                   |
| Video, poster image, canvas, iframe, or embed without reserved dimensions                                   | Limited           | Resource timing and iframe/container long-task attribution may point at the asset/container.                                                                                                                          | CLS attribution plus element metadata for replaced elements and iframe/embed slot sizing.                                    |
| Web font swaps change text metrics                                                                          | Partial           | Font `resourceFetch` timing near a CLS report if font resources are captured.                                                                                                                                         | CLS attribution, load state, font resource correlation, `font-display`/preload/fallback metric metadata.                     |
| Font icon or icon library swaps from fallback glyphs                                                        | Limited           | Resource timing for font/css assets.                                                                                                                                                                                  | CLS attribution plus font/CSS metadata and shifted target classification.                                                    |
| Banner, alert, consent prompt, newsletter signup, or personalization content injected above visible content | Partial           | Fetch/XHR completion, route spans, resource spans, and long tasks near the CLS span.                                                                                                                                  | CLS attribution; DOM mutation/app marks for insertion point, component name, reserved-space status.                          |
| Ads with variable size, no-fill collapse, refresh, or late creative resize                                  | Partial           | Iframe/resource timing, ad-network resource URLs, long-task container attribution.                                                                                                                                    | CLS attribution; ad slot metadata, configured size mapping, no-fill/refresh events, iframe cooperation.                      |
| Third-party embeds/widgets resize after hydration or remote content load                                    | Partial           | Resource/iframe timing and container long-task attribution.                                                                                                                                                           | CLS attribution; widget/container IDs, reserved-size metadata, same-origin frame instrumentation or third-party cooperation. |
| Async content loads into a zero-height container                                                            | Partial           | Fetch/XHR span completion shortly before poor CLS; route span context.                                                                                                                                                | CLS attribution plus app marks for content insertion and placeholder/skeleton use.                                           |
| Skeleton, placeholder, or loading state has different final dimensions                                      | No                | Manual debugging only.                                                                                                                                                                                                | CLS attribution plus app metadata for placeholder and final component dimensions.                                            |
| Client-side hydration changes server-rendered layout                                                        | Partial           | Load-state context, long tasks, route/resource spans during startup.                                                                                                                                                  | CLS attribution; hydration/render marks from the app or framework integration.                                               |
| SPA route transition inserts/removes content after first paint                                              | Partial           | `routeChange`, fetch/XHR, resource, and long-task spans around route transition.                                                                                                                                      | CLS attribution; route-to-shift correlation; app route/render marks.                                                         |
| Animations/transitions change layout properties (`top`, `left`, `width`, `height`, margins)                 | Limited           | CLS value only; repeated shifts may be visible if repeated reports are enabled, but not currently emitted after the first report.                                                                                     | Per-shift `layout-shift` entries, target/source metadata, animation/property heuristics or app marks.                        |
| Virtualized list or infinite-scroll item heights are recalculated                                           | Limited           | Route/fetch/XHR timing and user interactions near the shift.                                                                                                                                                          | CLS attribution; scroll/list component metadata; item height and placeholder metadata.                                       |
| Sticky/fixed header, toolbar, cookie bar, or safe-area resize changes viewport content                      | Limited           | Visibility/route/resize context only if separately available.                                                                                                                                                         | CLS attribution; viewport/visual viewport metadata; component marks.                                                         |
| Scrollbar appearance/disappearance changes layout width                                                     | No                | Manual debugging only.                                                                                                                                                                                                | CLS attribution plus viewport/client width metadata and CSS/layout heuristics.                                               |
| Responsive breakpoint or orientation change changes dimensions unexpectedly                                 | Limited           | Viewport attributes if available elsewhere; manual debugging.                                                                                                                                                         | CLS attribution plus viewport/breakpoint metadata and component marks.                                                       |
| Browser autofill, password manager, translation, extension, or injected toolbar changes layout              | No                | Usually outside app-level observability.                                                                                                                                                                              | Some cases need browser/extension cooperation; product RCA should classify as `external` or unknown when evidence is weak.   |
| Cross-origin iframe content shifts internally                                                               | No from top page  | Top-page JS cannot see detailed shifts inside cross-origin frames. Same-origin frames can be observed if instrumented inside the frame's window. CrUX may include user-visible iframe shifts that RUM cannot measure. | Instrument the frame itself and aggregate with cooperation; cross-origin third-party content may remain opaque.              |

## What Browser APIs Can Surface

### CLS score and shift entries

CLS is based on unexpected layout shifts. The Layout Instability API exposes
`layout-shift` performance entries with:

- `startTime`
- `value`
- `hadRecentInput`
- `lastInputTime`
- `sources`

Each source can include the shifted node plus previous and current rectangles.
This is enough to identify what moved, when it moved, and the total score for
the layout-shift entry. It does not assign an exact score contribution to each
source node, and it is not always enough to identify the original cause. The RCA
layer often needs to infer causality from nearby resource loads, DOM insertion
marks, route changes, or component metadata.

CLS excludes layout shifts with recent qualifying user input. The browser
provides `hadRecentInput` for this distinction, but not all visually surprising
post-interaction shifts are excluded. For example, shifts caused by content that
loads while scrolling or hover-triggered content can still count when they are
unexpected.

### Attribution from `web-vitals`

The `web-vitals` attribution build exposes CLS attribution fields that are
better suited for RUM than raw observer entries:

- `largestShiftTarget` — generated CSS selector for the shifted node.
- `largestShiftTime` — `startTime` of the single largest shift entry.
- `largestShiftValue` — `value` of the single largest shift entry.
- `largestShiftEntry` — the raw `LayoutShift` PerformanceEntry. Do **not**
  serialize this object directly; extract only sanitized scalar fields such as
  `value`, `startTime`, and `hadRecentInput`.
- `largestShiftSource` — a representative `LayoutShiftAttribution` source from
  `largestShiftEntry.sources`, selected by the attribution helper as the first
  element source when available, otherwise the first source. It includes `node`,
  `previousRect`, and `currentRect`. Treat `node` with the same privacy controls
  as `largestShiftTarget`.
- `loadState` — one of `'loading' | 'dom-interactive' | 'dom-content-loaded' | 'complete'`,
  indicating when the largest shift occurred relative to document loading.

This means we should not invent our own CLS summary logic unless we need
details that the attribution build does not expose. A good first SDK step is to
map a privacy-reviewed subset of these fields to `webvitals` spans.

### Optional per-shift instrumentation

CLS attribution is a useful summary, but some RCA questions need the timeline:

- Was CLS caused by one large shift or many small shifts?
- Did shifts cluster during page load, after route change, or after interaction?
- Did the same target/source shift repeatedly?
- Which resource, API response, route transition, or long task occurred just
  before each shift?

For those questions, optional `layout-shift` span/event instrumentation is more
useful than only recording the final CLS summary. The SDK should keep this
separate or configurable because per-shift events can be higher volume and can
include DOM node references that require privacy controls.

## SDK Signals Versus Product RCA

It helps to separate two responsibilities:

- **SDK collection:** capture accurate, privacy-reviewed facts from browser
  APIs and attach them to spans or events. Examples: CLS value, largest shift
  time/value, sanitized target/source, load state, per-shift source rectangles,
  and `hadRecentInput`.
- **Product RCA:** correlate those facts across spans, traces, sessions, route
  changes, resources, user interactions, and app metadata to explain the likely
  cause. Examples: "CLS was dominated by an image loading without reserved
  dimensions," "a consent banner inserted above content caused a large shift,"
  or "an ad slot collapsed after no-fill."

The SDK should avoid claiming a root cause when the browser only provides a
symptom. It should emit precise facts and low-risk derived signals. Product or
backend code can then apply heuristics, show confidence, and combine browser
data with app/server/CDN context.

## What We Can Detect Today

### Confidently available today

These are context signals that are reliably emitted; they confirm symptoms or
narrow the search window for a shift, but none of them identify the shifted
element or its cause on their own.

- Whether a page has poor CLS, at page level (per page lifecycle, not per SPA
  route).
- Resource timing near page load and selected post-load resource fetches.
- Fetch/XHR timing and backend trace correlation through propagated trace
  context or `Server-Timing`.
- Long tasks near the page or route timeline, with container-level attribution.
- SPA route spans that can be manually compared with poor CLS reports.

### Partial today

- Whether an image, iframe, font, ad, or widget resource loaded near a poor CLS
  report.
- Whether a route transition or API response likely preceded layout movement.
- Whether third-party or iframe container work may be involved, through
  long-task container attribution.
- Whether page lifecycle or visibility state should be considered, if optional
  instrumentations are enabled.

### Not reliable today

- Which shifted element/source best represents the largest CLS contribution.
- Which element or script caused the shifted element to move.
- Whether CLS came from one large shift or many small shifts.
- The largest shift target, representative source, time, and value.
- Whether the shift happened during loading, after load, after route change, or
  after user interaction.
- Whether an image/video/embed was missing dimensions.
- Whether a font swap caused text reflow.
- Whether content insertion, placeholder mismatch, ad no-fill, or animation
  caused the shift.
- Whether CLS happened inside a cross-origin iframe.

## Missing Aspects Beyond the Six Common Causes

The six commonly cited causes cover the main load and post-load patterns.
Useful RCA should also represent these additional cases:

- **Route transitions and soft navigations:** SPA route changes can insert,
  remove, or resize large content regions after first paint.
- **Hydration and client-side rendering mismatch:** server-rendered layout can
  change when client code hydrates, personalizes, or replaces content.
- **Skeleton and placeholder mismatch:** reserving space is not enough if the
  placeholder height differs from final content.
- **Ad no-fill and collapse behavior:** removing reserved space when no ad is
  returned can cause CLS just like inserting an ad late.
- **Responsive and breakpoint behavior:** art-directed images, viewport changes,
  orientation changes, and breakpoint-specific content can change dimensions.
- **Virtualized or infinite-scroll lists:** recalculated item heights can shift
  large portions of visible content.
- **Sticky/fixed UI:** headers, toolbars, cookie bars, safe-area changes, and
  mobile browser chrome can move visible content.
- **Scrollbar changes:** adding/removing scrollbars can change layout width and
  trigger horizontal movement.
- **External/browser-driven changes:** password managers, translation, browser
  extensions, and injected toolbars may be visible to users but hard for app RUM
  to attribute.
- **CrUX versus RUM gaps:** CrUX can include user-visible iframe shifts that
  JavaScript RUM cannot measure from the top page.
- **Lifecycle and repeated reporting:** CLS can increase throughout the page
  lifetime and after BFCache restores. The SDK currently dedupes by metric name,
  so it can miss later CLS updates for the same page instance.
- **Privacy and selector stability:** shifted targets, source nodes, URLs, text,
  and DOM attributes must follow existing privacy defaults and avoid unstable or
  sensitive identifiers.

## CLS And INP Overlap

CLS and INP are different metrics, but poor values often share underlying
rendering causes:

- Large DOM updates can create both CLS and INP presentation delay.
- Hydration and route transitions can block the next paint and also move
  content after initial paint.
- Ads, embeds, and widgets can shift layout and run long tasks in or near
  interaction windows.
- Missing immediate feedback for an interaction can look like poor INP, while
  the later content insertion can also cause CLS.
- Layout-property animations can create CLS and add style/layout work that
  worsens INP presentation delay.
- Low-end CPU, memory pressure, and complex CSS/DOM increase the impact of both
  visual instability and slow presentation.

For RCA, the product should avoid labeling a poor INP as "caused by CLS" or a
poor CLS as "caused by INP." A better framing is that both metrics can point to
the same app behavior: expensive or unstable rendering around load, route
change, async content insertion, or interaction feedback.

## Suggested Next Builds

### 1. Add CLS attribution to `webvitals` spans

Switch CLS collection to `web-vitals/attribution` and add privacy-reviewed
attributes:

- `cls.largest_shift_value`
- `cls.largest_shift_time`
- `cls.load_state` — one of `loading`, `dom-interactive`, `dom-content-loaded`,
  `complete`.
- `cls.largest_shift_target`, only behind safe selector generation and privacy
  controls.
- summarized representative source rectangles for the largest shift, derived
  from `largestShiftSource.previousRect` and `largestShiftSource.currentRect`,
  never the raw `node` or text content. Concretely:
  - `cls.largest_shift_source.previous_rect.x`
  - `cls.largest_shift_source.previous_rect.y`
  - `cls.largest_shift_source.previous_rect.width`
  - `cls.largest_shift_source.previous_rect.height`
  - `cls.largest_shift_source.current_rect.x`
  - `cls.largest_shift_source.current_rect.y`
  - `cls.largest_shift_source.current_rect.width`
  - `cls.largest_shift_source.current_rect.height`

Before finalizing the `cls.*` names above, check the current OpenTelemetry
browser/web semantic conventions. Where semconv covers a field, use it
directly; reserve the custom `cls.*` namespace only for CLS-specific shift
identifiers and source rectangles that have no semconv equivalent. The same
principle applies to LCP and INP attribute naming.

Note: `hadRecentInput` is intentionally excluded from the summary because the
CLS metric value already excludes shifts with recent qualifying input.
`had_recent_input` is still meaningful on per-shift events (see
[Add optional `layout-shift` instrumentation](#3-add-optional-layout-shift-spanevent-instrumentation)).

Recommended privacy default:

- Collect numeric shift timing/value fields by default.
- Collect load state by default.
- Do not collect raw target selectors by default unless the generated selector
  is privacy-reviewed and configurable. A safe default form is structural only
  (e.g., `div[role=banner].promo-slot` or `main > article > img.hero`),
  truncated, and excluding `id`, `data-*`, `aria-label`, text content, and any
  attribute that may carry user data.
- Avoid collecting text content or unstable DOM attributes by default.

### 2. Fix lifecycle and repeated metric reporting

Switching to attribution does not by itself fix lifecycle reporting. The SDK
should revisit the per-metric `reported[name]` dedupe so it can safely emit
later CLS reports when `web-vitals` provides meaningful updates.

Recommended behavior:

- Preserve the default low-volume behavior for production.
- Allow updated CLS reports after page hide, BFCache restore, and configured
  `reportAllChanges` updates.
- Include enough identity on repeated metric spans to let the backend dedupe or
  replace prior values when appropriate. The canonical `web-vitals` fields are:
  - `webvitals.metric_id` from `metric.id` — stable identifier per page
      lifecycle; changes after BFCache restore.
  - `webvitals.delta` from `metric.delta` — the change since the last report
      for this `id`.
  - `webvitals.navigation_type` from `metric.navigationType` — one of
      `navigate`, `reload`, `back-forward`, `back-forward-cache`,
      `prerender`, `restore`.

                  These apply equally to LCP and INP and should be added uniformly to all
                  `webvitals` spans, not just CLS.

- Avoid treating every layout-shift entry as the final CLS metric. Per-shift
  instrumentation should be separate from metric reporting.

### 3. Add optional `layout-shift` span/event instrumentation

For stronger RCA, add optional instrumentation around
`PerformanceObserver({ type: 'layout-shift', buffered: true })` and emit
privacy-reviewed per-shift facts:

- `layout_shift.value`
- `layout_shift.start_time`
- `layout_shift.had_recent_input`
- `layout_shift.last_input_time`
- summarized source previous/current rects
- sanitized target/source identifiers where allowed

This should be configurable because per-shift entries increase event volume and
need careful privacy treatment.

### 4. Correlate CLS with existing spans

Once we have largest shift time or per-shift entries, correlate shifts with:

- matching or nearby `resourceFetch` spans for images, fonts, iframes, scripts,
  CSS, ads, and widgets
- fetch/XHR spans that complete shortly before the shift
- `routeChange` spans
- user-interaction spans and `hadRecentInput`
- overlapping or preceding `longtask` spans
- document load phases and load state
- app marks for render, hydration, ad slot fill/no-fill, banners, and async
  component insertion

This lets the backend or UI answer "which span or app event likely explains
this CLS?" without relying only on manual session inspection.

### 5. Add low-risk root cause tags

Add derived attributes or backend-side classifications such as:

- `cls.pattern = single_large_shift | many_small_shifts | repeated_target | unknown`
- `cls.possible_cause = missing_dimensions | font_reflow | injected_content | ad_embed_resize | async_content | layout_animation | route_transition | external | unknown`
  (`external` covers autofill, password managers, translation, browser
  extensions, and injected toolbars.)
- `cls.shift_count`
- `cls.largest_shift_target_type`
- `cls.nearby_resource_initiator_type`
- `cls.nearby_fetch_xhr_count`
- `cls.route_change_nearby = true | false`
- `cls.cross_origin_iframe_possible = true | false` — set when the page
  contains at least one cross-origin iframe (detected via
  `document.querySelectorAll('iframe')` filtered by same-origin check) and
  no same-origin source was attributed to the largest shift. This is a
  heuristic for "the largest shift may have happened inside or because of
  embedded content we cannot inspect."

These should be framed as signals or likely causes, not absolute truth.

### 6. Encourage app and backend marks

For better diagnosis, recommend customers or framework integrations expose:

- custom spans around route transitions, render commits, hydration, and async
  content insertion
- stable, privacy-safe component IDs for major content regions
- ad slot fill/no-fill/refresh events and configured slot sizes
- placeholder/skeleton dimensions for async components
- `Timing-Allow-Origin` for critical cross-origin images, fonts, iframes, and
  widget resources
- `Server-Timing` for API/backend phases that trigger layout changes

## Conclusion

The six commonly cited CLS root causes make sense and are a good starting
taxonomy. The main missing nuance is detectability: browser APIs can tell us
which elements moved and when, but they do not always identify the original
cause of movement.

In Splunk OTel JS Web today, we can report the CLS value and correlate it
by hand with resource, fetch/XHR, long-task, and route spans. That is useful
for investigation, but not enough for reliable programmatic RCA.

The recommended next step is to switch CLS collection to
`web-vitals/attribution`, fix repeated lifecycle reporting for CLS updates, and
then add optional `layout-shift` instrumentation for customers who want detailed
field RCA. Product-side heuristics should then correlate shift timing with
existing resource, interaction, route, long-task, and app marks to produce
confidence-scored likely causes.

## References

- [web.dev: Cumulative Layout Shift (definition and p75 framing)](https://web.dev/articles/cls)
- [web.dev: Optimize Cumulative Layout Shift](https://web.dev/articles/optimize-cls)
- [Layout Instability API specification (WICG)](https://wicg.github.io/layout-instability/)
- [`web-vitals` attribution module: `src/attribution/onCLS.ts`](https://github.com/GoogleChrome/web-vitals/blob/main/src/attribution/onCLS.ts)
- [MDN: LayoutShift](https://developer.mozilla.org/en-US/docs/Web/API/LayoutShift)
- [MDN: LayoutShift.hadRecentInput](https://developer.mozilla.org/en-US/docs/Web/API/LayoutShift/hadRecentInput)
- [MDN: LayoutShift.sources](https://developer.mozilla.org/en-US/docs/Web/API/LayoutShift/sources)
- Sibling docs: [`inp-rum-root-cause-analysis.md`](./inp-rum-root-cause-analysis.md),
  [`lcp-rum-root-cause-analysis.md`](./lcp-rum-root-cause-analysis.md)
- Local SDK: `packages/web/src/instrumentations/splunk-webvitals-instrumentation.ts:23`
  imports `onCLS`/`onINP`/`onLCP` from the standard `web-vitals` build, not
  `web-vitals/attribution`; `:89` registers `onCLS`; `:118` (`reportMetric`)
  writes only the metric value onto a `webvitals` span and dedupes per name.
- Local SDK: `packages/web/src/instrumentations/splunk-long-task-instrumentation.ts:56`
  observes `longtask` entries and emits `longtask` spans with
  `longtask.attribution.*` container metadata.
- Local SDK: `packages/web/src/instrumentations/splunk-document-load-instrumentation.ts`
  emits document-load resource spans and network timing events.
- Local SDK: `packages/web/src/instrumentations/splunk-post-doc-load-resource-instrumentation.ts:107`
  emits selected post-load `resourceFetch` spans.
- Local SDK: `packages/web/src/instrumentations/splunk-user-interaction-instrumentation.ts:207`
  emits `routeChange` spans for SPA soft navigations.
