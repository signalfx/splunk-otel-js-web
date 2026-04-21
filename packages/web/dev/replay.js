/**
 *
 * Copyright 2020-2026 Splunk Inc.
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
 * Session-replay sandbox page handlers.
 * Scenario stages + controls for privacy, DOM mutations, form inputs,
 * media/features, and styling/assets scenarios.
 */

import { $, doRecorderResume, doRecorderStop, init, log } from './sandbox-core.js'

// ── Console Drawer ────────────────────────────────────────────────────────

function initDrawer() {
	const drawer = $('#console-drawer')
	const toggle = $('#btn-console-toggle')
	if (!drawer || !toggle) {
		return
	}

	function toggleDrawer() {
		const isCollapsed = drawer.classList.contains('collapsed')
		drawer.classList.toggle('collapsed', !isCollapsed)
		drawer.classList.toggle('expanded', isCollapsed)
		toggle.setAttribute('aria-expanded', String(isCollapsed))
	}

	toggle.addEventListener('click', toggleDrawer)
	toggle.addEventListener('keydown', (e) => {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault()
			toggleDrawer()
		}
	})
}

// ── TOC active-link tracking ──────────────────────────────────────────────

function initTocTracking() {
	const tocLinks = document.querySelectorAll('.toc-link[href^="#"]')
	if (tocLinks.length === 0) {
		return
	}

	const sections = [...document.querySelectorAll('.scenario-group[id]')]

	const observer = new IntersectionObserver(
		(entries) => {
			const active = entries
				.filter((e) => e.isIntersecting)
				.toSorted((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
			if (!active) {
				return
			}

			const id = active.target.id
			for (const link of tocLinks) {
				link.classList.toggle('active', link.getAttribute('href') === `#${id}`)
			}
		},
		{ rootMargin: '-30% 0px -60% 0px' },
	)

	for (const section of sections) {
		observer.observe(section)
	}
}

// ── DOM Mutations scenario ────────────────────────────────────────────────

function initDomScenario() {
	const list = $('#stage-dom-list')
	if (!list) {
		return
	}

	let domItemCount = list.children.length

	$('#btn-dom-add')?.addEventListener('click', () => {
		domItemCount += 1
		const li = document.createElement('li')
		li.dataset.id = String(domItemCount)
		li.textContent = `Item ${domItemCount}`
		list.append(li)
		log(`DOM: added "Item ${domItemCount}"`)
	})

	$('#btn-dom-remove')?.addEventListener('click', () => {
		const last = list.lastElementChild
		if (last) {
			log(`DOM: removed "${last.textContent}"`)
			last.remove()
		} else {
			log('DOM: list is already empty', 'warn')
		}
	})

	$('#btn-dom-shuffle')?.addEventListener('click', () => {
		const items = [...list.children]
		for (let i = items.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1))
			items[i].before(items[j])
		}
		log('DOM: list shuffled')
	})

	$('#btn-dom-rename')?.addEventListener('click', () => {
		const first = list.firstElementChild
		if (first) {
			// dev-only: crypto.randomUUID() requires a current browser (Chrome 92+, FF 95+, Safari 15.4+)
			const name = `Item ${crypto.randomUUID().slice(0, 4).toUpperCase()}`
			first.textContent = name
			log(`DOM: first item renamed → "${name}"`)
		}
	})

	// Attribute mutations
	const attrBox = $('#stage-attr-box')
	const attrDisplay = $('#attr-display')

	function updateAttrDisplay() {
		if (attrBox && attrDisplay) {
			attrDisplay.textContent = `data-state="${attrBox.dataset.state}" aria-expanded="${attrBox.getAttribute('aria-expanded')}"`
		}
	}

	$('#btn-attr-toggle')?.addEventListener('click', () => {
		if (!attrBox) {
			return
		}

		const next = attrBox.dataset.state === 'idle' ? 'active' : 'idle'
		attrBox.dataset.state = next
		updateAttrDisplay()
		log(`DOM: data-state → "${next}"`)
	})

	$('#btn-attr-class')?.addEventListener('click', () => {
		if (!attrBox) {
			return
		}

		const added = attrBox.classList.toggle('highlighted')
		log(`DOM: class "highlighted" ${added ? 'added' : 'removed'}`)
	})

	$('#btn-attr-aria')?.addEventListener('click', () => {
		if (!attrBox) {
			return
		}

		const next = attrBox.getAttribute('aria-expanded') === 'false' ? 'true' : 'false'
		attrBox.setAttribute('aria-expanded', next)
		updateAttrDisplay()
		log(`DOM: aria-expanded → "${next}"`)
	})

	// Burst
	const burst = $('#stage-burst')

	$('#btn-dom-burst')?.addEventListener('click', () => {
		if (!burst) {
			return
		}

		const frag = document.createDocumentFragment()
		for (let i = 0; i < 200; i++) {
			const d = document.createElement('div')
			d.className = 'burst-cell'
			d.style.background = `hsl(${Math.round(Math.random() * 360)}deg 60% 40%)`
			frag.append(d)
		}
		burst.replaceChildren(frag)
		log('DOM: burst — inserted 200 nodes simultaneously', 'warn')
	})

	$('#btn-dom-burst-clear')?.addEventListener('click', () => {
		if (!burst) {
			return
		}

		const count = burst.children.length
		burst.replaceChildren()
		log(`DOM: cleared ${count} burst nodes`)
	})
}

