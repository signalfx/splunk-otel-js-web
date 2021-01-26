# Building, testing and contributing to splunk-browser-otel-js
## Building, preamble
This repo makes use of git submodules to pull in the latest otel-js and otel-js-contrib code.  In time, we may move to only using
published versions.  Meanwhile, do not modify anything in the deps/ directory once you've updated the submodules.  We want to make
direct contributions to otel upstream.

```bash
$ git submodule update --init --recursive # one-time
$ git submodule update --recursive # every time you update this repo
```

## Building, for real
Build as so:

```bash
$ git submodule update
$ npm install
$ npm run lint (optional)
$ npm test (optional)
$ npx rollup -c (this produces dist/splunk-rum.js)
$ DEBUG_BUILD=1 npx rollup -c (optional; this produces dist/splunk-rum.debug.js)
$ npx eslint --no-eslintrc --env es2015 dist/splunk-rum.js (pure syntax check of dist script; optional)
```

For your convenience, the script `fullbuild.sh` runs all these steps except for the submodule update.

## Functional tests
2 nightwatch configurations are present in this repository:
1. local Selenium-based, non-parallel, multi-browser
1. remote browserstack-based, Selenium-based, semi-parallel (BrowserStack provides parallelization), multi-browser

To explore all options see `package.json`. The easiest way to start is with `npm run test:integration:local` (you need Google Chrome for this).

### Executing integration tests from your own machine
1. Copy `.env.example` as `.env`
1. Fill in `BROWSERSTACK_USER` and `BROWSERSTACK_KEY`
1. `npm run test:integration`

### SSL certs
Some of the features, we're testing for, require safe context, which means that `http://localhost` is not sufficient for these features to be enabled, and HTTPS is required. For your convenience dummy self-signed certs are provided out of the box and Selenium is configured to disable SSL verification.

### Local tunnel/proxy
By running BrowserStack-based tests you are exposing your local network to the test runner. Please see `integration-tests/utils/browserstack.runner.js` for more details.

### Safari
Requires the code below to be run once, to enable running integration tests in Safari locally.

```bash
$ /usr/bin/safaridriver --enable
```

## Releasing (During alpha/beta/preview)

1. `git checkout main && git pull`, generally clean up the workspace.
1. Run build + tests:

    ```bash
    $ git submodule update
    $ ./fullbuild.sh
    ```

1. Manual sanity test
1. `npm version patch`
1. `git push` to publish the version bump commit
1. `git push origin --tags` to publish the version tag, if you haven't created any local tags manually
1. `git push origin <release tag>` if you have local tags, which shouldn't be published
1. Release on github: <https://github.com/signalfx/rum-browser-js/releases/>
    1. "Draft a new release"
    1. Fill out the tag version.  This is confusing as github has automatically created a 
       release from the tag.  Doing this and publishing will change/overwrite the automatically
       generated one.
    1. Fill out release title, release notes
    1. Attach splunk-rum.js
    1. "Publish" the release.

### Syncing with upstream
Following an OTEL's release of either [core](https://github.com/open-telemetry/opentelemetry-js) or
[contrib](https://github.com/open-telemetry/opentelemetry-js) schedule a release of our distribution as soon as
possible.

First you need to prepare the local submodules:
1. for core do:
    1. `cd deps/opentelemetry-js`
    1. `git remote -v`
    1. ensure that a remote called `origin` is present and points to `https://github.com/signalfx/opentelemetry-js/` - exact link will depend on your if you're using http or ssh+git
    1. if you see a remote called `upstream` you are done, otherwise proceed
    1. `git remote add upstream https://github.com/open-telemetry/opentelemetry-js.git`
1. for contrib do:
    1. `cd deps/opentelemetry-js-contrib`
    1. `git remote -v`
    1. ensure that a remote called `origin` is present and points to `https://github.com/signalfx/opentelemetry-js-contrib/` - exact link will depend on your if you're using http or ssh+git
    1. if you see a remote called `upstream` you are done, otherwise proceed
    1. `git remote add upstream https://github.com/open-telemetry/opentelemetry-js-contrib.git`

Then you need to identify the list of changes to be applied:
1. identify last (the newest) tag of core and contrib - they might be different!
1. identify the last upstream commit and our patches in `deps/opentelemetry-js`
    1. `cd deps/opentelemetry-js`
    1. `git log`
    1. look for a tag in the form of `vx.x.x` (hint: `x.x.x.xxxxxx` are our tags, ignore these)
    1. write down that tag
    1. copy the list of commits above the tag - these are our patches
1. identify the last upstream commit and our patches in `deps/opentelemetry-js-contrib`
    1. steps are the same as above
1. go to <https://github.com/open-telemetry/opentelemetry-js/commits/master>
    1. in the URL, replace `master` with the last released tag, e.g. `v0.14.0`, resulting in `https://github.com/open-telemetry/opentelemetry-js/commits/v0.14.0`
    1. compare the list of commits with the list of our patches for the core repository (`opentelemetry-js`)
    1. compare by looking at commit messages and authors, commit ids will most likely be different
    1. if there's an overlap between the lists, it means that our patches were merged upstream, and we should not apply them anymore, make a note of these
1. repeat the step above for the contrib repository

You are now ready to pull from upstream:
1. For the core repository:
    1. `cd deps/opentelemetry-js`
    1. `git fetch upstream --tags`
    1. `git rebase <our last upstream tag> --onto <latest upstream tag> -i`
    1. you will be presented with a list of our patches
    1. from the list remove the lines which reference patches merged to upstream (you have written these down while identifying the list of changes to be applied)
    1. replace all instances of `pick` with `edit` - this results in stopping rebase after applying every patch, so you can ensure the patch is applied correctly
    1. save the file and close the editor, you will now begin interactive rebase-onto
    1. for every patch:
        1. check if there's merge conflicts, if so, fix them
        1. `git submodule update --recursive`
        1. `npm i && npm run test` (installation also runs build in OTEL repos)
        1. if there's test failures fix them
        1. resume rebase by following instructions in git
        1. if you're stuck, run `git status`, it displays instructions
    1. at this point, the rebase should be complete
    1. tag current commit `git tag <latest upstream tag>.<first 7 characters of HEAD commit id>`
        1. push the commit to origin `git push origin <tag id you just created>`
        1. you are publishing this tag to tell Git that it needs to store the commit you're on and make it public. Remember, you're in detached HEAD.
1. For the contrib repo:
    1. `cd deps/opentelemetry-js-contrb`
    1. repeat the other steps above
1. Changing references in the submodules will produce changes as seen from the root of the repository
1. Submit these changes as a PR or if you know what you're doing create a commit and push to `master`
1. Now proceed with regular release instructions.

```bash
$ cd deps/
$ git submodule status (review output, note the commit hash of each upstream HEAD, compare to actual remote HEAD)
$ git submodule update --remote opentelemetry-js (or -contrib)
(run tests, automated and manual sanity; adjust our code as necessary).
$ git diff
(You should see a diff showing the commit hashes changing for the submodules)
```

From here, you can commit+push like normal.

## Community Contributions

If you are not a Splunk employee and would like to contribute code to this project, please read and fill out the
[Splunk CLA](https://www.splunk.com/en_us/form/contributions.html).
