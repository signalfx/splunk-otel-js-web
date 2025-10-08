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

export const isNode = (maybeNode: EventTarget): maybeNode is Node => (<Node>maybeNode)?.nodeName !== undefined

export const isElement = (maybeElement: EventTarget | Node): maybeElement is Element =>
	(<Node>maybeElement)?.nodeType === Node.ELEMENT_NODE

export const isInputElement = (node: Node): node is HTMLInputElement => node.nodeName === 'INPUT'

export const isDocumentNode = (maybeDocument: EventTarget | Node | undefined): maybeDocument is Document =>
	Boolean(maybeDocument) && (<Node>maybeDocument)?.nodeType === Node.DOCUMENT_NODE

export const isShadowRoot = (maybeShadowRoot: Node): maybeShadowRoot is ShadowRoot =>
	maybeShadowRoot.nodeName === '#document-fragment' && maybeShadowRoot.constructor.name === 'ShadowRoot'

export const isNonNativeShadowRoot = (maybeShadowRoot: Node): maybeShadowRoot is ShadowRoot =>
	maybeShadowRoot.nodeName === '#document-fragment' && maybeShadowRoot.constructor.name !== 'ShadowRoot'

export type TextInputElement = HTMLInputElement | HTMLTextAreaElement

export const isCommentNode = (maybeCommentElement: Node): maybeCommentElement is Comment =>
	maybeCommentElement.nodeName === '#comment'

export const isLinkElement = (maybeLinkElement: Node): maybeLinkElement is HTMLLinkElement =>
	maybeLinkElement.nodeName === 'LINK'

export const isMetaElement = (maybeMetaElement: Node): maybeMetaElement is HTMLMetaElement =>
	maybeMetaElement.nodeName === 'META'

export const isStyleElement = (
	maybeStyleElement: Node | null,
): maybeStyleElement is HTMLStyleElement | SVGStyleElement =>
	maybeStyleElement !== null && (maybeStyleElement.nodeName === 'STYLE' || maybeStyleElement.nodeName === 'style')

export const isScriptElement = (maybeScriptElement: Node): maybeScriptElement is HTMLScriptElement =>
	maybeScriptElement.nodeName === 'SCRIPT'

export const isScriptOrNoScriptElement = (
	maybeScriptOrNoScriptElement: Node,
): maybeScriptOrNoScriptElement is HTMLScriptElement =>
	maybeScriptOrNoScriptElement.nodeName === 'SCRIPT' || maybeScriptOrNoScriptElement.nodeName === 'NOSCRIPT'

export const isTextNode = (maybeTextNode: Node): maybeTextNode is Text => maybeTextNode.nodeType === Node.TEXT_NODE
