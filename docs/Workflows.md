# Workflows

Creating workflow spans is the same as creating custom spans with correct attributes.

## Workflow specific attributes

|Name|Type|Description|
|---|---|---|
|`id`|`string`|Unique id for the workflow instance.|
|`name`|`string`|Semantic name for the current workflow.|

## Create a workflow span

<pre>import {trace} from '@opentelemetry/api'<br><br>const tracer = trace.getTracer('appModuleLoader');<br>const span = tracer.startSpan('test.module.load', {<br>  attributes: {<br>    <em>'workflow.id'</em>: 1,<br>    <em>'workflow.name'</em>: 'test.module.load'<br>  }<br>});<br><br>// time passes<br>span.end();</pre>

### Errors

In order to make workflow span errorful use the same attributes as our [autoinstrumentation](./docs/Errors.md) does.

<pre>import {trace} from '@opentelemetry/api'<br><br>const tracer = trace.getTracer('appModuleLoader');<br>const span = tracer.startSpan('test.module.load', {<br>  attributes: {<br>    <em>'workflow.id'</em>: 1,<br>    <em>'workflow.name'</em>: 'test.module.load',<br>    <em>'error'</em>: true,<br>    <em>'error.message'</em>: 'Custom workflow error message'<br>}<br>});<br><br>span.end();</pre>
