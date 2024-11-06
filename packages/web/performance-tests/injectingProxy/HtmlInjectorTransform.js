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
const { Transform } = require('stream')

exports.HtmlInjectorTransform = class HtmlInjectorTransform extends Transform {
	__scriptInjected = false

	__wordIdx = 0

	__contentIdx = 0

	__content = []

	constructor({ matchingSuffix, contentToInject }) {
		super()
		this.__word = matchingSuffix
		this.__injectable = contentToInject
	}

	_transform(chunk, enc, callback) {
		if (this.__scriptInjected) {
			this.push(chunk)
			callback()
			return
		}

		const stringified = chunk.toString('utf-8')
		const arr = stringified.split('')

		this.__content.push(...arr)
		const hasMatch = this.__runPartialOnlineMatch()
		if (hasMatch) {
			this.__content.splice(this.__contentIdx, 0, this.__injectable)
			this.__scriptInjected = true

			this.push(this.__content.join('', 'utf-8'))
			callback()

			this.__content = []
		} else {
			const toFlush = this.__content.slice(0, this.__contentIdx)
			const toKeep = this.__content.slice(this.__contentIdx, this.__content.length)

			this.__content = toKeep
			this.__contentIdx = 0

			this.push(toFlush.join('', 'utf-8'))
			callback()
		}
	}

	__runPartialOnlineMatch() {
		while (true) {
			if (this.__contentIdx === this.__content.length) {
				return false
			} else if (this.__wordIdx === this.__word.length) {
				return true
			} else if (this.__contentIdx + this.__wordIdx === this.__content.length) {
				return false
			} else if (this.__content[this.__contentIdx + this.__wordIdx] === this.__word[this.__wordIdx]) {
				this.__wordIdx += 1
			} else if (this.__wordIdx === 0) {
				this.__contentIdx += 1
			} else {
				// TODO: speed up using KMP failure function
				this.__wordIdx = 0
				this.__contentIdx += 1
			}
		}
	}
}
