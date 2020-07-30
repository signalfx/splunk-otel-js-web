## Building
Build as so:

```
$ npm install
$ npm run lint (optional)
$ npm test (optional)
$ npx webpack
# npx webpack -config webpack.dev.js (optional)
```

## Releasing (During alpha/beta/preview)

1. Bump version in package.json: e.g., `version: "0.0.7",`
1. Run build + tests:
    ```
   ./fullbuild.sh
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
