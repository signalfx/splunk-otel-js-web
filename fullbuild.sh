#!/bin/bash
set -e
rm -f dist/*
npm install
npm run lint
npm test
npx rollup -c
DEBUG_BUILD=1 npx rollup -c
npx eslint --no-eslintrc --env es2015 dist/splunk-rum.js
echo ""
echo "------- Excelsior! -------"
