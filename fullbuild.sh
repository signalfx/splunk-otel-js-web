#!/bin/bash
set -e
rm -f dist/*
npm install
npm run lint
npm test
npx rollup -c
DEBUG_BUILD=1 npx rollup -c
# syntax check the result as an extra precaution
npx eslint --no-eslintrc --env es2015 dist/splunk-rum.js
# syntax check the debug build but ignore inline eslint stuff from otel
npx eslint --no-eslintrc --no-inline-config --env es2015 dist/splunk-rum.debug.js
echo ""
echo "------- Excelsior! -------"
