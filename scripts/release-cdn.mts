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

import dotenv from 'dotenv'
import fetch from 'node-fetch'
import {
	generateCDNLinks,
	generateScriptSnippet,
	getAssetsForRelease,
	getPositionalArguments,
	getReleaseForTag,
	invalidateCloudFrontFiles,
	patchGithubReleaseBody,
	uploadToS3,
} from './utils/index.mjs'

const OWNER = 'signalfx'
const REPO = 'splunk-otel-js-web'
const CDN_LISTED_FILES = ['splunk-otel-web.js', 'splunk-otel-web-session-recorder.js']

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

const ghRelease = await getReleaseForTag(OWNER, REPO, targetVersion)
console.log(`I have found the latest version to be: ${ghRelease.tag_name} named "${ghRelease.name}."`)

const assets = await getAssetsForRelease(OWNER, REPO, ghRelease.id)
console.log(`This release has ${assets.length} release artifacts: ${assets.map(({ name }) => name).join(', ')}.`)

const versions = Array.from(generateAllVersions(ghRelease.tag_name))
console.log(`This release will update following versions in CDN: ${versions.map(([version]) => version).join(', ')}`)

console.log('I will now process the files:')
const cdnLinksByVersion: Record<string, string[]> = {}

versions.forEach(([version]) => {
	cdnLinksByVersion[version] = []
})

for (const asset of assets) {
	const filename = asset.name
	console.log(`\t- ${filename}`)
	console.log(`\t\t- fetching from ${asset.browser_download_url}.`)

	const response = await fetch(asset.browser_download_url)
	const assetBuffer = await response.buffer()
	console.log('\t\t- fetched')

	const sha384Sum = crypto.createHash('sha384').update(assetBuffer).digest('base64')
	const integrityValue = `sha384-${sha384Sum}`
	console.log(`\t\t- calculated integrity ${integrityValue}`)

	for (const [version, isAutoUpdating] of versions) {
		console.log(`\t\t\t- version: ${version}`)

		const key = `o11y-gdi-rum/${version}/${filename}`
		console.log(`\t\t\t\t- key: ${key}`)

		const publicUrl = `https://cdn.signalfx.com/${key}`
		if (!isDryRun) {
			await uploadToS3(key, CDN_BUCKET_NAME, assetBuffer, { contentType: asset.content_type })
			console.log(`\t\t\t\t- uploaded as ${publicUrl}`)
		} else {
			console.log(`\t\t\t\t- would be uploaded as ${publicUrl}`)
		}

		if (CDN_LISTED_FILES.includes(asset.name)) {
			console.log('\t\t\t\t- generating script snippet')

			cdnLinksByVersion[version].push(
				generateScriptSnippet({ isVersionMutable: !isAutoUpdating, filename, integrityValue, publicUrl }),
			)
		}
	}
}

const cdnLinks = generateCDNLinks(versions, cdnLinksByVersion)

if (isDryRun) {
	console.log('Following would be added to the release notes:')
	console.log('------')
	console.log(cdnLinks.join('\n'))
	console.log('------')
}

if (!isDryRun) {
	console.log('Creating an invalidation to refresh shared versions.')
	const invalidationRef = `o11y-gdi-rum-${new Date().toISOString()}`
	const Invalidation = await invalidateCloudFrontFiles(CDN_DISTRIBUTION_ID, invalidationRef)
	console.log(`Invalidation ${Invalidation?.Id} sent. Typically it takes about 5 minutes to execute.`)

	console.log('Appending CDN instructions to release description.')
	await patchGithubReleaseBody(ghRelease, ghRelease.body + cdnLinks.join('\n'))
	console.log(`Please verify that instructions are correct by navigating to: ${ghRelease.html_url}`)
}

function* generateAllVersions(version: string): Generator<[string, boolean], void, unknown> {
	const versionParts = version.split('.')

	let isAutoUpdating = false,
		isPreRelease = false

	while (versionParts.length) {
		yield [`${versionParts.join('.')}`, isAutoUpdating]
		const lastSegment = versionParts.pop()

		if (lastSegment === undefined) {
			throw TypeError('lastSegment is undefined')
		}

		if (lastSegment.search(/[\D-]/) > -1 && versionParts.length > 0) {
			isPreRelease = true
			break
		}

		isAutoUpdating = true
	}

	if (!isPreRelease) {
		yield ['latest', true]
	}
}
