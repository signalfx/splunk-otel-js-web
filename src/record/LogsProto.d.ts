import * as $protobuf from "protobufjs";
/** Namespace opentelemetry. */
export namespace opentelemetry {

    /** Namespace proto. */
    namespace proto {

        /** Namespace common. */
        namespace common {

            /** Namespace v1. */
            namespace v1 {

                /** Properties of an AnyValue. */
                interface IAnyValue {

                    /** AnyValue stringValue */
                    stringValue?: (string|null);

                    /** AnyValue boolValue */
                    boolValue?: (boolean|null);

                    /** AnyValue intValue */
                    intValue?: (number|null);

                    /** AnyValue doubleValue */
                    doubleValue?: (number|null);

                    /** AnyValue arrayValue */
                    arrayValue?: (opentelemetry.proto.common.v1.IArrayValue|null);

                    /** AnyValue kvlistValue */
                    kvlistValue?: (opentelemetry.proto.common.v1.IKeyValueList|null);

                    /** AnyValue bytesValue */
                    bytesValue?: (Uint8Array|null);
                }

                /** Represents an AnyValue. */
                class AnyValue implements IAnyValue {

                    /**
                     * Constructs a new AnyValue.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: opentelemetry.proto.common.v1.IAnyValue);

                    /** AnyValue stringValue. */
                    public stringValue?: (string|null);

                    /** AnyValue boolValue. */
                    public boolValue?: (boolean|null);

                    /** AnyValue intValue. */
                    public intValue?: (number|null);

                    /** AnyValue doubleValue. */
                    public doubleValue?: (number|null);

                    /** AnyValue arrayValue. */
                    public arrayValue?: (opentelemetry.proto.common.v1.IArrayValue|null);

                    /** AnyValue kvlistValue. */
                    public kvlistValue?: (opentelemetry.proto.common.v1.IKeyValueList|null);

                    /** AnyValue bytesValue. */
                    public bytesValue?: (Uint8Array|null);

                    /** AnyValue value. */
                    public value?: ("stringValue"|"boolValue"|"intValue"|"doubleValue"|"arrayValue"|"kvlistValue"|"bytesValue");

                    /**
                     * Encodes the specified AnyValue message. Does not implicitly {@link opentelemetry.proto.common.v1.AnyValue.verify|verify} messages.
                     * @param message AnyValue message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: opentelemetry.proto.common.v1.IAnyValue, writer?: $protobuf.Writer): $protobuf.Writer;
                }

                /** Properties of an ArrayValue. */
                interface IArrayValue {

                    /** ArrayValue values */
                    values?: (opentelemetry.proto.common.v1.IAnyValue[]|null);
                }

                /** Represents an ArrayValue. */
                class ArrayValue implements IArrayValue {

                    /**
                     * Constructs a new ArrayValue.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: opentelemetry.proto.common.v1.IArrayValue);

                    /** ArrayValue values. */
                    public values: opentelemetry.proto.common.v1.IAnyValue[];

                    /**
                     * Encodes the specified ArrayValue message. Does not implicitly {@link opentelemetry.proto.common.v1.ArrayValue.verify|verify} messages.
                     * @param message ArrayValue message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: opentelemetry.proto.common.v1.IArrayValue, writer?: $protobuf.Writer): $protobuf.Writer;
                }

                /** Properties of a KeyValueList. */
                interface IKeyValueList {

                    /** KeyValueList values */
                    values?: (opentelemetry.proto.common.v1.IKeyValue[]|null);
                }

                /** Represents a KeyValueList. */
                class KeyValueList implements IKeyValueList {

                    /**
                     * Constructs a new KeyValueList.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: opentelemetry.proto.common.v1.IKeyValueList);

                    /** KeyValueList values. */
                    public values: opentelemetry.proto.common.v1.IKeyValue[];

                    /**
                     * Encodes the specified KeyValueList message. Does not implicitly {@link opentelemetry.proto.common.v1.KeyValueList.verify|verify} messages.
                     * @param message KeyValueList message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: opentelemetry.proto.common.v1.IKeyValueList, writer?: $protobuf.Writer): $protobuf.Writer;
                }

                /** Properties of a KeyValue. */
                interface IKeyValue {

                    /** KeyValue key */
                    key?: (string|null);

                    /** KeyValue value */
                    value?: (opentelemetry.proto.common.v1.IAnyValue|null);
                }

                /** Represents a KeyValue. */
                class KeyValue implements IKeyValue {

