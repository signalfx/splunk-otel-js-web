// This file is the webpack entry point for the browser Karma tests. It requires
// all modules ending in "test" from the current folder and all its subfolders.
const testsContext = require.context('.', true, /test$/);
testsContext.keys().forEach(testsContext);

const srcContext = require.context('.', true, /src$/);
srcContext.keys().forEach(srcContext);

