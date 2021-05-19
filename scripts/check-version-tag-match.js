/*
Copyright 2021 Splunk Inc.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

const { exec } = require('child_process');
const path = require('path');

const appRoot = process.cwd();
const packageJsonUrl = path.resolve(`${appRoot}/package.json`);
const { version } = require(packageJsonUrl);

exec('git tag -l --contains HEAD', (err, stdout) => {
  if (err) {
    console.error('Could not acquire git tags for HEAD.');
    process.exitCode = 1;
  }

  const hasMatchingTag = stdout.split('\n').some(line => line === `v${version}`);
  if (!hasMatchingTag) {
    console.error('We could not find any matching tags for the current version.');
    process.exitCode = 1;
  }
});