                    /**
                     * Constructs a new KeyValue.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: opentelemetry.proto.common.v1.IKeyValue);

                    /** KeyValue key. */
                    public key: string;

                    /** KeyValue value. */
                    public value?: (opentelemetry.proto.common.v1.IAnyValue|null);

                    /**
                     * Encodes the specified KeyValue message. Does not implicitly {@link opentelemetry.proto.common.v1.KeyValue.verify|verify} messages.
                     * @param message KeyValue message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: opentelemetry.proto.common.v1.IKeyValue, writer?: $protobuf.Writer): $protobuf.Writer;
                }

                /** Properties of an InstrumentationLibrary. */
                interface IInstrumentationLibrary {

                    /** InstrumentationLibrary name */
                    name?: (string|null);

                    /** InstrumentationLibrary version */
                    version?: (string|null);
                }

                /** Represents an InstrumentationLibrary. */
                class InstrumentationLibrary implements IInstrumentationLibrary {

                    /**
                     * Constructs a new InstrumentationLibrary.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: opentelemetry.proto.common.v1.IInstrumentationLibrary);

                    /** InstrumentationLibrary name. */
                    public name: string;

                    /** InstrumentationLibrary version. */
                    public version: string;

                    /**
                     * Encodes the specified InstrumentationLibrary message. Does not implicitly {@link opentelemetry.proto.common.v1.InstrumentationLibrary.verify|verify} messages.
                     * @param message InstrumentationLibrary message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: opentelemetry.proto.common.v1.IInstrumentationLibrary, writer?: $protobuf.Writer): $protobuf.Writer;
                }

                /** Properties of an InstrumentationScope. */
                interface IInstrumentationScope {

                    /** InstrumentationScope name */
                    name?: (string|null);

                    /** InstrumentationScope version */
                    version?: (string|null);
                }

                /** Represents an InstrumentationScope. */
                class InstrumentationScope implements IInstrumentationScope {

                    /**
                     * Constructs a new InstrumentationScope.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: opentelemetry.proto.common.v1.IInstrumentationScope);

                    /** InstrumentationScope name. */
                    public name: string;

                    /** InstrumentationScope version. */
                    public version: string;

                    /**
                     * Encodes the specified InstrumentationScope message. Does not implicitly {@link opentelemetry.proto.common.v1.InstrumentationScope.verify|verify} messages.
                     * @param message InstrumentationScope message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: opentelemetry.proto.common.v1.IInstrumentationScope, writer?: $protobuf.Writer): $protobuf.Writer;
                }
            }
        }

        /** Namespace resource. */
        namespace resource {

            /** Namespace v1. */
            namespace v1 {

                /** Properties of a Resource. */
                interface IResource {

                    /** Resource attributes */
                    attributes?: (opentelemetry.proto.common.v1.IKeyValue[]|null);

                    /** Resource droppedAttributesCount */
                    droppedAttributesCount?: (number|null);
                }

                /** Represents a Resource. */
                class Resource implements IResource {

                    /**
                     * Constructs a new Resource.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: opentelemetry.proto.resource.v1.IResource);

                    /** Resource attributes. */
                    public attributes: opentelemetry.proto.common.v1.IKeyValue[];

                    /** Resource droppedAttributesCount. */
                    public droppedAttributesCount: number;

                    /**
                     * Encodes the specified Resource message. Does not implicitly {@link opentelemetry.proto.resource.v1.Resource.verify|verify} messages.
                     * @param message Resource message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: opentelemetry.proto.resource.v1.IResource, writer?: $protobuf.Writer): $protobuf.Writer;
                }
            }
        }

        /** Namespace logs. */
        namespace logs {

            /** Namespace v1. */
            namespace v1 {

                /** Properties of a LogsData. */
                interface ILogsData {

                    /** LogsData resourceLogs */
                    resourceLogs?: (opentelemetry.proto.logs.v1.IResourceLogs[]|null);
                }

                /** Represents a LogsData. */
                class LogsData implements ILogsData {

                    /**
                     * Constructs a new LogsData.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: opentelemetry.proto.logs.v1.ILogsData);

                    /** LogsData resourceLogs. */
                    public resourceLogs: opentelemetry.proto.logs.v1.IResourceLogs[];

                    /**
                     * Encodes the specified LogsData message. Does not implicitly {@link opentelemetry.proto.logs.v1.LogsData.verify|verify} messages.
                     * @param message LogsData message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: opentelemetry.proto.logs.v1.ILogsData, writer?: $protobuf.Writer): $protobuf.Writer;
                }

                /** Properties of a ResourceLogs. */
                interface IResourceLogs {

