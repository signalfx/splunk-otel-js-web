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

/**
 * Why another polyfill if we already have babel?
 * When applying spread operator, babel checks if the target is 1) an array or 2) an iterable.
 * However, Safari 10 has some array-like types which are neither 1) nor 2).
 * Below we're polyfilling two of these, as caused by [...document.getElementsByTagName(tagName)].
 * This is a good-enough solution for now. If there's more polyfills needed, we should migrate to corejs.
 */

if (typeof NodeList !== 'undefined' && !NodeList.prototype[Symbol.iterator]) {
	NodeList.prototype[Symbol.iterator] = [][Symbol.iterator]
}

if (typeof HTMLCollection !== 'undefined' && !HTMLCollection.prototype[Symbol.iterator]) {
	HTMLCollection.prototype[Symbol.iterator] = [][Symbol.iterator]
}
