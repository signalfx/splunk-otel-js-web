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
import { request } from '@octokit/request'

interface GithubRelease {
	body: string
	html_url: string
	id: number
	name: string
	tag_name: string
	url: string
}

const requestWithAuth = request.defaults({
	headers: {
		authorization: process.env.GITHUB_TOKEN ? `token ${process.env.GITHUB_TOKEN}` : undefined,
	},
})

const getAllGithubReleases = async (owner: string, repo: string) =>
	(await requestWithAuth(`GET /repos/${owner}/${repo}/releases`)) as {
		data: GithubRelease[]
		status: number
	}

export const getReleaseForTag = async (owner: string, repo: string, tagName: string) => {
	const { data, status } = await getAllGithubReleases(owner, repo)

	if (status !== 200) {
		throw new Error(`Failed to fetch releases for ${owner}/${repo}`)
	}

	const release = data.find((r) => r.tag_name === tagName)

	if (!release) {
		throw new Error(`Release not found for tag ${tagName}`)
	}

	const baseVersion = release.tag_name
	if (!baseVersion.startsWith('v')) {
		throw new Error('Release version tag must start with the letter "v".')
	}

	return release
}

export const patchGithubReleaseBody = async (ghRelease: GithubRelease, body: string) => {
	await requestWithAuth(`PATCH ${ghRelease.url}`, {
		body,
	})
}
