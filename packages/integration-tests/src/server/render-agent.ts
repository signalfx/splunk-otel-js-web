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
import { html } from './utils'

export const RENDER_AGENT_TEMPLATE = html`
	<script src="<%= file -%>" crossorigin="anonymous"></script>
	<script src="<%= otelApiGlobalsFile -%>" crossorigin="anonymous"></script>
	<script>
		const options = <%- options -%>;
		const customOptions = <%- customOptions -%>;

		if (typeof customOptions.forceSessionId === 'string') {
			window.__splunkRumIntegrationTestSessionId = customOptions.forceSessionId;
		}

		if (typeof customOptions.samplingRatio === 'number') {
			options['tracer'] = {
				sampler: new SplunkRum.SessionBasedSampler({
					ratio: customOptions.samplingRatio,
				})
			}
		}

		<%if (noInit) { %>
		  window.SplunkRumOptions = options;
		<% } else { %>
		  window.SplunkRum && window.SplunkRum.init(options);
		<% } %>

		let _testing = false;
		let _onTestingDone = null;
		Object.defineProperty(window, 'testing', {
		  get: function() {
		    return _testing;
		  },
		  set: function(value) {
		    _testing = value;
		    setTimeout(function () {
		      if (_onTestingDone) {
		        _flushData(_onTestingDone);
		        _onTestingDone = null;
		      }
		    }, 0);
		  }
		});
		function _flushData(done) {
		  if (!window.SplunkRum) {
		    done(null);
		  }

		  let span = SplunkRum.provider.getTracer('default').startSpan('guard-span');
		  span.end();

		  SplunkRum._processor.forceFlush().then(function () {
		    done(span._spanContext.spanId);
		  }, function () {
		    done(null);
		  });
		}
		function waitForTestToFinish(done) {
		  if (document.readyState !== 'complete') {
		    window.addEventListener('load', function () {
		      waitForTestToFinish(done);
		    });
		  }

		  if (_testing) {
		    _onTestingDone = done;
		    return;
		  }

		  _flushData(done);
		}
	</script>
`
