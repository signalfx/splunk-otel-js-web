/**
 *
 * Copyright 2024 Splunk Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

const { Buffer } = require('buffer')
const jpeg = require('jpeg-js')

const RANDOM_IMAGE_PATH = '/resources/image'

function generateRandomImage(width = 200, height = 200, quality = 90) {
	const frameData = Buffer.alloc(width * height * 4)

	let i = 0
	while (i < frameData.length) {
		i += 1
		frameData[i] = Math.floor(Math.random() * 256)
	}

	return jpeg.encode(
		{
			data: frameData,
			width: width,
			height: height,
		},
		quality,
	)
}

function handleRandomImageRequest(app) {
	app.get(RANDOM_IMAGE_PATH, (_, res) => {
		res.set({
			'Content-Type': 'image/jpeg',
		})
		res.send(generateRandomImage().data)
	})
}

function generateRandomImageTags(n) {
	const tags = []
	for (let i = 0; i < n; i++) {
		const rand = Math.floor(Math.random() * 1000000)
		tags.push(`<img width="100" height="100" src="${RANDOM_IMAGE_PATH}?buster=${rand}" />`)
	}
	return tags.join('')
}

module.exports = {
	handleRandomImageRequest,
	generateRandomImageTags,
}
