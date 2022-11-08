/*eslint-disable block-scoped-var, id-length, no-control-regex, no-magic-numbers, no-prototype-builtins, no-redeclare, no-shadow, no-var, sort-vars*/
import * as $protobuf from "protobufjs/light";

const $root = ($protobuf.roots["default"] || ($protobuf.roots["default"] = new $protobuf.Root()))
.addJSON({
  opentelemetry: {
    nested: {
      proto: {
        nested: {
          common: {
            nested: {
              v1: {
                options: {
                  java_multiple_files: true,
                  java_package: "io.opentelemetry.proto.common.v1",
                  java_outer_classname: "CommonProto",
                  go_package: "go.opentelemetry.io/proto/otlp/common/v1"
                },
                nested: {
                  AnyValue: {
                    oneofs: {
                      value: {
                        oneof: [
                          "stringValue",
                          "boolValue",
                          "intValue",
                          "doubleValue",
                          "arrayValue",
                          "kvlistValue",
                          "bytesValue"
                        ]
                      }
                    },
                    fields: {
                      stringValue: {
                        type: "string",
                        id: 1
                      },
                      boolValue: {
                        type: "bool",
                        id: 2
                      },
                      intValue: {
                        type: "int64",
                        id: 3
                      },
                      doubleValue: {
                        type: "double",
                        id: 4
                      },
                      arrayValue: {
                        type: "ArrayValue",
                        id: 5
                      },
                      kvlistValue: {
                        type: "KeyValueList",
                        id: 6
                      },
                      bytesValue: {
                        type: "bytes",
                        id: 7
                      }
                    }
                  },
                  ArrayValue: {
                    fields: {
                      values: {
                        rule: "repeated",
                        type: "AnyValue",
                        id: 1
                      }
                    }
                  },
                  KeyValueList: {
                    fields: {
                      values: {
                        rule: "repeated",
                        type: "KeyValue",
                        id: 1
                      }
                    }
                  },
                  KeyValue: {
                    fields: {
                      key: {
                        type: "string",
                        id: 1
                      },
                      value: {
                        type: "AnyValue",
                        id: 2
                      }
                    }
                  },
                  InstrumentationLibrary: {
                    options: {
                      deprecated: true
                    },
                    fields: {
                      name: {
                        type: "string",
                        id: 1
                      },
                      version: {
                        type: "string",
                        id: 2
                      }
                    }
                  },
                  InstrumentationScope: {
                    fields: {
                      name: {
                        type: "string",
                        id: 1
                      },
                      version: {
                        type: "string",
                        id: 2
                      }
                    }
                  }
                }
              }
            }
          },
          resource: {
            nested: {
              v1: {
                options: {
                  java_multiple_files: true,
                  java_package: "io.opentelemetry.proto.resource.v1",
                  java_outer_classname: "ResourceProto",
                  go_package: "go.opentelemetry.io/proto/otlp/resource/v1"
                },
                nested: {
                  Resource: {
                    fields: {
                      attributes: {
                        rule: "repeated",
                        type: "opentelemetry.proto.common.v1.KeyValue",
                        id: 1
                      },
                      droppedAttributesCount: {
                        type: "uint32",
                        id: 2
                      }
                    }
                  }
                }
              }
            }
          },
          logs: {
            nested: {
              v1: {
                options: {
                  java_multiple_files: true,
                  java_package: "io.opentelemetry.proto.logs.v1",
                  java_outer_classname: "LogsProto",
                  go_package: "go.opentelemetry.io/proto/otlp/logs/v1"
                },
                nested: {
                  LogsData: {
                    fields: {
                      resourceLogs: {
                        rule: "repeated",
                        type: "ResourceLogs",
                        id: 1
                      }
                    }
                  },
                  ResourceLogs: {
                    fields: {
                      resource: {
                        type: "opentelemetry.proto.resource.v1.Resource",
                        id: 1
                      },
                      scopeLogs: {
                        rule: "repeated",
                        type: "ScopeLogs",
                        id: 2
                      },
                      instrumentationLibraryLogs: {
                        rule: "repeated",
                        type: "InstrumentationLibraryLogs",
                        id: 1000,
                        options: {
                          deprecated: true
                        }
                      },
                      schemaUrl: {
                        type: "string",
                        id: 3
                      }
                    }
                  },
                  ScopeLogs: {
                    fields: {
                      scope: {
                        type: "opentelemetry.proto.common.v1.InstrumentationScope",
                        id: 1
                      },
                      logRecords: {
                        rule: "repeated",
                        type: "LogRecord",
                        id: 2
                      },
                      schemaUrl: {
                        type: "string",
                        id: 3
                      }
                    }
                  },
                  InstrumentationLibraryLogs: {
                    options: {
                      deprecated: true
                    },
                    fields: {
                      instrumentationLibrary: {
                        type: "opentelemetry.proto.common.v1.InstrumentationLibrary",
                        id: 1
                      },
                      logRecords: {
                        rule: "repeated",
                        type: "LogRecord",
                        id: 2
                      },
                      schemaUrl: {
                        type: "string",
                        id: 3
                      }
                    }
                  },
                  SeverityNumber: {
                    values: {
                      SEVERITY_NUMBER_UNSPECIFIED: 0,
                      SEVERITY_NUMBER_TRACE: 1,
                      SEVERITY_NUMBER_TRACE2: 2,
                      SEVERITY_NUMBER_TRACE3: 3,
                      SEVERITY_NUMBER_TRACE4: 4,
                      SEVERITY_NUMBER_DEBUG: 5,
                      SEVERITY_NUMBER_DEBUG2: 6,
                      SEVERITY_NUMBER_DEBUG3: 7,
                      SEVERITY_NUMBER_DEBUG4: 8,
                      SEVERITY_NUMBER_INFO: 9,
                      SEVERITY_NUMBER_INFO2: 10,
                      SEVERITY_NUMBER_INFO3: 11,
                      SEVERITY_NUMBER_INFO4: 12,
                      SEVERITY_NUMBER_WARN: 13,
                      SEVERITY_NUMBER_WARN2: 14,
                      SEVERITY_NUMBER_WARN3: 15,
                      SEVERITY_NUMBER_WARN4: 16,
                      SEVERITY_NUMBER_ERROR: 17,
                      SEVERITY_NUMBER_ERROR2: 18,
                      SEVERITY_NUMBER_ERROR3: 19,
                      SEVERITY_NUMBER_ERROR4: 20,
                      SEVERITY_NUMBER_FATAL: 21,
                      SEVERITY_NUMBER_FATAL2: 22,
                      SEVERITY_NUMBER_FATAL3: 23,
                      SEVERITY_NUMBER_FATAL4: 24
                    }
                  },
                  LogRecordFlags: {
                    values: {
                      LOG_RECORD_FLAG_UNSPECIFIED: 0,
                      LOG_RECORD_FLAG_TRACE_FLAGS_MASK: 255
                    }
                  },
                  LogRecord: {
                    fields: {
                      timeUnixNano: {
                        type: "fixed64",
                        id: 1
                      },
                      observedTimeUnixNano: {
                        type: "fixed64",
                        id: 11
                      },
                      severityNumber: {
                        type: "SeverityNumber",
                        id: 2
                      },
                      severityText: {
                        type: "string",
                        id: 3
                      },
                      body: {
                        type: "opentelemetry.proto.common.v1.AnyValue",
                        id: 5
                      },
                      attributes: {
                        rule: "repeated",
                        type: "opentelemetry.proto.common.v1.KeyValue",
                        id: 6
                      },
                      droppedAttributesCount: {
                        type: "uint32",
                        id: 7
                      },
                      flags: {
                        type: "fixed32",
                        id: 8
                      },
                      traceId: {
                        type: "bytes",
                        id: 9
                      },
                      spanId: {
                        type: "bytes",
                        id: 10
                      }
                    },
                    reserved: [
                      [
                        4,
                        4
                      ]
                    ]
                  }
                }
              }
            }
          }
        }
      }
    }
  }
});

export { $root as default };