                    /** ResourceLogs resource */
                    resource?: (opentelemetry.proto.resource.v1.IResource|null);

                    /** ResourceLogs scopeLogs */
                    scopeLogs?: (opentelemetry.proto.logs.v1.IScopeLogs[]|null);

                    /** ResourceLogs instrumentationLibraryLogs */
                    instrumentationLibraryLogs?: (opentelemetry.proto.logs.v1.IInstrumentationLibraryLogs[]|null);

                    /** ResourceLogs schemaUrl */
                    schemaUrl?: (string|null);
                }

                /** Represents a ResourceLogs. */
                class ResourceLogs implements IResourceLogs {

                    /**
                     * Constructs a new ResourceLogs.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: opentelemetry.proto.logs.v1.IResourceLogs);

                    /** ResourceLogs resource. */
                    public resource?: (opentelemetry.proto.resource.v1.IResource|null);

                    /** ResourceLogs scopeLogs. */
                    public scopeLogs: opentelemetry.proto.logs.v1.IScopeLogs[];

                    /** ResourceLogs instrumentationLibraryLogs. */
                    public instrumentationLibraryLogs: opentelemetry.proto.logs.v1.IInstrumentationLibraryLogs[];

                    /** ResourceLogs schemaUrl. */
                    public schemaUrl: string;

                    /**
                     * Encodes the specified ResourceLogs message. Does not implicitly {@link opentelemetry.proto.logs.v1.ResourceLogs.verify|verify} messages.
                     * @param message ResourceLogs message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: opentelemetry.proto.logs.v1.IResourceLogs, writer?: $protobuf.Writer): $protobuf.Writer;
                }

                /** Properties of a ScopeLogs. */
                interface IScopeLogs {

                    /** ScopeLogs scope */
                    scope?: (opentelemetry.proto.common.v1.IInstrumentationScope|null);

                    /** ScopeLogs logRecords */
                    logRecords?: (opentelemetry.proto.logs.v1.ILogRecord[]|null);

                    /** ScopeLogs schemaUrl */
                    schemaUrl?: (string|null);
                }

                /** Represents a ScopeLogs. */
                class ScopeLogs implements IScopeLogs {

                    /**
                     * Constructs a new ScopeLogs.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: opentelemetry.proto.logs.v1.IScopeLogs);

                    /** ScopeLogs scope. */
                    public scope?: (opentelemetry.proto.common.v1.IInstrumentationScope|null);

                    /** ScopeLogs logRecords. */
                    public logRecords: opentelemetry.proto.logs.v1.ILogRecord[];

                    /** ScopeLogs schemaUrl. */
                    public schemaUrl: string;

                    /**
                     * Encodes the specified ScopeLogs message. Does not implicitly {@link opentelemetry.proto.logs.v1.ScopeLogs.verify|verify} messages.
                     * @param message ScopeLogs message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: opentelemetry.proto.logs.v1.IScopeLogs, writer?: $protobuf.Writer): $protobuf.Writer;
                }

                /** Properties of an InstrumentationLibraryLogs. */
                interface IInstrumentationLibraryLogs {

                    /** InstrumentationLibraryLogs instrumentationLibrary */
                    instrumentationLibrary?: (opentelemetry.proto.common.v1.IInstrumentationLibrary|null);

                    /** InstrumentationLibraryLogs logRecords */
                    logRecords?: (opentelemetry.proto.logs.v1.ILogRecord[]|null);

                    /** InstrumentationLibraryLogs schemaUrl */
                    schemaUrl?: (string|null);
                }

                /** Represents an InstrumentationLibraryLogs. */
                class InstrumentationLibraryLogs implements IInstrumentationLibraryLogs {

                    /**
                     * Constructs a new InstrumentationLibraryLogs.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: opentelemetry.proto.logs.v1.IInstrumentationLibraryLogs);

                    /** InstrumentationLibraryLogs instrumentationLibrary. */
                    public instrumentationLibrary?: (opentelemetry.proto.common.v1.IInstrumentationLibrary|null);

                    /** InstrumentationLibraryLogs logRecords. */
                    public logRecords: opentelemetry.proto.logs.v1.ILogRecord[];

                    /** InstrumentationLibraryLogs schemaUrl. */
                    public schemaUrl: string;

