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
export const applyStyles = (element: HTMLElement, styles: Record<string, string>) => {
	for (const [styleName, styleValue] of Object.entries(styles)) {
		element.style.setProperty(styleName, styleValue)
	}
}

type Style = {
	border?: string
	display?: string
	height?: string
	visibility?: string
	width?: string
}

export const initializeIframe = ({
	attributes,
	iframeName,
	parentElement,
	style,
	styleAfterLoad,
}: {
	attributes?: { class?: string; sandbox?: string; src?: string; srcdoc?: string }
	iframeName: string
	parentElement?: HTMLElement
	style?: Style
	styleAfterLoad?: { display?: string }
}): [HTMLIFrameElement, (timeout?: number) => Promise<void>] => {
	const iframe = document.createElement('iframe')

	for (const [attributeName, attributeValue] of Object.entries(attributes || {})) {
		if (attributeValue !== undefined) {
			iframe.setAttribute(attributeName, attributeValue)
		}
	}

	applyStyles(iframe, style || {})

	const waitForIframeLoad = (timeout?: number) =>
		new Promise<void>((resolve, reject) => {
			const onLoadListener = () => {
				iframe.removeEventListener('load', onLoadListener)
				iframe.removeEventListener('error', onErrorListener)

				applyStyles(iframe, styleAfterLoad || {})

				resolve()
			}

			const onErrorListener = () => {
				iframe.removeEventListener('load', onLoadListener)
				iframe.removeEventListener('error', onErrorListener)

				applyStyles(iframe, styleAfterLoad || {})

				reject(new Error(`Player ${iframeName} iframe load failed.`))
			}

			iframe.addEventListener('load', onLoadListener)
			iframe.addEventListener('error', onErrorListener)

			parentElement?.append(iframe)

			if (timeout) {
				setTimeout(() => {
					iframe.removeEventListener('load', onLoadListener)
					iframe.removeEventListener('error', onErrorListener)
					reject(new Error(`Iframe ${iframeName} load timeout.`))
				}, timeout)
			}
		})

	return [iframe, waitForIframeLoad]
}

export const safelyAccessFrameElementFromDocument = (documentNode: Document) => {
	let frameElement = null
	try {
		frameElement = documentNode.defaultView?.frameElement ?? null
	} catch {
		// Accessing frameElement from cross-origin iframe might throw Access Denied error in some browsers
	}

	return frameElement
}

export const safelyAccessFrameElementFromWindow = (rootWindow: Window) => {
	let frameElement = null
	try {
		frameElement = rootWindow.frameElement ?? null
	} catch {
		// Accessing frameElement from cross-origin iframe might throw Access Denied error in some browsers
	}

	return frameElement
}

export const isIframeLoaded = (iframe: HTMLIFrameElement) => {
	if (!iframe.contentDocument || iframe.contentDocument.readyState !== 'complete') {
		return false
	}

	if (iframe.src !== 'about:blank' && iframe.contentDocument.location.href === 'about:blank') {
		return false
	}

	return true
}
