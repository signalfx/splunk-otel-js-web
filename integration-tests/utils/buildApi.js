/*
Copyright 2020 Splunk Inc.

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

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const buildIdFilePath = path.join(__dirname, '..', '..', '.nightwatch_build_id');

function sanitizeCliOut(out) {
  return out.toString().replace(/\n/g, '');
}

function generateBuildId() {
  if (fs.existsSync(buildIdFilePath)) {
    console.warn('Build ID file already exists. Please remove the existing file, before requesting a new ID.');
  }

  const commitId = process.env.CIRCLE_SHA1 || sanitizeCliOut(execSync('git rev-parse HEAD'));
  const author = process.env.CIRCLE_PR_USERNAME || sanitizeCliOut(execSync('whoami'));
  const when = new Date().toJSON();

  const buildId = `${author}-${when}-${commitId.substring(0, 8)}`;
  fs.writeFileSync(buildIdFilePath, buildId);

  return buildId;
}

function getCurrentBuildId() {
  if (!fs.existsSync(buildIdFilePath)) {
    throw new Error('Build ID file does not exist.');
  }

  return fs.readFileSync(buildIdFilePath).toString();
}

function clearBuildId() {
  if (fs.existsSync(buildIdFilePath)) {
    fs.unlinkSync(buildIdFilePath);
  }
}

module.exports = {
  generateBuildId,
  getCurrentBuildId,
  clearBuildId,
};
