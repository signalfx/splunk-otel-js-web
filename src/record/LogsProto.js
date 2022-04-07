/*eslint-disable block-scoped-var, id-length, no-control-regex, no-magic-numbers, no-prototype-builtins, no-redeclare, no-shadow, no-var, sort-vars*/
import * as $protobuf from "protobufjs/minimal";

// Common aliases
const $Writer = $protobuf.Writer, $util = $protobuf.util;

// Exported root namespace
const $root = $protobuf.roots["default"] || ($protobuf.roots["default"] = {});

export const opentelemetry = $root.opentelemetry = (() => {

    /**
     * Namespace opentelemetry.
     * @exports opentelemetry
     * @namespace
     */
    const opentelemetry = {};

    opentelemetry.proto = (function() {

        /**
         * Namespace proto.
         * @memberof opentelemetry
         * @namespace
         */
        const proto = {};

        proto.common = (function() {

            /**
             * Namespace common.
             * @memberof opentelemetry.proto
             * @namespace
             */
            const common = {};

            common.v1 = (function() {

                /**
                 * Namespace v1.
                 * @memberof opentelemetry.proto.common
                 * @namespace
                 */
                const v1 = {};

                v1.AnyValue = (function() {

                    /**
                     * Properties of an AnyValue.
                     * @memberof opentelemetry.proto.common.v1
                     * @interface IAnyValue
                     * @property {string|null} [stringValue] AnyValue stringValue
                     * @property {boolean|null} [boolValue] AnyValue boolValue
                     * @property {number|null} [intValue] AnyValue intValue
                     * @property {number|null} [doubleValue] AnyValue doubleValue
                     * @property {opentelemetry.proto.common.v1.IArrayValue|null} [arrayValue] AnyValue arrayValue
                     * @property {opentelemetry.proto.common.v1.IKeyValueList|null} [kvlistValue] AnyValue kvlistValue
                     * @property {Uint8Array|null} [bytesValue] AnyValue bytesValue
                     */

                    /**
                     * Constructs a new AnyValue.
                     * @memberof opentelemetry.proto.common.v1
                     * @classdesc Represents an AnyValue.
                     * @implements IAnyValue
                     * @constructor
                     * @param {opentelemetry.proto.common.v1.IAnyValue=} [properties] Properties to set
                     */
                    function AnyValue(properties) {
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * AnyValue stringValue.
                     * @member {string|null|undefined} stringValue
                     * @memberof opentelemetry.proto.common.v1.AnyValue
                     * @instance
                     */
                    AnyValue.prototype.stringValue = null;

                    /**
                     * AnyValue boolValue.
                     * @member {boolean|null|undefined} boolValue
                     * @memberof opentelemetry.proto.common.v1.AnyValue
                     * @instance
                     */
                    AnyValue.prototype.boolValue = null;

                    /**
                     * AnyValue intValue.
                     * @member {number|null|undefined} intValue
                     * @memberof opentelemetry.proto.common.v1.AnyValue
                     * @instance
                     */
                    AnyValue.prototype.intValue = null;

                    /**
                     * AnyValue doubleValue.
                     * @member {number|null|undefined} doubleValue
                     * @memberof opentelemetry.proto.common.v1.AnyValue
                     * @instance
                     */
                    AnyValue.prototype.doubleValue = null;

                    /**
                     * AnyValue arrayValue.
                     * @member {opentelemetry.proto.common.v1.IArrayValue|null|undefined} arrayValue
                     * @memberof opentelemetry.proto.common.v1.AnyValue
                     * @instance
                     */
                    AnyValue.prototype.arrayValue = null;

                    /**
                     * AnyValue kvlistValue.
                     * @member {opentelemetry.proto.common.v1.IKeyValueList|null|undefined} kvlistValue
                     * @memberof opentelemetry.proto.common.v1.AnyValue
                     * @instance
                     */
                    AnyValue.prototype.kvlistValue = null;

                    /**
                     * AnyValue bytesValue.
                     * @member {Uint8Array|null|undefined} bytesValue
                     * @memberof opentelemetry.proto.common.v1.AnyValue
                     * @instance
                     */
                    AnyValue.prototype.bytesValue = null;

                    // OneOf field names bound to virtual getters and setters
                    let $oneOfFields;

                    /**
                     * AnyValue value.
                     * @member {"stringValue"|"boolValue"|"intValue"|"doubleValue"|"arrayValue"|"kvlistValue"|"bytesValue"|undefined} value
                     * @memberof opentelemetry.proto.common.v1.AnyValue
                     * @instance
                     */
                    Object.defineProperty(AnyValue.prototype, "value", {
                        get: $util.oneOfGetter($oneOfFields = ["stringValue", "boolValue", "intValue", "doubleValue", "arrayValue", "kvlistValue", "bytesValue"]),
                        set: $util.oneOfSetter($oneOfFields)
                    });

                    /**
                     * Encodes the specified AnyValue message. Does not implicitly {@link opentelemetry.proto.common.v1.AnyValue.verify|verify} messages.
                     * @function encode
                     * @memberof opentelemetry.proto.common.v1.AnyValue
                     * @static
                     * @param {opentelemetry.proto.common.v1.IAnyValue} message AnyValue message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    AnyValue.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message.stringValue != null && Object.hasOwnProperty.call(message, "stringValue"))
                            writer.uint32(/* id 1, wireType 2 =*/10).string(message.stringValue);
                        if (message.boolValue != null && Object.hasOwnProperty.call(message, "boolValue"))
                            writer.uint32(/* id 2, wireType 0 =*/16).bool(message.boolValue);
                        if (message.intValue != null && Object.hasOwnProperty.call(message, "intValue"))
                            writer.uint32(/* id 3, wireType 0 =*/24).int64(message.intValue);
                        if (message.doubleValue != null && Object.hasOwnProperty.call(message, "doubleValue"))
                            writer.uint32(/* id 4, wireType 1 =*/33).double(message.doubleValue);
                        if (message.arrayValue != null && Object.hasOwnProperty.call(message, "arrayValue"))
                            $root.opentelemetry.proto.common.v1.ArrayValue.encode(message.arrayValue, writer.uint32(/* id 5, wireType 2 =*/42).fork()).ldelim();
                        if (message.kvlistValue != null && Object.hasOwnProperty.call(message, "kvlistValue"))
                            $root.opentelemetry.proto.common.v1.KeyValueList.encode(message.kvlistValue, writer.uint32(/* id 6, wireType 2 =*/50).fork()).ldelim();
                        if (message.bytesValue != null && Object.hasOwnProperty.call(message, "bytesValue"))
                            writer.uint32(/* id 7, wireType 2 =*/58).bytes(message.bytesValue);
                        return writer;
                    };

                    return AnyValue;
                })();

                v1.ArrayValue = (function() {

                    /**
                     * Properties of an ArrayValue.
                     * @memberof opentelemetry.proto.common.v1
                     * @interface IArrayValue
                     * @property {Array.<opentelemetry.proto.common.v1.IAnyValue>|null} [values] ArrayValue values
                     */

                    /**
                     * Constructs a new ArrayValue.
                     * @memberof opentelemetry.proto.common.v1
                     * @classdesc Represents an ArrayValue.
                     * @implements IArrayValue
                     * @constructor
                     * @param {opentelemetry.proto.common.v1.IArrayValue=} [properties] Properties to set
                     */
                    function ArrayValue(properties) {
                        this.values = [];
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * ArrayValue values.
                     * @member {Array.<opentelemetry.proto.common.v1.IAnyValue>} values
                     * @memberof opentelemetry.proto.common.v1.ArrayValue
                     * @instance
                     */
                    ArrayValue.prototype.values = $util.emptyArray;

                    /**
                     * Encodes the specified ArrayValue message. Does not implicitly {@link opentelemetry.proto.common.v1.ArrayValue.verify|verify} messages.
                     * @function encode
                     * @memberof opentelemetry.proto.common.v1.ArrayValue
                     * @static
                     * @param {opentelemetry.proto.common.v1.IArrayValue} message ArrayValue message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    ArrayValue.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message.values != null && message.values.length)
                            for (let i = 0; i < message.values.length; ++i)
                                $root.opentelemetry.proto.common.v1.AnyValue.encode(message.values[i], writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
                        return writer;
                    };

                    return ArrayValue;
                })();

                v1.KeyValueList = (function() {

                    /**
                     * Properties of a KeyValueList.
                     * @memberof opentelemetry.proto.common.v1
                     * @interface IKeyValueList
                     * @property {Array.<opentelemetry.proto.common.v1.IKeyValue>|null} [values] KeyValueList values
                     */

                    /**
                     * Constructs a new KeyValueList.
                     * @memberof opentelemetry.proto.common.v1
                     * @classdesc Represents a KeyValueList.
                     * @implements IKeyValueList
                     * @constructor
                     * @param {opentelemetry.proto.common.v1.IKeyValueList=} [properties] Properties to set
                     */
                    function KeyValueList(properties) {
                        this.values = [];
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * KeyValueList values.
                     * @member {Array.<opentelemetry.proto.common.v1.IKeyValue>} values
                     * @memberof opentelemetry.proto.common.v1.KeyValueList
                     * @instance
                     */
                    KeyValueList.prototype.values = $util.emptyArray;

                    /**
                     * Encodes the specified KeyValueList message. Does not implicitly {@link opentelemetry.proto.common.v1.KeyValueList.verify|verify} messages.
                     * @function encode
                     * @memberof opentelemetry.proto.common.v1.KeyValueList
                     * @static
                     * @param {opentelemetry.proto.common.v1.IKeyValueList} message KeyValueList message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    KeyValueList.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message.values != null && message.values.length)
                            for (let i = 0; i < message.values.length; ++i)
                                $root.opentelemetry.proto.common.v1.KeyValue.encode(message.values[i], writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
                        return writer;
                    };

                    return KeyValueList;
                })();

                v1.KeyValue = (function() {

                    /**
                     * Properties of a KeyValue.
                     * @memberof opentelemetry.proto.common.v1
                     * @interface IKeyValue
                     * @property {string|null} [key] KeyValue key
                     * @property {opentelemetry.proto.common.v1.IAnyValue|null} [value] KeyValue value
                     */

                    /**
                     * Constructs a new KeyValue.
                     * @memberof opentelemetry.proto.common.v1
                     * @classdesc Represents a KeyValue.
                     * @implements IKeyValue
                     * @constructor
                     * @param {opentelemetry.proto.common.v1.IKeyValue=} [properties] Properties to set
                     */
                    function KeyValue(properties) {
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * KeyValue key.
                     * @member {string} key
                     * @memberof opentelemetry.proto.common.v1.KeyValue
                     * @instance
                     */
                    KeyValue.prototype.key = "";

                    /**
                     * KeyValue value.
                     * @member {opentelemetry.proto.common.v1.IAnyValue|null|undefined} value
                     * @memberof opentelemetry.proto.common.v1.KeyValue
                     * @instance
                     */
                    KeyValue.prototype.value = null;

                    /**
                     * Encodes the specified KeyValue message. Does not implicitly {@link opentelemetry.proto.common.v1.KeyValue.verify|verify} messages.
                     * @function encode
                     * @memberof opentelemetry.proto.common.v1.KeyValue
                     * @static
                     * @param {opentelemetry.proto.common.v1.IKeyValue} message KeyValue message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    KeyValue.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message.key != null && Object.hasOwnProperty.call(message, "key"))
                            writer.uint32(/* id 1, wireType 2 =*/10).string(message.key);
                        if (message.value != null && Object.hasOwnProperty.call(message, "value"))
                            $root.opentelemetry.proto.common.v1.AnyValue.encode(message.value, writer.uint32(/* id 2, wireType 2 =*/18).fork()).ldelim();
                        return writer;
                    };

                    return KeyValue;
                })();

                v1.InstrumentationLibrary = (function() {

                    /**
                     * Properties of an InstrumentationLibrary.
                     * @memberof opentelemetry.proto.common.v1
                     * @interface IInstrumentationLibrary
                     * @property {string|null} [name] InstrumentationLibrary name
                     * @property {string|null} [version] InstrumentationLibrary version
                     */

                    /**
                     * Constructs a new InstrumentationLibrary.
                     * @memberof opentelemetry.proto.common.v1
                     * @classdesc Represents an InstrumentationLibrary.
                     * @implements IInstrumentationLibrary
                     * @constructor
                     * @param {opentelemetry.proto.common.v1.IInstrumentationLibrary=} [properties] Properties to set
                     */
                    function InstrumentationLibrary(properties) {
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * InstrumentationLibrary name.
                     * @member {string} name
                     * @memberof opentelemetry.proto.common.v1.InstrumentationLibrary
                     * @instance
                     */
                    InstrumentationLibrary.prototype.name = "";

                    /**
                     * InstrumentationLibrary version.
                     * @member {string} version
                     * @memberof opentelemetry.proto.common.v1.InstrumentationLibrary
                     * @instance
                     */
                    InstrumentationLibrary.prototype.version = "";

                    /**
                     * Encodes the specified InstrumentationLibrary message. Does not implicitly {@link opentelemetry.proto.common.v1.InstrumentationLibrary.verify|verify} messages.
                     * @function encode
                     * @memberof opentelemetry.proto.common.v1.InstrumentationLibrary
                     * @static
                     * @param {opentelemetry.proto.common.v1.IInstrumentationLibrary} message InstrumentationLibrary message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    InstrumentationLibrary.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message.name != null && Object.hasOwnProperty.call(message, "name"))
                            writer.uint32(/* id 1, wireType 2 =*/10).string(message.name);
                        if (message.version != null && Object.hasOwnProperty.call(message, "version"))
                            writer.uint32(/* id 2, wireType 2 =*/18).string(message.version);
                        return writer;
                    };

                    return InstrumentationLibrary;
                })();

                v1.InstrumentationScope = (function() {

                    /**
                     * Properties of an InstrumentationScope.
                     * @memberof opentelemetry.proto.common.v1
                     * @interface IInstrumentationScope
                     * @property {string|null} [name] InstrumentationScope name
                     * @property {string|null} [version] InstrumentationScope version
                     */

                    /**
                     * Constructs a new InstrumentationScope.
                     * @memberof opentelemetry.proto.common.v1
                     * @classdesc Represents an InstrumentationScope.
                     * @implements IInstrumentationScope
                     * @constructor
                     * @param {opentelemetry.proto.common.v1.IInstrumentationScope=} [properties] Properties to set
                     */
                    function InstrumentationScope(properties) {
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * InstrumentationScope name.
                     * @member {string} name
                     * @memberof opentelemetry.proto.common.v1.InstrumentationScope
                     * @instance
                     */
                    InstrumentationScope.prototype.name = "";

                    /**
                     * InstrumentationScope version.
                     * @member {string} version
                     * @memberof opentelemetry.proto.common.v1.InstrumentationScope
                     * @instance
                     */
                    InstrumentationScope.prototype.version = "";

                    /**
                     * Encodes the specified InstrumentationScope message. Does not implicitly {@link opentelemetry.proto.common.v1.InstrumentationScope.verify|verify} messages.
                     * @function encode
                     * @memberof opentelemetry.proto.common.v1.InstrumentationScope
                     * @static
                     * @param {opentelemetry.proto.common.v1.IInstrumentationScope} message InstrumentationScope message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    InstrumentationScope.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message.name != null && Object.hasOwnProperty.call(message, "name"))
                            writer.uint32(/* id 1, wireType 2 =*/10).string(message.name);
                        if (message.version != null && Object.hasOwnProperty.call(message, "version"))
                            writer.uint32(/* id 2, wireType 2 =*/18).string(message.version);
                        return writer;
                    };

                    return InstrumentationScope;
                })();

                return v1;
            })();

            return common;
        })();

        proto.resource = (function() {

            /**
             * Namespace resource.
             * @memberof opentelemetry.proto
             * @namespace
             */
            const resource = {};

            resource.v1 = (function() {

                /**
                 * Namespace v1.
                 * @memberof opentelemetry.proto.resource
                 * @namespace
                 */
                const v1 = {};

                v1.Resource = (function() {

                    /**
                     * Properties of a Resource.
                     * @memberof opentelemetry.proto.resource.v1
                     * @interface IResource
                     * @property {Array.<opentelemetry.proto.common.v1.IKeyValue>|null} [attributes] Resource attributes
                     * @property {number|null} [droppedAttributesCount] Resource droppedAttributesCount
                     */

                    /**
                     * Constructs a new Resource.
                     * @memberof opentelemetry.proto.resource.v1
                     * @classdesc Represents a Resource.
                     * @implements IResource
                     * @constructor
                     * @param {opentelemetry.proto.resource.v1.IResource=} [properties] Properties to set
                     */
                    function Resource(properties) {
                        this.attributes = [];
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * Resource attributes.
                     * @member {Array.<opentelemetry.proto.common.v1.IKeyValue>} attributes
                     * @memberof opentelemetry.proto.resource.v1.Resource
                     * @instance
                     */
                    Resource.prototype.attributes = $util.emptyArray;

                    /**
                     * Resource droppedAttributesCount.
                     * @member {number} droppedAttributesCount
                     * @memberof opentelemetry.proto.resource.v1.Resource
                     * @instance
                     */
                    Resource.prototype.droppedAttributesCount = 0;

                    /**
                     * Encodes the specified Resource message. Does not implicitly {@link opentelemetry.proto.resource.v1.Resource.verify|verify} messages.
                     * @function encode
                     * @memberof opentelemetry.proto.resource.v1.Resource
                     * @static
                     * @param {opentelemetry.proto.resource.v1.IResource} message Resource message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    Resource.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message.attributes != null && message.attributes.length)
                            for (let i = 0; i < message.attributes.length; ++i)
                                $root.opentelemetry.proto.common.v1.KeyValue.encode(message.attributes[i], writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
                        if (message.droppedAttributesCount != null && Object.hasOwnProperty.call(message, "droppedAttributesCount"))
                            writer.uint32(/* id 2, wireType 0 =*/16).uint32(message.droppedAttributesCount);
                        return writer;
                    };

                    return Resource;
                })();

                return v1;
            })();

            return resource;
        })();

        proto.logs = (function() {

            /**
             * Namespace logs.
             * @memberof opentelemetry.proto
             * @namespace
             */
            const logs = {};

            logs.v1 = (function() {

                /**
                 * Namespace v1.
                 * @memberof opentelemetry.proto.logs
                 * @namespace
                 */
                const v1 = {};

                v1.LogsData = (function() {

                    /**
                     * Properties of a LogsData.
                     * @memberof opentelemetry.proto.logs.v1
                     * @interface ILogsData
                     * @property {Array.<opentelemetry.proto.logs.v1.IResourceLogs>|null} [resourceLogs] LogsData resourceLogs
                     */

                    /**
                     * Constructs a new LogsData.
                     * @memberof opentelemetry.proto.logs.v1
                     * @classdesc Represents a LogsData.
                     * @implements ILogsData
                     * @constructor
                     * @param {opentelemetry.proto.logs.v1.ILogsData=} [properties] Properties to set
                     */
                    function LogsData(properties) {
                        this.resourceLogs = [];
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * LogsData resourceLogs.
                     * @member {Array.<opentelemetry.proto.logs.v1.IResourceLogs>} resourceLogs
                     * @memberof opentelemetry.proto.logs.v1.LogsData
                     * @instance
                     */
                    LogsData.prototype.resourceLogs = $util.emptyArray;

                    /**
                     * Encodes the specified LogsData message. Does not implicitly {@link opentelemetry.proto.logs.v1.LogsData.verify|verify} messages.
                     * @function encode
                     * @memberof opentelemetry.proto.logs.v1.LogsData
                     * @static
                     * @param {opentelemetry.proto.logs.v1.ILogsData} message LogsData message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    LogsData.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message.resourceLogs != null && message.resourceLogs.length)
                            for (let i = 0; i < message.resourceLogs.length; ++i)
                                $root.opentelemetry.proto.logs.v1.ResourceLogs.encode(message.resourceLogs[i], writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
                        return writer;
                    };

                    return LogsData;
                })();

                v1.ResourceLogs = (function() {

                    /**
                     * Properties of a ResourceLogs.
                     * @memberof opentelemetry.proto.logs.v1
                     * @interface IResourceLogs
                     * @property {opentelemetry.proto.resource.v1.IResource|null} [resource] ResourceLogs resource
                     * @property {Array.<opentelemetry.proto.logs.v1.IScopeLogs>|null} [scopeLogs] ResourceLogs scopeLogs
                     * @property {Array.<opentelemetry.proto.logs.v1.IInstrumentationLibraryLogs>|null} [instrumentationLibraryLogs] ResourceLogs instrumentationLibraryLogs
                     * @property {string|null} [schemaUrl] ResourceLogs schemaUrl
                     */

                    /**
                     * Constructs a new ResourceLogs.
                     * @memberof opentelemetry.proto.logs.v1
                     * @classdesc Represents a ResourceLogs.
                     * @implements IResourceLogs
                     * @constructor
                     * @param {opentelemetry.proto.logs.v1.IResourceLogs=} [properties] Properties to set
                     */
                    function ResourceLogs(properties) {
                        this.scopeLogs = [];
                        this.instrumentationLibraryLogs = [];
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * ResourceLogs resource.
                     * @member {opentelemetry.proto.resource.v1.IResource|null|undefined} resource
                     * @memberof opentelemetry.proto.logs.v1.ResourceLogs
                     * @instance
                     */
                    ResourceLogs.prototype.resource = null;

                    /**
                     * ResourceLogs scopeLogs.
                     * @member {Array.<opentelemetry.proto.logs.v1.IScopeLogs>} scopeLogs
                     * @memberof opentelemetry.proto.logs.v1.ResourceLogs
                     * @instance
                     */
                    ResourceLogs.prototype.scopeLogs = $util.emptyArray;

                    /**
                     * ResourceLogs instrumentationLibraryLogs.
                     * @member {Array.<opentelemetry.proto.logs.v1.IInstrumentationLibraryLogs>} instrumentationLibraryLogs
                     * @memberof opentelemetry.proto.logs.v1.ResourceLogs
                     * @instance
                     */
                    ResourceLogs.prototype.instrumentationLibraryLogs = $util.emptyArray;

                    /**
                     * ResourceLogs schemaUrl.
                     * @member {string} schemaUrl
                     * @memberof opentelemetry.proto.logs.v1.ResourceLogs
                     * @instance
                     */
                    ResourceLogs.prototype.schemaUrl = "";

                    /**
                     * Encodes the specified ResourceLogs message. Does not implicitly {@link opentelemetry.proto.logs.v1.ResourceLogs.verify|verify} messages.
                     * @function encode
                     * @memberof opentelemetry.proto.logs.v1.ResourceLogs
                     * @static
                     * @param {opentelemetry.proto.logs.v1.IResourceLogs} message ResourceLogs message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    ResourceLogs.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message.resource != null && Object.hasOwnProperty.call(message, "resource"))
                            $root.opentelemetry.proto.resource.v1.Resource.encode(message.resource, writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
                        if (message.scopeLogs != null && message.scopeLogs.length)
                            for (let i = 0; i < message.scopeLogs.length; ++i)
                                $root.opentelemetry.proto.logs.v1.ScopeLogs.encode(message.scopeLogs[i], writer.uint32(/* id 2, wireType 2 =*/18).fork()).ldelim();
                        if (message.schemaUrl != null && Object.hasOwnProperty.call(message, "schemaUrl"))
                            writer.uint32(/* id 3, wireType 2 =*/26).string(message.schemaUrl);
                        if (message.instrumentationLibraryLogs != null && message.instrumentationLibraryLogs.length)
                            for (let i = 0; i < message.instrumentationLibraryLogs.length; ++i)
                                $root.opentelemetry.proto.logs.v1.InstrumentationLibraryLogs.encode(message.instrumentationLibraryLogs[i], writer.uint32(/* id 1000, wireType 2 =*/8002).fork()).ldelim();
                        return writer;
                    };

                    return ResourceLogs;
                })();

                v1.ScopeLogs = (function() {

                    /**
                     * Properties of a ScopeLogs.
                     * @memberof opentelemetry.proto.logs.v1
                     * @interface IScopeLogs
                     * @property {opentelemetry.proto.common.v1.IInstrumentationScope|null} [scope] ScopeLogs scope
                     * @property {Array.<opentelemetry.proto.logs.v1.ILogRecord>|null} [logRecords] ScopeLogs logRecords
                     * @property {string|null} [schemaUrl] ScopeLogs schemaUrl
                     */

                    /**
                     * Constructs a new ScopeLogs.
                     * @memberof opentelemetry.proto.logs.v1
                     * @classdesc Represents a ScopeLogs.
                     * @implements IScopeLogs
                     * @constructor
                     * @param {opentelemetry.proto.logs.v1.IScopeLogs=} [properties] Properties to set
                     */
                    function ScopeLogs(properties) {
                        this.logRecords = [];
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * ScopeLogs scope.
                     * @member {opentelemetry.proto.common.v1.IInstrumentationScope|null|undefined} scope
                     * @memberof opentelemetry.proto.logs.v1.ScopeLogs
                     * @instance
                     */
                    ScopeLogs.prototype.scope = null;

                    /**
                     * ScopeLogs logRecords.
                     * @member {Array.<opentelemetry.proto.logs.v1.ILogRecord>} logRecords
                     * @memberof opentelemetry.proto.logs.v1.ScopeLogs
                     * @instance
                     */
                    ScopeLogs.prototype.logRecords = $util.emptyArray;

                    /**
                     * ScopeLogs schemaUrl.
                     * @member {string} schemaUrl
                     * @memberof opentelemetry.proto.logs.v1.ScopeLogs
                     * @instance
                     */
                    ScopeLogs.prototype.schemaUrl = "";

                    /**
                     * Encodes the specified ScopeLogs message. Does not implicitly {@link opentelemetry.proto.logs.v1.ScopeLogs.verify|verify} messages.
                     * @function encode
                     * @memberof opentelemetry.proto.logs.v1.ScopeLogs
                     * @static
                     * @param {opentelemetry.proto.logs.v1.IScopeLogs} message ScopeLogs message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    ScopeLogs.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message.scope != null && Object.hasOwnProperty.call(message, "scope"))
                            $root.opentelemetry.proto.common.v1.InstrumentationScope.encode(message.scope, writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
                        if (message.logRecords != null && message.logRecords.length)
                            for (let i = 0; i < message.logRecords.length; ++i)
                                $root.opentelemetry.proto.logs.v1.LogRecord.encode(message.logRecords[i], writer.uint32(/* id 2, wireType 2 =*/18).fork()).ldelim();
                        if (message.schemaUrl != null && Object.hasOwnProperty.call(message, "schemaUrl"))
                            writer.uint32(/* id 3, wireType 2 =*/26).string(message.schemaUrl);
                        return writer;
                    };

                    return ScopeLogs;
                })();

                v1.InstrumentationLibraryLogs = (function() {

                    /**
                     * Properties of an InstrumentationLibraryLogs.
                     * @memberof opentelemetry.proto.logs.v1
                     * @interface IInstrumentationLibraryLogs
                     * @property {opentelemetry.proto.common.v1.IInstrumentationLibrary|null} [instrumentationLibrary] InstrumentationLibraryLogs instrumentationLibrary
                     * @property {Array.<opentelemetry.proto.logs.v1.ILogRecord>|null} [logRecords] InstrumentationLibraryLogs logRecords
                     * @property {string|null} [schemaUrl] InstrumentationLibraryLogs schemaUrl
                     */

                    /**
                     * Constructs a new InstrumentationLibraryLogs.
                     * @memberof opentelemetry.proto.logs.v1
                     * @classdesc Represents an InstrumentationLibraryLogs.
                     * @implements IInstrumentationLibraryLogs
                     * @constructor
                     * @param {opentelemetry.proto.logs.v1.IInstrumentationLibraryLogs=} [properties] Properties to set
                     */
                    function InstrumentationLibraryLogs(properties) {
                        this.logRecords = [];
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * InstrumentationLibraryLogs instrumentationLibrary.
                     * @member {opentelemetry.proto.common.v1.IInstrumentationLibrary|null|undefined} instrumentationLibrary
                     * @memberof opentelemetry.proto.logs.v1.InstrumentationLibraryLogs
                     * @instance
                     */
                    InstrumentationLibraryLogs.prototype.instrumentationLibrary = null;

                    /**
                     * InstrumentationLibraryLogs logRecords.
                     * @member {Array.<opentelemetry.proto.logs.v1.ILogRecord>} logRecords
                     * @memberof opentelemetry.proto.logs.v1.InstrumentationLibraryLogs
                     * @instance
                     */
                    InstrumentationLibraryLogs.prototype.logRecords = $util.emptyArray;

                    /**
                     * InstrumentationLibraryLogs schemaUrl.
                     * @member {string} schemaUrl
                     * @memberof opentelemetry.proto.logs.v1.InstrumentationLibraryLogs
                     * @instance
                     */
                    InstrumentationLibraryLogs.prototype.schemaUrl = "";

                    /**
                     * Encodes the specified InstrumentationLibraryLogs message. Does not implicitly {@link opentelemetry.proto.logs.v1.InstrumentationLibraryLogs.verify|verify} messages.
                     * @function encode
                     * @memberof opentelemetry.proto.logs.v1.InstrumentationLibraryLogs
                     * @static
                     * @param {opentelemetry.proto.logs.v1.IInstrumentationLibraryLogs} message InstrumentationLibraryLogs message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    InstrumentationLibraryLogs.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message.instrumentationLibrary != null && Object.hasOwnProperty.call(message, "instrumentationLibrary"))
                            $root.opentelemetry.proto.common.v1.InstrumentationLibrary.encode(message.instrumentationLibrary, writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
                        if (message.logRecords != null && message.logRecords.length)
                            for (let i = 0; i < message.logRecords.length; ++i)
                                $root.opentelemetry.proto.logs.v1.LogRecord.encode(message.logRecords[i], writer.uint32(/* id 2, wireType 2 =*/18).fork()).ldelim();
                        if (message.schemaUrl != null && Object.hasOwnProperty.call(message, "schemaUrl"))
                            writer.uint32(/* id 3, wireType 2 =*/26).string(message.schemaUrl);
                        return writer;
                    };

                    return InstrumentationLibraryLogs;
                })();

                /**
                 * SeverityNumber enum.
                 * @name opentelemetry.proto.logs.v1.SeverityNumber
                 * @enum {number}
                 * @property {number} SEVERITY_NUMBER_UNSPECIFIED=0 SEVERITY_NUMBER_UNSPECIFIED value
                 * @property {number} SEVERITY_NUMBER_TRACE=1 SEVERITY_NUMBER_TRACE value
                 * @property {number} SEVERITY_NUMBER_TRACE2=2 SEVERITY_NUMBER_TRACE2 value
                 * @property {number} SEVERITY_NUMBER_TRACE3=3 SEVERITY_NUMBER_TRACE3 value
                 * @property {number} SEVERITY_NUMBER_TRACE4=4 SEVERITY_NUMBER_TRACE4 value
                 * @property {number} SEVERITY_NUMBER_DEBUG=5 SEVERITY_NUMBER_DEBUG value
                 * @property {number} SEVERITY_NUMBER_DEBUG2=6 SEVERITY_NUMBER_DEBUG2 value
                 * @property {number} SEVERITY_NUMBER_DEBUG3=7 SEVERITY_NUMBER_DEBUG3 value
                 * @property {number} SEVERITY_NUMBER_DEBUG4=8 SEVERITY_NUMBER_DEBUG4 value
                 * @property {number} SEVERITY_NUMBER_INFO=9 SEVERITY_NUMBER_INFO value
                 * @property {number} SEVERITY_NUMBER_INFO2=10 SEVERITY_NUMBER_INFO2 value
                 * @property {number} SEVERITY_NUMBER_INFO3=11 SEVERITY_NUMBER_INFO3 value
                 * @property {number} SEVERITY_NUMBER_INFO4=12 SEVERITY_NUMBER_INFO4 value
                 * @property {number} SEVERITY_NUMBER_WARN=13 SEVERITY_NUMBER_WARN value
                 * @property {number} SEVERITY_NUMBER_WARN2=14 SEVERITY_NUMBER_WARN2 value
                 * @property {number} SEVERITY_NUMBER_WARN3=15 SEVERITY_NUMBER_WARN3 value
                 * @property {number} SEVERITY_NUMBER_WARN4=16 SEVERITY_NUMBER_WARN4 value
                 * @property {number} SEVERITY_NUMBER_ERROR=17 SEVERITY_NUMBER_ERROR value
                 * @property {number} SEVERITY_NUMBER_ERROR2=18 SEVERITY_NUMBER_ERROR2 value
                 * @property {number} SEVERITY_NUMBER_ERROR3=19 SEVERITY_NUMBER_ERROR3 value
                 * @property {number} SEVERITY_NUMBER_ERROR4=20 SEVERITY_NUMBER_ERROR4 value
                 * @property {number} SEVERITY_NUMBER_FATAL=21 SEVERITY_NUMBER_FATAL value
                 * @property {number} SEVERITY_NUMBER_FATAL2=22 SEVERITY_NUMBER_FATAL2 value
                 * @property {number} SEVERITY_NUMBER_FATAL3=23 SEVERITY_NUMBER_FATAL3 value
                 * @property {number} SEVERITY_NUMBER_FATAL4=24 SEVERITY_NUMBER_FATAL4 value
                 */
                v1.SeverityNumber = (function() {
                    const valuesById = {}, values = Object.create(valuesById);
                    values[valuesById[0] = "SEVERITY_NUMBER_UNSPECIFIED"] = 0;
                    values[valuesById[1] = "SEVERITY_NUMBER_TRACE"] = 1;
                    values[valuesById[2] = "SEVERITY_NUMBER_TRACE2"] = 2;
                    values[valuesById[3] = "SEVERITY_NUMBER_TRACE3"] = 3;
                    values[valuesById[4] = "SEVERITY_NUMBER_TRACE4"] = 4;
                    values[valuesById[5] = "SEVERITY_NUMBER_DEBUG"] = 5;
                    values[valuesById[6] = "SEVERITY_NUMBER_DEBUG2"] = 6;
                    values[valuesById[7] = "SEVERITY_NUMBER_DEBUG3"] = 7;
                    values[valuesById[8] = "SEVERITY_NUMBER_DEBUG4"] = 8;
                    values[valuesById[9] = "SEVERITY_NUMBER_INFO"] = 9;
                    values[valuesById[10] = "SEVERITY_NUMBER_INFO2"] = 10;
                    values[valuesById[11] = "SEVERITY_NUMBER_INFO3"] = 11;
                    values[valuesById[12] = "SEVERITY_NUMBER_INFO4"] = 12;
                    values[valuesById[13] = "SEVERITY_NUMBER_WARN"] = 13;
                    values[valuesById[14] = "SEVERITY_NUMBER_WARN2"] = 14;
                    values[valuesById[15] = "SEVERITY_NUMBER_WARN3"] = 15;
                    values[valuesById[16] = "SEVERITY_NUMBER_WARN4"] = 16;
                    values[valuesById[17] = "SEVERITY_NUMBER_ERROR"] = 17;
                    values[valuesById[18] = "SEVERITY_NUMBER_ERROR2"] = 18;
                    values[valuesById[19] = "SEVERITY_NUMBER_ERROR3"] = 19;
                    values[valuesById[20] = "SEVERITY_NUMBER_ERROR4"] = 20;
                    values[valuesById[21] = "SEVERITY_NUMBER_FATAL"] = 21;
                    values[valuesById[22] = "SEVERITY_NUMBER_FATAL2"] = 22;
                    values[valuesById[23] = "SEVERITY_NUMBER_FATAL3"] = 23;
                    values[valuesById[24] = "SEVERITY_NUMBER_FATAL4"] = 24;
                    return values;
                })();

                /**
                 * LogRecordFlags enum.
                 * @name opentelemetry.proto.logs.v1.LogRecordFlags
                 * @enum {number}
                 * @property {number} LOG_RECORD_FLAG_UNSPECIFIED=0 LOG_RECORD_FLAG_UNSPECIFIED value
                 * @property {number} LOG_RECORD_FLAG_TRACE_FLAGS_MASK=255 LOG_RECORD_FLAG_TRACE_FLAGS_MASK value
                 */
                v1.LogRecordFlags = (function() {
                    const valuesById = {}, values = Object.create(valuesById);
                    values[valuesById[0] = "LOG_RECORD_FLAG_UNSPECIFIED"] = 0;
                    values[valuesById[255] = "LOG_RECORD_FLAG_TRACE_FLAGS_MASK"] = 255;
                    return values;
                })();

                v1.LogRecord = (function() {

                    /**
                     * Properties of a LogRecord.
                     * @memberof opentelemetry.proto.logs.v1
                     * @interface ILogRecord
                     * @property {number|null} [timeUnixNano] LogRecord timeUnixNano
                     * @property {number|null} [observedTimeUnixNano] LogRecord observedTimeUnixNano
                     * @property {opentelemetry.proto.logs.v1.SeverityNumber|null} [severityNumber] LogRecord severityNumber
                     * @property {string|null} [severityText] LogRecord severityText
                     * @property {opentelemetry.proto.common.v1.IAnyValue|null} [body] LogRecord body
                     * @property {Array.<opentelemetry.proto.common.v1.IKeyValue>|null} [attributes] LogRecord attributes
                     * @property {number|null} [droppedAttributesCount] LogRecord droppedAttributesCount
                     * @property {number|null} [flags] LogRecord flags
                     * @property {Uint8Array|null} [traceId] LogRecord traceId
                     * @property {Uint8Array|null} [spanId] LogRecord spanId
                     */

                    /**
                     * Constructs a new LogRecord.
                     * @memberof opentelemetry.proto.logs.v1
                     * @classdesc Represents a LogRecord.
                     * @implements ILogRecord
                     * @constructor
                     * @param {opentelemetry.proto.logs.v1.ILogRecord=} [properties] Properties to set
                     */
                    function LogRecord(properties) {
                        this.attributes = [];
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * LogRecord timeUnixNano.
                     * @member {number} timeUnixNano
                     * @memberof opentelemetry.proto.logs.v1.LogRecord
                     * @instance
                     */
                    LogRecord.prototype.timeUnixNano = $util.Long ? $util.Long.fromBits(0,0,false) : 0;

                    /**
                     * LogRecord observedTimeUnixNano.
                     * @member {number} observedTimeUnixNano
                     * @memberof opentelemetry.proto.logs.v1.LogRecord
                     * @instance
                     */
                    LogRecord.prototype.observedTimeUnixNano = $util.Long ? $util.Long.fromBits(0,0,false) : 0;

                    /**
                     * LogRecord severityNumber.
                     * @member {opentelemetry.proto.logs.v1.SeverityNumber} severityNumber
                     * @memberof opentelemetry.proto.logs.v1.LogRecord
                     * @instance
                     */
                    LogRecord.prototype.severityNumber = 0;

                    /**
                     * LogRecord severityText.
                     * @member {string} severityText
                     * @memberof opentelemetry.proto.logs.v1.LogRecord
                     * @instance
                     */
                    LogRecord.prototype.severityText = "";

                    /**
                     * LogRecord body.
                     * @member {opentelemetry.proto.common.v1.IAnyValue|null|undefined} body
                     * @memberof opentelemetry.proto.logs.v1.LogRecord
                     * @instance
                     */
                    LogRecord.prototype.body = null;

                    /**
                     * LogRecord attributes.
                     * @member {Array.<opentelemetry.proto.common.v1.IKeyValue>} attributes
                     * @memberof opentelemetry.proto.logs.v1.LogRecord
                     * @instance
                     */
                    LogRecord.prototype.attributes = $util.emptyArray;

                    /**
                     * LogRecord droppedAttributesCount.
                     * @member {number} droppedAttributesCount
                     * @memberof opentelemetry.proto.logs.v1.LogRecord
                     * @instance
                     */
                    LogRecord.prototype.droppedAttributesCount = 0;

                    /**
                     * LogRecord flags.
                     * @member {number} flags
                     * @memberof opentelemetry.proto.logs.v1.LogRecord
                     * @instance
                     */
                    LogRecord.prototype.flags = 0;

                    /**
                     * LogRecord traceId.
                     * @member {Uint8Array} traceId
                     * @memberof opentelemetry.proto.logs.v1.LogRecord
                     * @instance
                     */
                    LogRecord.prototype.traceId = $util.newBuffer([]);

                    /**
                     * LogRecord spanId.
                     * @member {Uint8Array} spanId
                     * @memberof opentelemetry.proto.logs.v1.LogRecord
                     * @instance
                     */
                    LogRecord.prototype.spanId = $util.newBuffer([]);

                    /**
                     * Encodes the specified LogRecord message. Does not implicitly {@link opentelemetry.proto.logs.v1.LogRecord.verify|verify} messages.
                     * @function encode
                     * @memberof opentelemetry.proto.logs.v1.LogRecord
                     * @static
                     * @param {opentelemetry.proto.logs.v1.ILogRecord} message LogRecord message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    LogRecord.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message.timeUnixNano != null && Object.hasOwnProperty.call(message, "timeUnixNano"))
                            writer.uint32(/* id 1, wireType 1 =*/9).fixed64(message.timeUnixNano);
                        if (message.severityNumber != null && Object.hasOwnProperty.call(message, "severityNumber"))
                            writer.uint32(/* id 2, wireType 0 =*/16).int32(message.severityNumber);
                        if (message.severityText != null && Object.hasOwnProperty.call(message, "severityText"))
                            writer.uint32(/* id 3, wireType 2 =*/26).string(message.severityText);
                        if (message.body != null && Object.hasOwnProperty.call(message, "body"))
                            $root.opentelemetry.proto.common.v1.AnyValue.encode(message.body, writer.uint32(/* id 5, wireType 2 =*/42).fork()).ldelim();
                        if (message.attributes != null && message.attributes.length)
                            for (let i = 0; i < message.attributes.length; ++i)
                                $root.opentelemetry.proto.common.v1.KeyValue.encode(message.attributes[i], writer.uint32(/* id 6, wireType 2 =*/50).fork()).ldelim();
                        if (message.droppedAttributesCount != null && Object.hasOwnProperty.call(message, "droppedAttributesCount"))
                            writer.uint32(/* id 7, wireType 0 =*/56).uint32(message.droppedAttributesCount);
                        if (message.flags != null && Object.hasOwnProperty.call(message, "flags"))
                            writer.uint32(/* id 8, wireType 5 =*/69).fixed32(message.flags);
                        if (message.traceId != null && Object.hasOwnProperty.call(message, "traceId"))
                            writer.uint32(/* id 9, wireType 2 =*/74).bytes(message.traceId);
                        if (message.spanId != null && Object.hasOwnProperty.call(message, "spanId"))
                            writer.uint32(/* id 10, wireType 2 =*/82).bytes(message.spanId);
                        if (message.observedTimeUnixNano != null && Object.hasOwnProperty.call(message, "observedTimeUnixNano"))
                            writer.uint32(/* id 11, wireType 1 =*/89).fixed64(message.observedTimeUnixNano);
                        return writer;
                    };

                    return LogRecord;
                })();

                return v1;
            })();

            return logs;
        })();

        return proto;
    })();

    return opentelemetry;
})();

export { $root as default };