// ── Form Inputs scenario ──────────────────────────────────────────────────

function initInputsScenario() {
	for (const form of document.querySelectorAll('.stage-form')) {
		form.addEventListener('submit', (e) => e.preventDefault())
	}

	$('#btn-inputs-reset')?.addEventListener('click', () => {
		const form = /** @type {HTMLFormElement} */ ($('#stage-form'))
		form?.reset()
		log('Inputs: form reset')
	})
}

// ── Canvas scenario ───────────────────────────────────────────────────────

function initCanvasScenario() {
	const canvas = /** @type {HTMLCanvasElement} */ ($('#stage-canvas'))
	if (!canvas) {
		return
	}

	const ctx = canvas.getContext('2d')
	const ball = { r: 14, vx: 2.8, vy: 1.9, x: 80, y: 60 }
	let canvasRaf = null

	function drawFrame() {
		const { height, width } = canvas

		// Background
		ctx.fillStyle = '#010409'
		ctx.fillRect(0, 0, width, height)

		// Grid lines
		ctx.strokeStyle = '#21262d'
		ctx.lineWidth = 1
		for (let x = 0; x <= width; x += 40) {
			ctx.beginPath()
			ctx.moveTo(x, 0)
			ctx.lineTo(x, height)
			ctx.stroke()
		}
		for (let y = 0; y <= height; y += 40) {
			ctx.beginPath()
			ctx.moveTo(0, y)
			ctx.lineTo(width, y)
			ctx.stroke()
		}

		// Physics
		ball.x += ball.vx
		ball.y += ball.vy
		if (ball.x - ball.r < 0 || ball.x + ball.r > width) {
			ball.vx *= -1
		}

		if (ball.y - ball.r < 0 || ball.y + ball.r > height) {
			ball.vy *= -1
		}

		ball.x = Math.max(ball.r, Math.min(width - ball.r, ball.x))
		ball.y = Math.max(ball.r, Math.min(height - ball.r, ball.y))

		// Glow shadow
		ctx.shadowBlur = 18
		ctx.shadowColor = '#58a6ff'

		// Ball gradient
		const grad = ctx.createRadialGradient(ball.x - 3, ball.y - 3, 2, ball.x, ball.y, ball.r)
		grad.addColorStop(0, '#f0883e')
		grad.addColorStop(1, '#1f6feb')
		ctx.beginPath()
		ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2)
		ctx.fillStyle = grad
		ctx.fill()
		ctx.shadowBlur = 0

		canvasRaf = requestAnimationFrame(drawFrame)
	}

	$('#btn-canvas-start')?.addEventListener('click', () => {
		if (canvasRaf) {
			return
		}

		drawFrame()
		log('Canvas: animation started')
	})

	$('#btn-canvas-stop')?.addEventListener('click', () => {
		if (canvasRaf) {
			cancelAnimationFrame(canvasRaf)
			canvasRaf = null
			log('Canvas: animation stopped')
		}
	})

	$('#btn-canvas-clear')?.addEventListener('click', () => {
		if (canvasRaf) {
			cancelAnimationFrame(canvasRaf)
			canvasRaf = null
		}

		ctx.clearRect(0, 0, canvas.width, canvas.height)
		log('Canvas: cleared')
	})
}

