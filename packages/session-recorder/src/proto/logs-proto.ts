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
/*
*************************************

Otel proto files -> https://github.com/open-telemetry/opentelemetry-proto/tree/main/opentelemetry/proto

This code was generated using protobufjs-cli: https://github.com/protobufjs/protobuf.js/tree/master/cli

Command used for generating LogsProto.js:
./pbjs -t json-module -w es6 -o ~/LogsProto.js --force-number ~/common.proto ~/resource.proto ~/logs.proto

*************************************
*/

import * as $protobuf from 'protobufjs/light'

const $root = ($protobuf.roots['default'] || ($protobuf.roots['default'] = new $protobuf.Root())).addJSON({
	opentelemetry: {
		nested: {
			proto: {
				nested: {
					common: {
						nested: {
							v1: {
								nested: {
									AnyValue: {
										fields: {
											arrayValue: {
												id: 5,
												type: 'ArrayValue',
											},
											boolValue: {
												id: 2,
												type: 'bool',
											},
											bytesValue: {
												id: 7,
												type: 'bytes',
											},
											doubleValue: {
												id: 4,
												type: 'double',
											},
											intValue: {
												id: 3,
												type: 'int64',
											},
											kvlistValue: {
												id: 6,
												type: 'KeyValueList',
											},
											stringValue: {
												id: 1,
												type: 'string',
											},
										},
										oneofs: {
											value: {
												oneof: [
													'stringValue',
													'boolValue',
													'intValue',
													'doubleValue',
													'arrayValue',
													'kvlistValue',
													'bytesValue',
												],
											},
										},
									},
									ArrayValue: {
										fields: {
											values: {
												id: 1,
												rule: 'repeated',
												type: 'AnyValue',
											},
										},
									},
									InstrumentationScope: {
										fields: {
											attributes: {
												id: 3,
												rule: 'repeated',
												type: 'KeyValue',
											},
											droppedAttributesCount: {
												id: 4,
												type: 'uint32',
											},
											name: {
												id: 1,
												type: 'string',
											},
											version: {
												id: 2,
												type: 'string',
											},
										},
									},
									KeyValue: {
										fields: {
											key: {
												id: 1,
												type: 'string',
											},
											value: {
												id: 2,
												type: 'AnyValue',
											},
										},
									},
									KeyValueList: {
										fields: {
											values: {
												id: 1,
												rule: 'repeated',
												type: 'KeyValue',
											},
										},
									},
								},
								options: {
									csharp_namespace: 'OpenTelemetry.Proto.Common.V1',
									go_package: 'go.opentelemetry.io/proto/otlp/common/v1',
									java_multiple_files: true,
									java_outer_classname: 'CommonProto',
									java_package: 'io.opentelemetry.proto.common.v1',
								},
							},
						},
					},
					logs: {
						nested: {
							v1: {
								nested: {
									LogRecord: {
										fields: {
											attributes: {
												id: 6,
												rule: 'repeated',
												type: 'opentelemetry.proto.common.v1.KeyValue',
											},
											body: {
												id: 5,
												type: 'opentelemetry.proto.common.v1.AnyValue',
											},
											droppedAttributesCount: {
												id: 7,
												type: 'uint32',
											},
											flags: {
												id: 8,
												type: 'fixed32',
											},
											observedTimeUnixNano: {
												id: 11,
												type: 'fixed64',
											},
											severityNumber: {
												id: 2,
												type: 'SeverityNumber',
											},
											severityText: {
												id: 3,
												type: 'string',
											},
											spanId: {
												id: 10,
												type: 'bytes',
											},
											timeUnixNano: {
												id: 1,
												type: 'fixed64',
											},
											traceId: {
												id: 9,
												type: 'bytes',
											},
										},
										reserved: [[4, 4]],
									},
									LogRecordFlags: {
										values: {
											LOG_RECORD_FLAG_TRACE_FLAGS_MASK: 255,
											LOG_RECORD_FLAG_UNSPECIFIED: 0,
										},
									},
									LogsData: {
										fields: {
											resourceLogs: {
												id: 1,
												rule: 'repeated',
												type: 'ResourceLogs',
											},
										},
									},
									ResourceLogs: {
										fields: {
											resource: {
												id: 1,
												type: 'opentelemetry.proto.resource.v1.Resource',
											},
											schemaUrl: {
												id: 3,
												type: 'string',
											},
											scopeLogs: {
												id: 2,
												rule: 'repeated',
												type: 'ScopeLogs',
											},
										},
										reserved: [[1000, 1000]],
									},
									ScopeLogs: {
										fields: {
											logRecords: {
												id: 2,
												rule: 'repeated',
												type: 'LogRecord',
											},
											schemaUrl: {
												id: 3,
												type: 'string',
											},
											scope: {
												id: 1,
												type: 'opentelemetry.proto.common.v1.InstrumentationScope',
											},
										},
									},
									SeverityNumber: {
										values: {
											SEVERITY_NUMBER_DEBUG: 5,
											SEVERITY_NUMBER_DEBUG2: 6,
											SEVERITY_NUMBER_DEBUG3: 7,
											SEVERITY_NUMBER_DEBUG4: 8,
											SEVERITY_NUMBER_ERROR: 17,
											SEVERITY_NUMBER_ERROR2: 18,
											SEVERITY_NUMBER_ERROR3: 19,
											SEVERITY_NUMBER_ERROR4: 20,
											SEVERITY_NUMBER_FATAL: 21,
											SEVERITY_NUMBER_FATAL2: 22,
											SEVERITY_NUMBER_FATAL3: 23,
											SEVERITY_NUMBER_FATAL4: 24,
											SEVERITY_NUMBER_INFO: 9,
											SEVERITY_NUMBER_INFO2: 10,
											SEVERITY_NUMBER_INFO3: 11,
											SEVERITY_NUMBER_INFO4: 12,
											SEVERITY_NUMBER_TRACE: 1,
											SEVERITY_NUMBER_TRACE2: 2,
											SEVERITY_NUMBER_TRACE3: 3,
											SEVERITY_NUMBER_TRACE4: 4,
											SEVERITY_NUMBER_UNSPECIFIED: 0,
											SEVERITY_NUMBER_WARN: 13,
											SEVERITY_NUMBER_WARN2: 14,
											SEVERITY_NUMBER_WARN3: 15,
											SEVERITY_NUMBER_WARN4: 16,
										},
									},
								},
								options: {
									csharp_namespace: 'OpenTelemetry.Proto.Logs.V1',
									go_package: 'go.opentelemetry.io/proto/otlp/logs/v1',
									java_multiple_files: true,
									java_outer_classname: 'LogsProto',
									java_package: 'io.opentelemetry.proto.logs.v1',
								},
							},
						},
					},
					resource: {
						nested: {
							v1: {
								nested: {
									Resource: {
										fields: {
											attributes: {
												id: 1,
												rule: 'repeated',
												type: 'opentelemetry.proto.common.v1.KeyValue',
											},
											droppedAttributesCount: {
												id: 2,
												type: 'uint32',
											},
										},
									},
								},
								options: {
									csharp_namespace: 'OpenTelemetry.Proto.Resource.V1',
									go_package: 'go.opentelemetry.io/proto/otlp/resource/v1',
									java_multiple_files: true,
									java_outer_classname: 'ResourceProto',
									java_package: 'io.opentelemetry.proto.resource.v1',
								},
							},
						},
					},
				},
			},
		},
	},
})

export default $root
