## Building, preamble
This repo makes use of git submodules to pull in the latest otel-js and otel-js-contrib code.  In time, we may move to only using
published versions.  Meanwhile, do not modify anything in the deps/ directory once you've updated the submodules.  We want to make
direct contributions to otel upstream.

```
$ git submodule init   (one-time)
$ git submodule update  (every time you update this repo)
```

If these instructions do not seem to work, Follow the instructions in each repo's CONTRIBUTING.md; perhaps they've been updated.
Yes, this takes a while.

## Building, for real
Build as so:

```
$ git submodule update
$ npm install
$ npm run lint (optional)
$ npm test (optional)
$ npx rollup -c (this produces dist/splunk-rum.js)
$ DEBUG_BUILD=1 npx rollup -c (optional; this produces dist/splunk-rum.debug.js)
```


## Updating deps from upstream

Periodically this repo needs to pull in the latest from upstream (otel-js and otel-js-contrib).  I recommend doing one at a time
and testing in between to isolate things that affect us more directly.

```
$ cd deps/
$ git submodule status (review output, note the commit hash of each upstream HEAD, compare to actual remote HEAD)
$ git submodule update --remote opentelemetry-js (or -contrib)
(run tests, automated and manual sanity; adjust our code as necessary).
$ git diff
(You should see a diff showing the commit hashes changing for the submodules)
```

From here, you can commit+push like normal.


## Releasing (During alpha/beta/preview)

1. `git pull`, generally clean up the workspace.
1. Bump version in package.json: e.g., `version: "0.0.7",`
1. Run build + tests:
    ```
    $ git submodule update
    $ ./fullbuild.sh
    ```
1. Manual sanity test
1. commit + push change to package.json
1. `git tag v0.0.7`
1. `git push origin v0.0.7`
1. Release on github: https://github.com/signalfx/rum-browser-js/releases/
    1. "Draft a new release"
    1. Fill out the tag version.  This is confusing as github has automatically created a 
       release from the tag.  Doing this and publishing will change/overwrite the automatically
       generated one.
    1. Fill out release title, release notes
    1. Attach splunk-rum.js
    1. "Publish" the release.
