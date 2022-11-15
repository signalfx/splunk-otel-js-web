/* eslint-disable */
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
                     * Creates a new AnyValue instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns AnyValue instance
                     */
                    public static create(properties?: opentelemetry.proto.common.v1.IAnyValue): opentelemetry.proto.common.v1.AnyValue;

                    /**
                     * Encodes the specified AnyValue message. Does not implicitly {@link opentelemetry.proto.common.v1.AnyValue.verify|verify} messages.
                     * @param message AnyValue message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: opentelemetry.proto.common.v1.IAnyValue, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified AnyValue message, length delimited. Does not implicitly {@link opentelemetry.proto.common.v1.AnyValue.verify|verify} messages.
                     * @param message AnyValue message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: opentelemetry.proto.common.v1.IAnyValue, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes an AnyValue message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns AnyValue
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): opentelemetry.proto.common.v1.AnyValue;

                    /**
                     * Decodes an AnyValue message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns AnyValue
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): opentelemetry.proto.common.v1.AnyValue;

                    /**
                     * Verifies an AnyValue message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates an AnyValue message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns AnyValue
                     */
                    public static fromObject(object: { [k: string]: any }): opentelemetry.proto.common.v1.AnyValue;

                    /**
                     * Creates a plain object from an AnyValue message. Also converts values to other types if specified.
                     * @param message AnyValue
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: opentelemetry.proto.common.v1.AnyValue, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this AnyValue to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };
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
                     * Creates a new ArrayValue instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns ArrayValue instance
                     */
                    public static create(properties?: opentelemetry.proto.common.v1.IArrayValue): opentelemetry.proto.common.v1.ArrayValue;

                    /**
                     * Encodes the specified ArrayValue message. Does not implicitly {@link opentelemetry.proto.common.v1.ArrayValue.verify|verify} messages.
                     * @param message ArrayValue message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: opentelemetry.proto.common.v1.IArrayValue, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified ArrayValue message, length delimited. Does not implicitly {@link opentelemetry.proto.common.v1.ArrayValue.verify|verify} messages.
                     * @param message ArrayValue message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: opentelemetry.proto.common.v1.IArrayValue, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes an ArrayValue message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns ArrayValue
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): opentelemetry.proto.common.v1.ArrayValue;

                    /**
                     * Decodes an ArrayValue message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns ArrayValue
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): opentelemetry.proto.common.v1.ArrayValue;

                    /**
                     * Verifies an ArrayValue message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates an ArrayValue message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns ArrayValue
                     */
                    public static fromObject(object: { [k: string]: any }): opentelemetry.proto.common.v1.ArrayValue;

                    /**
                     * Creates a plain object from an ArrayValue message. Also converts values to other types if specified.
                     * @param message ArrayValue
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: opentelemetry.proto.common.v1.ArrayValue, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this ArrayValue to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };
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
                     * Creates a new KeyValueList instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns KeyValueList instance
                     */
                    public static create(properties?: opentelemetry.proto.common.v1.IKeyValueList): opentelemetry.proto.common.v1.KeyValueList;

                    /**
                     * Encodes the specified KeyValueList message. Does not implicitly {@link opentelemetry.proto.common.v1.KeyValueList.verify|verify} messages.
                     * @param message KeyValueList message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: opentelemetry.proto.common.v1.IKeyValueList, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified KeyValueList message, length delimited. Does not implicitly {@link opentelemetry.proto.common.v1.KeyValueList.verify|verify} messages.
                     * @param message KeyValueList message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: opentelemetry.proto.common.v1.IKeyValueList, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a KeyValueList message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns KeyValueList
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): opentelemetry.proto.common.v1.KeyValueList;

                    /**
                     * Decodes a KeyValueList message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns KeyValueList
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): opentelemetry.proto.common.v1.KeyValueList;

                    /**
                     * Verifies a KeyValueList message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a KeyValueList message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns KeyValueList
                     */
                    public static fromObject(object: { [k: string]: any }): opentelemetry.proto.common.v1.KeyValueList;

                    /**
                     * Creates a plain object from a KeyValueList message. Also converts values to other types if specified.
                     * @param message KeyValueList
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: opentelemetry.proto.common.v1.KeyValueList, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this KeyValueList to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };
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
                     * Creates a new KeyValue instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns KeyValue instance
                     */
                    public static create(properties?: opentelemetry.proto.common.v1.IKeyValue): opentelemetry.proto.common.v1.KeyValue;

                    /**
                     * Encodes the specified KeyValue message. Does not implicitly {@link opentelemetry.proto.common.v1.KeyValue.verify|verify} messages.
                     * @param message KeyValue message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: opentelemetry.proto.common.v1.IKeyValue, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified KeyValue message, length delimited. Does not implicitly {@link opentelemetry.proto.common.v1.KeyValue.verify|verify} messages.
                     * @param message KeyValue message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: opentelemetry.proto.common.v1.IKeyValue, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a KeyValue message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns KeyValue
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): opentelemetry.proto.common.v1.KeyValue;

                    /**
                     * Decodes a KeyValue message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns KeyValue
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): opentelemetry.proto.common.v1.KeyValue;

                    /**
                     * Verifies a KeyValue message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a KeyValue message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns KeyValue
                     */
                    public static fromObject(object: { [k: string]: any }): opentelemetry.proto.common.v1.KeyValue;

                    /**
                     * Creates a plain object from a KeyValue message. Also converts values to other types if specified.
                     * @param message KeyValue
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: opentelemetry.proto.common.v1.KeyValue, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this KeyValue to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };
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
                     * Creates a new InstrumentationLibrary instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns InstrumentationLibrary instance
                     */
                    public static create(properties?: opentelemetry.proto.common.v1.IInstrumentationLibrary): opentelemetry.proto.common.v1.InstrumentationLibrary;

                    /**
                     * Encodes the specified InstrumentationLibrary message. Does not implicitly {@link opentelemetry.proto.common.v1.InstrumentationLibrary.verify|verify} messages.
                     * @param message InstrumentationLibrary message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: opentelemetry.proto.common.v1.IInstrumentationLibrary, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified InstrumentationLibrary message, length delimited. Does not implicitly {@link opentelemetry.proto.common.v1.InstrumentationLibrary.verify|verify} messages.
                     * @param message InstrumentationLibrary message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: opentelemetry.proto.common.v1.IInstrumentationLibrary, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes an InstrumentationLibrary message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns InstrumentationLibrary
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): opentelemetry.proto.common.v1.InstrumentationLibrary;

                    /**
                     * Decodes an InstrumentationLibrary message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns InstrumentationLibrary
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): opentelemetry.proto.common.v1.InstrumentationLibrary;

                    /**
                     * Verifies an InstrumentationLibrary message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates an InstrumentationLibrary message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns InstrumentationLibrary
                     */
                    public static fromObject(object: { [k: string]: any }): opentelemetry.proto.common.v1.InstrumentationLibrary;

                    /**
                     * Creates a plain object from an InstrumentationLibrary message. Also converts values to other types if specified.
                     * @param message InstrumentationLibrary
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: opentelemetry.proto.common.v1.InstrumentationLibrary, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this InstrumentationLibrary to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };
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
                     * Creates a new InstrumentationScope instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns InstrumentationScope instance
                     */
                    public static create(properties?: opentelemetry.proto.common.v1.IInstrumentationScope): opentelemetry.proto.common.v1.InstrumentationScope;

                    /**
                     * Encodes the specified InstrumentationScope message. Does not implicitly {@link opentelemetry.proto.common.v1.InstrumentationScope.verify|verify} messages.
                     * @param message InstrumentationScope message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: opentelemetry.proto.common.v1.IInstrumentationScope, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified InstrumentationScope message, length delimited. Does not implicitly {@link opentelemetry.proto.common.v1.InstrumentationScope.verify|verify} messages.
                     * @param message InstrumentationScope message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: opentelemetry.proto.common.v1.IInstrumentationScope, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes an InstrumentationScope message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns InstrumentationScope
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): opentelemetry.proto.common.v1.InstrumentationScope;

                    /**
                     * Decodes an InstrumentationScope message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns InstrumentationScope
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): opentelemetry.proto.common.v1.InstrumentationScope;

                    /**
                     * Verifies an InstrumentationScope message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates an InstrumentationScope message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns InstrumentationScope
                     */
                    public static fromObject(object: { [k: string]: any }): opentelemetry.proto.common.v1.InstrumentationScope;

                    /**
                     * Creates a plain object from an InstrumentationScope message. Also converts values to other types if specified.
                     * @param message InstrumentationScope
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: opentelemetry.proto.common.v1.InstrumentationScope, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this InstrumentationScope to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };
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
                     * Creates a new Resource instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns Resource instance
                     */
                    public static create(properties?: opentelemetry.proto.resource.v1.IResource): opentelemetry.proto.resource.v1.Resource;

                    /**
                     * Encodes the specified Resource message. Does not implicitly {@link opentelemetry.proto.resource.v1.Resource.verify|verify} messages.
                     * @param message Resource message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: opentelemetry.proto.resource.v1.IResource, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified Resource message, length delimited. Does not implicitly {@link opentelemetry.proto.resource.v1.Resource.verify|verify} messages.
                     * @param message Resource message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: opentelemetry.proto.resource.v1.IResource, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a Resource message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns Resource
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): opentelemetry.proto.resource.v1.Resource;

                    /**
                     * Decodes a Resource message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns Resource
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): opentelemetry.proto.resource.v1.Resource;

                    /**
                     * Verifies a Resource message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a Resource message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns Resource
                     */
                    public static fromObject(object: { [k: string]: any }): opentelemetry.proto.resource.v1.Resource;

                    /**
                     * Creates a plain object from a Resource message. Also converts values to other types if specified.
                     * @param message Resource
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: opentelemetry.proto.resource.v1.Resource, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this Resource to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };
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
                     * Creates a new LogsData instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns LogsData instance
                     */
                    public static create(properties?: opentelemetry.proto.logs.v1.ILogsData): opentelemetry.proto.logs.v1.LogsData;

                    /**
                     * Encodes the specified LogsData message. Does not implicitly {@link opentelemetry.proto.logs.v1.LogsData.verify|verify} messages.
                     * @param message LogsData message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: opentelemetry.proto.logs.v1.ILogsData, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified LogsData message, length delimited. Does not implicitly {@link opentelemetry.proto.logs.v1.LogsData.verify|verify} messages.
                     * @param message LogsData message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: opentelemetry.proto.logs.v1.ILogsData, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a LogsData message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns LogsData
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): opentelemetry.proto.logs.v1.LogsData;

                    /**
                     * Decodes a LogsData message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns LogsData
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): opentelemetry.proto.logs.v1.LogsData;

                    /**
                     * Verifies a LogsData message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a LogsData message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns LogsData
                     */
                    public static fromObject(object: { [k: string]: any }): opentelemetry.proto.logs.v1.LogsData;

                    /**
                     * Creates a plain object from a LogsData message. Also converts values to other types if specified.
                     * @param message LogsData
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: opentelemetry.proto.logs.v1.LogsData, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this LogsData to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };
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
                     * Creates a new ResourceLogs instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns ResourceLogs instance
                     */
                    public static create(properties?: opentelemetry.proto.logs.v1.IResourceLogs): opentelemetry.proto.logs.v1.ResourceLogs;

                    /**
                     * Encodes the specified ResourceLogs message. Does not implicitly {@link opentelemetry.proto.logs.v1.ResourceLogs.verify|verify} messages.
                     * @param message ResourceLogs message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: opentelemetry.proto.logs.v1.IResourceLogs, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified ResourceLogs message, length delimited. Does not implicitly {@link opentelemetry.proto.logs.v1.ResourceLogs.verify|verify} messages.
                     * @param message ResourceLogs message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: opentelemetry.proto.logs.v1.IResourceLogs, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a ResourceLogs message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns ResourceLogs
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): opentelemetry.proto.logs.v1.ResourceLogs;

                    /**
                     * Decodes a ResourceLogs message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns ResourceLogs
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): opentelemetry.proto.logs.v1.ResourceLogs;

                    /**
                     * Verifies a ResourceLogs message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a ResourceLogs message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns ResourceLogs
                     */
                    public static fromObject(object: { [k: string]: any }): opentelemetry.proto.logs.v1.ResourceLogs;

                    /**
                     * Creates a plain object from a ResourceLogs message. Also converts values to other types if specified.
                     * @param message ResourceLogs
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: opentelemetry.proto.logs.v1.ResourceLogs, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this ResourceLogs to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };
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
                     * Creates a new ScopeLogs instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns ScopeLogs instance
                     */
                    public static create(properties?: opentelemetry.proto.logs.v1.IScopeLogs): opentelemetry.proto.logs.v1.ScopeLogs;

                    /**
                     * Encodes the specified ScopeLogs message. Does not implicitly {@link opentelemetry.proto.logs.v1.ScopeLogs.verify|verify} messages.
                     * @param message ScopeLogs message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: opentelemetry.proto.logs.v1.IScopeLogs, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified ScopeLogs message, length delimited. Does not implicitly {@link opentelemetry.proto.logs.v1.ScopeLogs.verify|verify} messages.
                     * @param message ScopeLogs message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: opentelemetry.proto.logs.v1.IScopeLogs, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a ScopeLogs message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns ScopeLogs
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): opentelemetry.proto.logs.v1.ScopeLogs;

                    /**
                     * Decodes a ScopeLogs message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns ScopeLogs
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): opentelemetry.proto.logs.v1.ScopeLogs;

                    /**
                     * Verifies a ScopeLogs message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a ScopeLogs message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns ScopeLogs
                     */
                    public static fromObject(object: { [k: string]: any }): opentelemetry.proto.logs.v1.ScopeLogs;

                    /**
                     * Creates a plain object from a ScopeLogs message. Also converts values to other types if specified.
                     * @param message ScopeLogs
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: opentelemetry.proto.logs.v1.ScopeLogs, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this ScopeLogs to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };
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
                     * Creates a new InstrumentationLibraryLogs instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns InstrumentationLibraryLogs instance
                     */
                    public static create(properties?: opentelemetry.proto.logs.v1.IInstrumentationLibraryLogs): opentelemetry.proto.logs.v1.InstrumentationLibraryLogs;

                    /**
                     * Encodes the specified InstrumentationLibraryLogs message. Does not implicitly {@link opentelemetry.proto.logs.v1.InstrumentationLibraryLogs.verify|verify} messages.
                     * @param message InstrumentationLibraryLogs message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: opentelemetry.proto.logs.v1.IInstrumentationLibraryLogs, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified InstrumentationLibraryLogs message, length delimited. Does not implicitly {@link opentelemetry.proto.logs.v1.InstrumentationLibraryLogs.verify|verify} messages.
                     * @param message InstrumentationLibraryLogs message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: opentelemetry.proto.logs.v1.IInstrumentationLibraryLogs, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes an InstrumentationLibraryLogs message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns InstrumentationLibraryLogs
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): opentelemetry.proto.logs.v1.InstrumentationLibraryLogs;

                    /**
                     * Decodes an InstrumentationLibraryLogs message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns InstrumentationLibraryLogs
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): opentelemetry.proto.logs.v1.InstrumentationLibraryLogs;

                    /**
                     * Verifies an InstrumentationLibraryLogs message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates an InstrumentationLibraryLogs message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns InstrumentationLibraryLogs
                     */
                    public static fromObject(object: { [k: string]: any }): opentelemetry.proto.logs.v1.InstrumentationLibraryLogs;

                    /**
                     * Creates a plain object from an InstrumentationLibraryLogs message. Also converts values to other types if specified.
                     * @param message InstrumentationLibraryLogs
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: opentelemetry.proto.logs.v1.InstrumentationLibraryLogs, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this InstrumentationLibraryLogs to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };
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
                     * Creates a new LogRecord instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns LogRecord instance
                     */
                    public static create(properties?: opentelemetry.proto.logs.v1.ILogRecord): opentelemetry.proto.logs.v1.LogRecord;

                    /**
                     * Encodes the specified LogRecord message. Does not implicitly {@link opentelemetry.proto.logs.v1.LogRecord.verify|verify} messages.
                     * @param message LogRecord message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: opentelemetry.proto.logs.v1.ILogRecord, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified LogRecord message, length delimited. Does not implicitly {@link opentelemetry.proto.logs.v1.LogRecord.verify|verify} messages.
                     * @param message LogRecord message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: opentelemetry.proto.logs.v1.ILogRecord, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a LogRecord message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns LogRecord
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): opentelemetry.proto.logs.v1.LogRecord;

                    /**
                     * Decodes a LogRecord message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns LogRecord
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): opentelemetry.proto.logs.v1.LogRecord;

                    /**
                     * Verifies a LogRecord message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a LogRecord message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns LogRecord
                     */
                    public static fromObject(object: { [k: string]: any }): opentelemetry.proto.logs.v1.LogRecord;

                    /**
                     * Creates a plain object from a LogRecord message. Also converts values to other types if specified.
                     * @param message LogRecord
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: opentelemetry.proto.logs.v1.LogRecord, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this LogRecord to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };
                }
            }
        }
    }
}
