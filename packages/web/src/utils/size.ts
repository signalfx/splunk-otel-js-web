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

type SizeLikeObject =
	| { byteLength: number | string; length?: never; size?: never }
	| { byteLength?: never; length?: never; size: number | string }
	| { byteLength?: never; length: number | string; size?: never }

export const hasSizeLikeProperty = (maybeSizeLike: unknown): maybeSizeLike is SizeLikeObject => {
	if (typeof maybeSizeLike === 'string') {
		return true
	}

	if (typeof maybeSizeLike !== 'object' || maybeSizeLike === null) {
		return false
	}

	if ('byteLength' in maybeSizeLike) {
		return true
	}

	if ('length' in maybeSizeLike) {
		return true
	}

	if ('size' in maybeSizeLike) {
		return true
	}

	return false
}

export const getSize = (o: SizeLikeObject) => o.byteLength || o.size || o.length
