#!/bin/bash
set -e
rm -f dist/*
npm run lint
npm test
npx webpack --config webpack.dev.js
npx webpack
echo ""
echo "------- Excelsior! -------"
