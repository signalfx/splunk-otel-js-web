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

const report = require('../report.json')
console.log('FCP', report.audits['first-contentful-paint'].displayValue)
console.log('First CPU Idle', report.audits['first-cpu-idle'].displayValue)
console.log('TBT', report.audits['total-blocking-time'].displayValue)

const renderBlockingAudit = report.audits['render-blocking-resources']
console.log('Render blocking', renderBlockingAudit.displayValue)
if (renderBlockingAudit.details && renderBlockingAudit.details.items) {
	renderBlockingAudit.details.items.forEach((item) => {
		console.log(`${item.url} wasted ${item.wastedMs} ms.`)
	})
}