                    /**
                     * Encodes the specified InstrumentationLibraryLogs message. Does not implicitly {@link opentelemetry.proto.logs.v1.InstrumentationLibraryLogs.verify|verify} messages.
                     * @param message InstrumentationLibraryLogs message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: opentelemetry.proto.logs.v1.IInstrumentationLibraryLogs, writer?: $protobuf.Writer): $protobuf.Writer;
                }

                /** SeverityNumber enum. */
                enum SeverityNumber {
                    SEVERITY_NUMBER_UNSPECIFIED = 0,
                    SEVERITY_NUMBER_TRACE = 1,
                    SEVERITY_NUMBER_TRACE2 = 2,
                    SEVERITY_NUMBER_TRACE3 = 3,
                    SEVERITY_NUMBER_TRACE4 = 4,
                    SEVERITY_NUMBER_DEBUG = 5,
                    SEVERITY_NUMBER_DEBUG2 = 6,
                    SEVERITY_NUMBER_DEBUG3 = 7,
                    SEVERITY_NUMBER_DEBUG4 = 8,
                    SEVERITY_NUMBER_INFO = 9,
                    SEVERITY_NUMBER_INFO2 = 10,
                    SEVERITY_NUMBER_INFO3 = 11,
                    SEVERITY_NUMBER_INFO4 = 12,
                    SEVERITY_NUMBER_WARN = 13,
                    SEVERITY_NUMBER_WARN2 = 14,
                    SEVERITY_NUMBER_WARN3 = 15,
                    SEVERITY_NUMBER_WARN4 = 16,
                    SEVERITY_NUMBER_ERROR = 17,
                    SEVERITY_NUMBER_ERROR2 = 18,
                    SEVERITY_NUMBER_ERROR3 = 19,
                    SEVERITY_NUMBER_ERROR4 = 20,
                    SEVERITY_NUMBER_FATAL = 21,
                    SEVERITY_NUMBER_FATAL2 = 22,
                    SEVERITY_NUMBER_FATAL3 = 23,
                    SEVERITY_NUMBER_FATAL4 = 24
                }

                /** LogRecordFlags enum. */
                enum LogRecordFlags {
                    LOG_RECORD_FLAG_UNSPECIFIED = 0,
                    LOG_RECORD_FLAG_TRACE_FLAGS_MASK = 255
                }

                /** Properties of a LogRecord. */
                interface ILogRecord {

                    /** LogRecord timeUnixNano */
                    timeUnixNano?: (number|null);

                    /** LogRecord observedTimeUnixNano */
                    observedTimeUnixNano?: (number|null);

                    /** LogRecord severityNumber */
                    severityNumber?: (opentelemetry.proto.logs.v1.SeverityNumber|null);

                    /** LogRecord severityText */
                    severityText?: (string|null);

                    /** LogRecord body */
                    body?: (opentelemetry.proto.common.v1.IAnyValue|null);

                    /** LogRecord attributes */
                    attributes?: (opentelemetry.proto.common.v1.IKeyValue[]|null);

                    /** LogRecord droppedAttributesCount */
                    droppedAttributesCount?: (number|null);

                    /** LogRecord flags */
                    flags?: (number|null);

                    /** LogRecord traceId */
                    traceId?: (Uint8Array|null);

                    /** LogRecord spanId */
                    spanId?: (Uint8Array|null);
                }

                /** Represents a LogRecord. */
                class LogRecord implements ILogRecord {

                    /**
                     * Constructs a new LogRecord.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: opentelemetry.proto.logs.v1.ILogRecord);

                    /** LogRecord timeUnixNano. */
                    public timeUnixNano: number;

                    /** LogRecord observedTimeUnixNano. */
                    public observedTimeUnixNano: number;

                    /** LogRecord severityNumber. */
                    public severityNumber: opentelemetry.proto.logs.v1.SeverityNumber;

                    /** LogRecord severityText. */
                    public severityText: string;

                    /** LogRecord body. */
                    public body?: (opentelemetry.proto.common.v1.IAnyValue|null);

                    /** LogRecord attributes. */
                    public attributes: opentelemetry.proto.common.v1.IKeyValue[];

                    /** LogRecord droppedAttributesCount. */
                    public droppedAttributesCount: number;

                    /** LogRecord flags. */
                    public flags: number;

                    /** LogRecord traceId. */
                    public traceId: Uint8Array;

                    /** LogRecord spanId. */
                    public spanId: Uint8Array;

                    /**
                     * Encodes the specified LogRecord message. Does not implicitly {@link opentelemetry.proto.logs.v1.LogRecord.verify|verify} messages.
                     * @param message LogRecord message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: opentelemetry.proto.logs.v1.ILogRecord, writer?: $protobuf.Writer): $protobuf.Writer;
                }
            }
        }
    }
}
