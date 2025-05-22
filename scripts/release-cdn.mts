/**
 *
 * Copyright 2020-2025 Splunk Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

import crypto from 'crypto'
import * as fs from 'fs/promises'
import * as path from 'path'
import dotenv from 'dotenv'

import {
	generateCDNLinks,
	generateScriptSnippet,
	getPositionalArguments,
	invalidateCloudFrontFiles,
	patchGithubReleaseBody,
	uploadToS3,
	getReleaseForTag,
	getAllVersions,
	getMimeType,
} from './utils/index.mjs'

const CDN_LISTED_FILES = ['splunk-otel-web.js', 'splunk-otel-web-session-recorder.js']
const ARTIFACTS_DIR = './artifacts'
const OWNER = process.env.GITHUB_OWNER ?? 'signalfx'
const REPO = process.env.GITHUB_REPO ?? 'splunk-otel-js-web'

const isDryRun = process.argv.some((arg) => arg === '--dry-run')
if (isDryRun) {
	console.log('---- DRY RUN ----')
}

dotenv.config()

const [targetVersion] = getPositionalArguments()

if (!targetVersion) {
	throw new Error('You must provide a version to release.')
}

if (!process.env.CDN_DISTRIBUTION_ID) {
	throw new Error('You are missing an environment variable CDN_DISTRIBUTION_ID.')
}

const { CDN_DISTRIBUTION_ID } = process.env

if (!process.env.CDN_BUCKET_NAME) {
	throw new Error('You are missing an environment variable CDN_BUCKET_NAME.')
}

const { CDN_BUCKET_NAME } = process.env

if (!process.env.GITHUB_TOKEN && !isDryRun) {
	throw new Error('You are missing an environment variable GITHUB_TOKEN.')
}

console.log('I will now process the files:')
const cdnLinksByVersion: Record<string, string[]> = {}

// Avoid accidental assets upload
const allowedExtensions = ['.tgz', '.js', '.js.map', '.txt']
const assets = await fs.readdir(ARTIFACTS_DIR)
const versions = getAllVersions(targetVersion)
versions.forEach((version) => {
	cdnLinksByVersion[version.name] = []
})

for (const asset of assets) {
	if (!allowedExtensions.some((ext) => asset.endsWith(ext))) {
		continue
	}

	console.log(`\t- ${asset}`)

	const assetBuffer = await fs.readFile(path.join(ARTIFACTS_DIR, asset))
	console.log('\t\t- fetched')

	const sha384Sum = crypto.createHash('sha384').update(assetBuffer).digest('base64')
	const integrityValue = `sha384-${sha384Sum}`
	console.log(`\t\t- calculated integrity ${integrityValue}`)

	for (const version of versions) {
		console.log(`\t\t\t- version: ${version.name}`)

		const key = `o11y-gdi-rum/${version.name}/${asset}`
		console.log(`\t\t\t\t- key: ${key}`)

		const publicUrl = `https://cdn.signalfx.com/${key}`
		const contentType = getMimeType(asset)

		if (!isDryRun) {
			await uploadToS3({
				key,
				bucketName: CDN_BUCKET_NAME,
				buffer: assetBuffer,
				contentType,
				isImmutable: version.isVersionImmutable,
			})
			console.log(`\t\t\t\t- uploaded as ${publicUrl}`)
		} else {
			console.log(`\t\t\t\t- would be uploaded as ${publicUrl} ${contentType}`)
		}

		if (CDN_LISTED_FILES.includes(asset)) {
			console.log('\t\t\t\t- generating script snippet')

			cdnLinksByVersion[version.name].push(
				generateScriptSnippet({
					isVersionImmutable: version.isVersionImmutable,
					filename: asset,
					integrityValue,
					publicUrl,
				}),
			)
		}
	}
}

const cdnLinks = generateCDNLinks(versions, cdnLinksByVersion)

if (!isDryRun) {
	console.log('Creating an invalidation to refresh shared versions.')
	const invalidationRef = `o11y-gdi-rum-${new Date().toISOString()}`
	const Invalidation = await invalidateCloudFrontFiles(CDN_DISTRIBUTION_ID, invalidationRef)
	console.log(`Invalidation ${Invalidation?.Id} sent. Typically it takes about 5 minutes to execute.`)
}

const semverRegex = /^v[0-9]+\.[0-9]+\.[0-9]+(-beta\.[0-9]+)?$/
if (semverRegex.test(targetVersion)) {
	const ghRelease = await getReleaseForTag(OWNER, REPO, targetVersion)
	console.log(`I have found the latest version to be: ${ghRelease.tag_name} named "${ghRelease.name}."`)

	console.log('Appending CDN instructions to release description.')
	if (!isDryRun) {
		await patchGithubReleaseBody(ghRelease, ghRelease.body + cdnLinks.join('\n'))
		console.log(`Please verify that instructions are correct by navigating to: ${ghRelease.html_url}`)
	} else {
		console.log('Following would be added to the release notes:')
		console.log('------')
		console.log(cdnLinks.join('\n'))
		console.log('------')
	}
}
