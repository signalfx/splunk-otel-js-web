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

const path = require('path');
const fs = require('fs');

const appRoot = process.cwd();
const packageJsonUrl = path.join(appRoot, 'package.json');
const { version } = require(packageJsonUrl);

const versionFileUrl = path.join(appRoot, 'src', 'version.ts');
const versionFileContent = fs.readFileSync(versionFileUrl).toString();

const hasMatchingInternalVersion = versionFileContent.indexOf(`export const VERSION = '${version}';`) > -1;
if (!hasMatchingInternalVersion) {
  console.error('The version in src/version.ts does not match the package version.');
  process.exitCode = 1;
}
