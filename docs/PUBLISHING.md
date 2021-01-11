# Publishing plan
This document outlines the plan for releasing and publishing of this package, and the reasoning behind it.

## Deferred loading considerations
In general, for every code performing instrumentation, the sooner it's loaded, the better. In the case of Browser RUM, the soonest it can be loaded is at the top of `<head>`. However, in the DOM ecosystem, every resource has a cost of loading
it.

`<script>` tags are particularly costly, as they prevent the page from being loading while they are being fetched and executed. Therefore, a regular synchronous `<script/>` at the top of `<head/>` will be the worst offender.

Depending on a type of instrumentation, there's different mechanisms to hook into it:
- error tracking - mount an event listener before the error is thrown
- Browser API calls tracing - monkey patch the relevant methods before they are called
- `Performance` events (ie. timing of resource fetches and document-load) - can be requested at any point in time after they happen
- selected resource fetching failures (such as 404) - raised as error tracking

If we delay loading (as compared to the top of `<head/>`), we will lose instrumentation data points which are only capturable when they are produced. 

### A note on instrumentation vs. application code order
We have already pointed out 3 major types of auto-instrumentation: error tracking, Browser API calls tracing, and `Performance` events. Of these, error tracking and Browser API calls tracing require, that we bootstrap auto-instrumentation before an application triggers the events.

If error tracking is bootstrapped after the application starts, then unhandled errors thrown before the bootstrapping will be lost.

If Browser API calls tracing is bootstrapped after the application starts, then we might lose data till bootstrapping is done, or we might lose all data. If the application code (or its vendor code, e.g. a framework) keeps its own reference too native code Browser API calls, then we will not be able to inject tracing, for example if an application executes a line `const addWinListener = window.addEventListener;`, then we can't ever  inject tracing into that function.

### A note on script execution order
**Regular scripts** block the page loading while they are being fetched, parsed, and executed.

**Deferred scripts** (`<script defer ... />`) are fetched and parsed in parallel with the loading of the page, and executed in order they appear in the page, after all synchronous elements of the page are processed.

**Async scripts** (`<script async ... />`) are fetched and parsed in parallel with the loading of the page, and executed whenever they are available. Execution order will depend on network conditions.

### <a name="script-placement"></a>Viable options
- option 1: `<script />` at the top of `<head />`
  - no impact on auto-instrumentation
  - impacts page loading time, however, 20kB of gzipped code (at the time of writing) can be considered negligible when served from a domain shared with other resources over an http2-class protocol
  - it will show as an issue in Lighthouse report
- option 2: `<script />` before the important application code's `<script />`
  - possibly after 3rd party scripts
  - impacts auto-instrumentation abilities:
    - non-application errors might be lost
    - resource fetching errors (e.g. 404s) might be lost
  - if served over http2 from one origin along other resources, it *should* have non-measurable impact on page loading time
  - if applications's script is not in the head, it will not show as an issue in Lighthouse report
- option 3: SDK's `<script defer />` before the application's `<script defer />`
  - same as option2
  - impact on page loading time might be smaller, depending on where application's `<script />` was placed originally

### Non-viable options
- option 1: SDK's script is async (`<script async />`)
  - auto-instrumentation is unreliable
- option 2: SDK's script is placed after the application's script
  - Browser API calls might escape tracing
  - unhandled application errors might escape tracking

## Methods based on bundling the SDK code with the app
Industry standard for publishing vendor code to be bundled with the application code is NPM (at the time of writing).

It's important that we commit to a name (including scope) and versioning scheme before we start publishing to the global registry. Therefore, an alternative, temporary solutions based on private registry are proposed below.

Publishing to public NPM registry is being discussed with the legal and devops teams, and will be added here once it's finalized.

### Temporary solution 1: private registry
NPM allows setting a registry for a given scope, which lets us set a private registry for our own use.
For more details see <https://docs.npmjs.com/cli/v6/using-npm/scope>.

An example of implementation would be placing the below code in `.npmrc`:
```
@splunk-beta:registry=https://npm.pkg.github.com/signalfx
registry=https://registry.npmjs.org/
```

It should be noted that after we deprecate the private registry, customers will have to change their dependency configuration. In addition, if a customer uses an NPM proxy, then it might be impossible for them to use our private registry.

### Temporary solution 2: git repository as an NPM dependency
NPM allows setting a git repository as a source of a package. Any handle can then be used for a version, including a commit id, branch name, or a tag.

To enable this solution, we would need to include `dist` directory in certain commits. One way of doing that is producing these commits during the release proces, and pushing them to the repository using a tag, for example `release-vX.X.X`. Such tags would be independent of the `main` branch line of commits (history).

## Methods based on a separate script tag
We have already explained the order of and where the script tags should be in the page [in this previous section](#script-placement).

To speed up loading RUM SDK script we recommend that you self-host it over http2 on the same origin as other resources. TCP connection is reused, and, because of multiplexing, the added loading time is minimal (around 20kB is very quick even on 3G).

### CDN
The easiest way to provide a CDN on our end would be a one-time setup of S3 + CloudFront. A CD build step would upload artifacts to the bucket during the release.

Along the CDN link we should provide a copy-pasteable script tag including integrity property and maybe a required CSP policy addition.

### Self-hosted
A public CDN link is sufficient for enabling this type of deployment. Such a resource can either be manually downloaded and added to a page by the customer, or it can be automatically fetched by the CD and added to the customer's release.

## Build process and artifacts
To implement all desired processes, we should produce:
- debug+source maps and non-debug compiled result files as artifacts
- TS typings for our API could be an additional artifact
- a tagged release commit, separate from `main` branch, including artifacts
- publish the archive with artifacts to NPM registry
- upload the versioned artifacts to CDN, and produce the copy-pastable script tag to load it

## Misc

### Typing
Currently the industry standard is to either provide TypeScript type definitions or not provide any type definitions.

It is likely that at some point we will add TypeScript definitions for the API of our SDK.

### 2 stage loading
For every possible loading avenue, we can make it two step, by separating the SDK code into the bootstrapping part and
the instrumentation part.

Bootstrapping part would inject the hooks and listeners and only gather raw data. Once full auto-instrumentation loaded, it would pick up the gathered data, take over and start sending the data to the beacon.

None of the existing providers offers such a solution. Due to small size of the SDK (around 20kB gzipped) it doesn't seem like an avenue worth pursuing.

### module / nomodule build 
Depending on final decided browser support, we may decide to implement <https://css-tricks.com/differential-serving/>. This mechanism lets us provide a less-transpiled (targeting higher ES version), non-polyfilled build.

This approach will bring limited benefits unless IE11 and lower starts adding a lot of dedicated code.