// ── Styling scenario ──────────────────────────────────────────────────────

const STYLE_HUES = [210, 140, 30, 270, 0, 180, 60]
let styleHueIdx = 0

function initStylingScenario() {
	$('#btn-style-randomize')?.addEventListener('click', () => {
		styleHueIdx = (styleHueIdx + 1) % STYLE_HUES.length
		const hue = STYLE_HUES.at(styleHueIdx)
		const root = document.documentElement
		root.style.setProperty('--color-accent-blue', `hsl(${hue}deg 85% 65%)`)
		root.style.setProperty('--color-accent-blue-emphasis', `hsl(${hue}deg 85% 40%)`)
		root.style.setProperty('--color-accent-orange', `hsl(${(hue + 60) % 360}deg 85% 60%)`)
		log(`Style: theme hue → ${hue}°`)
	})

	$('#btn-style-reset-theme')?.addEventListener('click', () => {
		const root = document.documentElement
		root.style.removeProperty('--color-accent-blue')
		root.style.removeProperty('--color-accent-blue-emphasis')
		root.style.removeProperty('--color-accent-orange')
		styleHueIdx = 0
		log('Style: theme reset to defaults')
	})
}

// ── Shadow DOM custom element ─────────────────────────────────────────────

function registerShadowWidget() {
	if (customElements.get('replay-shadow-widget')) {
		return
	}

	class ReplayShadowWidget extends HTMLElement {
		constructor() {
			super()
			const shadow = this.attachShadow({ mode: 'open' })
			shadow.innerHTML = `
				<style>
					:host { display: block; }
					.shadow-box {
						border: 2px dashed var(--accent, #58a6ff);
						border-radius: 6px;
						padding: 16px;
						font-family: system-ui, sans-serif;
						color: #e6edf3;
						background: #0d1117;
					}
					label {
						display: block;
						font-size: 11px;
						color: #8b949e;
						margin-bottom: 4px;
					}
					input {
						background: #161b22;
						border: 1px solid #30363d;
						color: #e6edf3;
						padding: 6px 8px;
						border-radius: 4px;
						width: 100%;
						font-size: 12px;
						box-sizing: border-box;
					}
					input:focus { outline: none; border-color: #1f6feb; }
					button {
						margin-top: 10px;
						background: #21262d;
						border: 1px solid #30363d;
						color: #e6edf3;
						padding: 6px 12px;
						border-radius: 4px;
						cursor: pointer;
						font-size: 12px;
					}
					button:hover { background: #30363d; }
					#shadow-output {
						margin-top: 8px;
						font-size: 11px;
						color: #3fb950;
						font-family: monospace;
						min-height: 16px;
					}
				</style>
				<div class="shadow-box">
					<label>Input inside shadow root</label>
					<input type="text" id="shadow-input" placeholder="Typing inside Shadow DOM…" />
					<button id="shadow-btn">Click inside shadow</button>
					<div id="shadow-output"></div>
				</div>
			`
			shadow.querySelector('#shadow-btn').addEventListener('click', () => {
				const output = shadow.querySelector('#shadow-output')
				const val = /** @type {HTMLInputElement} */ (shadow.querySelector('#shadow-input')).value
				output.textContent = `Clicked at ${new Date().toLocaleTimeString()} — input: "${val || '(empty)'}"`
			})
		}
	}

	customElements.define('replay-shadow-widget', ReplayShadowWidget)
}

// ── Recorder controls (in TOC) ────────────────────────────────────────────

function initRecorderControls() {
	$('#btn-recorder-stop')?.addEventListener('click', doRecorderStop)
	$('#btn-recorder-resume')?.addEventListener('click', doRecorderResume)
}

// ── Boot ──────────────────────────────────────────────────────────────────

window.addEventListener('DOMContentLoaded', () => {
	init()
	initDrawer()
	initTocTracking()
	initDomScenario()
	initInputsScenario()
	initCanvasScenario()
	initStylingScenario()
	registerShadowWidget()
	initRecorderControls()
})
