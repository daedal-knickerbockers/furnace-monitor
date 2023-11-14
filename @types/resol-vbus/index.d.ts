import { Duplex } from "stream";

declare module "resol-vbus" {
    export const VERSION: string;

    export const utils: {
        generateGUID(): string;
        roundNumber(value: number, exp: number): string;
        deepFreezeObjectTree(root: any): void;
        promisify<T>(fn: (callback: (err: any, result: T) => void) => void): Promise<T>;
        isPromise(obj: any): boolean;
        hasOwnProperty(obj: any, key: string): boolean;
        applyDefaultOptions(obj: any, options: any, defaults: any): any;
        isNumber(value: any): boolean;
        isObject(value: any): boolean;
        isString(value: any): boolean;
        normalizeDatecode(input: string | number | Date): string;
    };

    export class I18N {
        public language: string | null;
        public languageData: { moment: string; numeral: string } | null;
        public timezone: string | null;

        public constructor(language: string);

        /**
         * Formats a string using a `printf(3)` compatible format string and
         * variadic arguments (comparable to `sprintf(3)`) and returns it.
         *
         * @param {string} fmt Format string
         * @param {...mixed} args Arguments to format
         * @returns {string} Formatted string
         *
         * @see http://linux.die.net/man/3/sprintf
         * @see http://www.diveintojavascript.com/projects/javascript-sprintf
         *
         * @example
         * // outputs: VBus #3: DeltaSol MX
         * console.log(i18n.sprintf('VBus #%d: %s', 3, 'DeltaSol MX'));
         *
         * // outputs: DeltaSol MX
         * console.log(i18n.sprintf('%2$s', 3, 'DeltaSol MX'));
         */
        public sprintf(): string;

        /**
         * Formats a string using a `printf(3)` compatible format string and
         * a arguments array (comparable to `vsprintf(3)`) and returns it.
         *
         * @param {string} fmt Format string
         * @param {Array} argv Arguments to format
         * @returns {string} Formatted string
         *
         * @example
         * // outputs: VBus #3: DeltaSol MX
         * console.log(i18n.vsprintf('VBus #%d: %s', [ 3, 'DeltaSol MX' ]));
         *
         * // outputs: DeltaSol MX
         * console.log(i18n.vsprintf('%2$s', [ 3, 'DeltaSol MX' ]));
         */
        public vsprintf(fmt: string, argv: any[]): string;

        /**
         * Get a translation for the given key. If more than one argument is
         * given, the translation is then used as a format string for the
         * {@link I18N#sprintf} method.
         *
         * @param {string} key Key for the translation
         * @param {...mixed} args Arguments to format
         * @return {string} Formatted string
         *
         * @example
         * var i18n = new I18N('de');
         *
         * // outputs: Unbekanntes Gerät (0x%1$04X)
         * console.log(i18n.t('specification.unknownDevice'));
         *
         * // outputs: Unbekanntes Gerät (0x7E11)
         * console.log(i18n.t('specification.unknownDevice', 0x7e11));
         */
        public t(key: string, ...args: any[]): string;

        /**
         * Wrapper for a moment.js date object that is setup to use this
         * instance's language code.
         *
         * @param {...mixed} args Arguments to be passed to `moment()` function
         * @returns {mixed} Result of calling the `moment()` function
         *
         * @see http://momentjs.com/docs/
         */
        public moment(): any;

        /**
         * Wrapper for a moment.js UTC date object that is setup to use this
         * instance's language code.
         *
         * @param {...mixed} args Arguments to be passed to `moment.utc()` function
         * @returns {mixed} Result of calling the `moment.utc()` function
         *
         * @see http://momentjs.com/docs/
         */
        public momentUTC(): any;

        public momentTz(): any;

        public momentTzZone(): any;

        /**
         * Wrapper for a numeral.js number object that is setup to use this
         * instance's language code.
         *
         * @param {...mixed} args Arguments to be passes to `numeral()` function
         * @returns {mixes} Result of calling the `numeral()` function
         *
         * @see http://numeraljs.com/
         */
        public numeral(): any;
    }

    export class SpecificationFile {
        public constructor(buffer: Buffer, language: string);

        public getSpecificationData(): any;

        public getPacketTemplate(destinationAddress: any, sourceAddress: any, command: any): any;

        public getRawValue(pt: any, ptf: any, buffer: Buffer, start: number, end: number): number;

        public setRawValue(pt: any, ptf: any, newValue: number, buffer: Buffer, start: number, end: number): void;

        public getDefaultSpecificationFile(): any;

        public static async loadFromFile(filename: string): SpecificationFile;
    }

    /**
     * @typedef UnitSpecification
     * @type {object}
     * @property {String} unitId Unit identifier
     * @property {String} unitCode Unit code
     * @property {String} unitFamily Unit family
     * @property {String} unitText Unit text
     */
    export interface UnitSpecification {
        unitId: string;
        unitCode: string;
        unitFamily: string;
        unitText: string;
    }

    /**
     * @typedef TypeSpecification
     * @type {object}
     * @property {String} typeId Type identifier
     * @property {String} rootTypeId Root type identifier
     * @property {number} precision Precision for numeral values
     * @property {UnitSpecification} unit Unit object
     */
    export interface TypeSpecification {
        typeId: string;
        rootTypeId: string;
        precision: number;
        unit: UnitSpecification;
    }

    /**
     * @typedef DeviceSpecification
     * @type {object}
     * @property {string} deviceId Device identifier
     * @property {number} channel VBus channel
     * @property {number} selfAddress VBus address of the device itself
     * @property {number} peerAddress VBus address of the device's peer
     * @property {string} name Name of the device
     * @property {string} fullName Name of the device optionally prefixed with VBus channel (if it is not 0)
     */
    export interface DeviceSpecification {
        deviceId: string;
        channel: number;
        selfAddress: number;
        peerAddress: number;
        name: string;
        fullName: string;
    }

    /**
     * @typedef PacketSpecification
     * @type {object}
     * @property {string} packetId Packet identifier
     * @property {number} channel VBus channel
     * @property {number} destinationAddress VBus address of the destination device
     * @property {number} sourceAddress VBus address of the source device
     * @property {number} protocolVersion VBus protocol version
     * @property {number} command VBus command
     * @property {number} info Additional info for sorting purposes
     * @property {DeviceSpecification} destinationDevice DeviceSpecification object of the destination device
     * @property {DeviceSpecification} sourceDevice DeviceSpecification object of the source device
     * @property {PacketFieldSpecification[]} packetFields Array of PacketFieldSpecification objects
     */
    export interface PacketSpecification {
        packetId: string;
        channel: number;
        destinationAddress: number;
        sourceAddress: number;
        protocolVersion: number;
        command: number;
        info: number;
        destinationDevice: DeviceSpecification;
        sourceDevice: DeviceSpecification;
        packetFields: PacketFieldSpecification[];
    }

    /**
     * @typedef packetFieldGetRawValue
     * @type {function}
     * @param {Buffer} buffer Buffer object
     * @param {number} start Start index in the buffer
     * @param {number} end End index in the buffer
     */
    export type packetFieldGetRawValue = (buffer: Buffer, start: number, end: number) => number;

    /**
     * @typedef PacketFieldSpecification
     * @type {object}
     * @property {string} fieldId Field identifier
     * @property {object} name Object containing names by language code
     * @property {TypeSpecification} type TypeSpecification object
     * @property {packetFieldGetRawValue} getRawValue Function to get raw value from a buffer
     */
    export interface PacketFieldSpecification {
        fieldId: string;
        name: { [key: string]: string };
        type: TypeSpecification;
        getRawValue: packetFieldGetRawValue;
    }

    /**
     * @typedef PacketField
     * @type {object}
     * @property {string} id Packet field identifier
     * @property {Packet} packet Packet
     * @property {PacketSpecification} packetSpec
     * @property {PacketFieldSpecification} packetFieldSpec
     * @property {PacketFieldSpecification} origPacketFieldSpec
     * @property {string} name
     * @property {number} rawValue Raw value
     * @property {function} formatTextValue Function to format this packet field's raw value into textual form
     */
    export interface PacketField {
        id: string;
        packet: Packet;
        packetSpec: PacketSpecification;
        packetFieldSpec: PacketFieldSpecification;
        origPacketFieldSpec: PacketFieldSpecification;
        name: string;
        rawValue: number;
        formatTextValue: () => string;
    }

    /**
     * @typedef FilteredPacketFieldSpecification
     * @type {object}
     * @property {string} filteredPacketFieldId
     * @property {string} packetId
     * @property {string} fieldId
     * @property {string} name
     * @property {string} type
     * @property {string} getRawValue
     */
    export interface FilteredPacketFieldSpecification {
        filteredPacketFieldId: string;
        packetId: string;
        fieldId: string;
        name: string;
        type: string;
        getRawValue: string;
    }

    /**
     * @typedef BlockTypeSection
     * @type {object}
     * @property {string} sectionId Section identifier
     * @property {string} surrogatePacketId Surrogate packet identifier
     * @property {Packet} packet Packet object
     * @property {PacketSpecification} packetSpec PacketSpecification object
     * @property {number} startOffset Offset of section start within Packet frame data
     * @property {number} endOffset Offset of section end within Packet frame data
     * @property {number} type Section type
     * @property {number} payloadCount Count of payload elements
     * @property {number} frameCount Count of frames
     * @property {Buffer} frameData Frame data
     */
    export interface BlockTypeSection {
        sectionId: string;
        surrogatePacketId: string;
        packet: Packet;
        packetSpec: PacketSpecification;
        startOffset: number;
        endOffset: number;
        type: number;
        payloadCount: number;
        frameCount: number;
        frameData: Buffer;
    }

    export class Specification {
        /**
         * Language code (ISO 639-1)
         * @type {string}
         */
        public language: string;

        public deviceSpecCache: any;

        public packetSpecCache: any;

        public blockTypePacketSpecCache: any;

        /**
         * I18N instance
         * @type {I18N}
         */
        public i18n: I18N;

        /**
         * Custom specification data to be mixed-in to built-in specification.
         * @type {object}
         */
        public specificationData: any;

        /**
         * Creates a new Specification instance and optionally initializes its members with the given values.
         *
         * @constructs
         * @param {object} options Initialization values for this instance's members
         * @param {string} options.language {@link Specification#language}
         * @param {string} options.specificationData {@link Specification#specificationData}
         */
        public constructor(options);

        /**
         * Gets the UnitSpecification object matching the given identifier.
         *
         * @param {string} id Unit identifier
         * @returns {UnitSpecification} Unit object
         *
         * @example
         * > console.log(spec.getUnitById('DegreesCelsius'));
         * { unitId: 'DegreesCelsius',
         *   unitCode: 'DegreesCelsius',
         *   unitText: ' °C' }
         * undefined
         * >
         */
        public getUnitById(id: string): UnitSpecification;

        /**
         * Gets the TypeSpecification object matching the given identifier.
         *
         * @param {string} id Type identifier
         * @returns {TypeSpecification} Type object
         *
         * @example
         * > console.log(spec.getTypeById('Number_0_1_DegreesCelsius'));
         * { typeId: 'Number_0_1_DegreesCelsius',
         *   rootTypeId: 'Number',
         *   precision: 1,
         *   unit:
         *    { unitId: 'DegreesCelsius',
         *      unitCode: 'DegreesCelsius',
         *      unitText: ' °C' } }
         * undefined
         * >
         */
        public getTypeById(id: string): TypeSpecification;

        /**
         * Gets the DeviceSpecification object matching the given arguments.
         *
         * @memberof Specification#
         * @name getDeviceSpecification
         * @method
         *
         * @param {number} selfAddress VBus address of the device itself
         * @param {number} peerAddress VBus address of the device's peer
         * @param {number} [channel=0] VBus channel of the device
         * @returns {DeviceSpecification} DeviceSpecification object
         *
         * @example
         * > console.log(spec.getDeviceSpecification(0x7E11, 0x0000, 1));
         * { name: 'DeltaSol MX [Regler]',
         *   deviceId: '01_7E11_0000',
         *   channel: 1,
         *   selfAddress: 32273,
         *   peerAddress: 0,
         *   fullName: 'VBus #1: DeltaSol MX [Regler]' }
         * undefined
         * >
         */

        /**
         * Gets the DeviceSpecification object matching the given header and direction.
         *
         * @param {Header} header Header instance
         * @param {string} which Either `'source'` or `'destination'`
         * @returns {DeviceSpecification} DeviceSpecification object
         */
        public getDeviceSpecification(selfAddress: number, peerAddress: number, channel: number): DeviceSpecification;

        /**
         * Gets the PacketSpecification object matching the given arguments.
         *
         * @memberof Specification#
         * @name getPacketSpecification
         * @method
         *
         * @param {number} channel VBus channel
         * @param {number} destinationAddress VBus address of destination device
         * @param {number} sourceAddress VBus address of source device
         * @param {number} command VBus command
         * @returns {PacketSpecification} PacketSpecification object
         *
         * @example
         * > console.log(spec.getPacketSpecification(1, 0x0010, 0x7E21, 0x0100));
         * { packetId: '01_0010_7E21_10_0100',
         *   packetFields:
         *    [ { fieldId: '000_2_0',
         *        name: [Object],
         *        type: [Object],
         *        getRawValue: [Function] },
         *      { fieldId: '002_1_0',
         *        name: [Object],
         *        type: [Object],
         *        getRawValue: [Function] } ],
         *   channel: 1,
         *   destinationAddress: 16,
         *   sourceAddress: 32289,
         *   protocolVersion: 16,
         *   command: 256,
         *   info: 0,
         *   destinationDevice:
         *    { name: 'DFA',
         *      deviceId: '01_0010_7E21',
         *      channel: 1,
         *      selfAddress: 16,
         *      peerAddress: 32289,
         *      fullName: 'VBus #1: DFA' },
         *   sourceDevice:
         *    { name: 'DeltaSol MX [Heizkreis #1]',
         *      deviceId: '01_7E21_0010',
         *      channel: 1,
         *      selfAddress: 32289,
         *      peerAddress: 16,
         *      fullName: 'VBus #1: DeltaSol MX [Heizkreis #1]' },
         *   fullName: 'VBus #1: DeltaSol MX [Heizkreis #1]' }
         * undefined
         * >
         */

        /**
         * Gets the PacketSpecification object matching the given arguments.
         *
         * @memberof Specification#
         * @name getPacketSpecification
         * @method
         *
         * @param {string} packetSpecId PacketSpecification identifier
         * @returns {PacketSpecification} PacketSpecification object
         *
         * @example
         * > console.log(spec.getPacketSpecification('01_0010_7E21_10_0100'));
         * { packetId: '01_0010_7E21_10_0100',
         *   packetFields:
         *    [ { fieldId: '000_2_0',
         *        name: [Object],
         *        type: [Object],
         *        getRawValue: [Function] },
         *      { fieldId: '002_1_0',
         *        name: [Object],
         *        type: [Object],
         *        getRawValue: [Function] } ],
         *   channel: 1,
         *   destinationAddress: 16,
         *   sourceAddress: 32289,
         *   protocolVersion: 16,
         *   command: 256,
         *   info: 0,
         *   destinationDevice:
         *    { name: 'DFA',
         *      deviceId: '01_0010_7E21',
         *      channel: 1,
         *      selfAddress: 16,
         *      peerAddress: 32289,
         *      fullName: 'VBus #1: DFA' },
         *   sourceDevice:
         *    { name: 'DeltaSol MX [Heizkreis #1]',
         *      deviceId: '01_7E21_0010',
         *      channel: 1,
         *      selfAddress: 32289,
         *      peerAddress: 16,
         *      fullName: 'VBus #1: DeltaSol MX [Heizkreis #1]' },
         *   fullName: 'VBus #1: DeltaSol MX [Heizkreis #1]' }
         * undefined
         * >
         */

        /**
         * Gets the PacketSpecification object matching the given packet.
         *
         * @param {Packet} packet VBus packet
         * @returns {PacketSpecification} PacketSpecification object
         */
        getPacketSpecification(
            headerOrChannel: any,
            destinationAddress: number,
            sourceAddress: number,
            command: number,
        ): PacketSpecification;

        /**
         * Gets the PacketFieldSpecification object matching the given arguments.
         *
         * @memberof Specification#
         * @name getPacketFieldSpecification
         * @method
         *
         * @param {PacketSpecification} packetSpec PacketSpecification object
         * @param {string} fieldId Field identifier
         * @returns {PacketFieldSpecification} PacketFieldSpecification object
         *
         * @example
         * > var packetSpec = spec.getPacketSpecification('01_0010_7E21_10_0100');
         * undefined
         * > console.log(spec.getPacketFieldSpecification(packetSpec, '000_2_0'));
         * { fieldId: '000_2_0',
         *   name:
         *    { ref: 'Flow set temperature',
         *      en: 'Flow set temperature',
         *      de: 'Vorlauf-Soll-Temperatur',
         *      fr: 'Température nominale départ' },
         *   type:
         *    { typeId: 'Number_0_1_DegreesCelsius',
         *      rootTypeId: 'Number',
         *      precision: 1,
         *      unit:
         *       { unitId: 'DegreesCelsius',
         *         unitCode: 'DegreesCelsius',
         *         unitText: ' °C' } },
         *   getRawValue: [Function] }
         * undefined
         * >
         */

        /**
         * Gets the PacketFieldSpecification object matching the given arguments.
         *
         * @param {string} packetFieldId Packet field identifier
         * @returns {PacketFieldSpecification} PacketFieldSpecification object
         *
         * @example
         * > console.log(spec.getPacketFieldSpecification('01_0010_7E21_10_0100_000_2_0'));
         * { fieldId: '000_2_0',
         *   name:
         *    { ref: 'Flow set temperature',
         *      en: 'Flow set temperature',
         *      de: 'Vorlauf-Soll-Temperatur',
         *      fr: 'Température nominale départ' },
         *   type:
         *    { typeId: 'Number_0_1_DegreesCelsius',
         *      rootTypeId: 'Number',
         *      precision: 1,
         *      unit:
         *       { unitId: 'DegreesCelsius',
         *         unitCode: 'DegreesCelsius',
         *         unitText: ' °C' } },
         *   getRawValue: [Function] }
         * undefined
         * >
         */
        public getPacketFieldSpecification(packetSpecOrId: any, fieldId: number): PacketFieldSpecification;

        /**
         * Gets the raw value of a packet field from a buffer.
         *
         * @param {PacketFieldSpecification} packetField PacketFieldSpecification object
         * @param {Buffer} buffer Buffer object
         * @param {number} [start=0] Start index in the buffer
         * @param {number} [end=buffer.length] End index in the buffer
         * @returns {number} Raw value
         *
         * @example
         * > var packetFieldSpec = spec.getPacketFieldSpecification('01_0010_7721_10_0100_000_2_0');
         * undefined
         * > var buffer = Buffer.from('b822', 'hex');
         * undefined
         * > console.log(spec.getRawValue(packetFieldSpec, buffer));
         * 888.8000000000001
         * undefined
         * >
         */
        public getRawValue(packetField: PacketFieldSpecification, buffer: Buffer, start: number, end: number): number;

        public getRoundedRawValue(packetField, buffer, start, end): string;

        public invertConversions(conversions): any;

        public setRawValue(packetField, rawValue, buffer, start, end): any;

        /**
         * Converts a raw number value from one unit to another. The units must be in the same unit family.
         *
         * @param {number} rawValue Raw number value to convert from
         * @param {Unit} sourceUnit Unit to convert from
         * @param {Unit} targetUnit Unit to convert to
         * @return {object} Result containing a `rawValue` property with the conversion result and a `unit` property
         * with the associated unit.
         */
        public convertRawValue(rawValue_, sourceUnit_, targetUnit_): any;

        /**
         * Formats a raw value into its textual representation.
         *
         * @param {PacketFieldSpecification} packetField PacketFieldSpecification object
         * @param {number} rawValue Raw value
         * @param {string|UnitSpecification|null} [unit] Unit to format to
         * @returns {string} Textual representation of the raw value
         *
         * @example
         * > var packetFieldSpec = spec.getPacketFieldSpecification('01_0010_7721_10_0100_000_2_0');
         * undefined
         * > var rawValue = 888.8000000000001;
         * undefined
         * > console.log(spec.formatTextValueFromRawValue(packetFieldSpec, rawValue, 'DegreesCelsius'));
         * 888.8 °C
         * undefined
         * >
         */
        public formatTextValueFromRawValue(packetField, rawValue, unit): string;

        public formatTextValueFromRawValueInternal(rawValue, unit, rootType, precision, defaultUnit): any;

        /**
         * Gets an array of PacketField objects for the provided Packet objects.
         *
         * @param {Header[]} headers Array of Header objects
         * @returns {PacketField[]} Array of PacketField objects
         */
        public getPacketFieldsForHeaders(headers): PacketField[];

        public setPacketFieldRawValues(packetFields, rawValues): any;

        public getFilteredPacketFieldSpecificationsForHeaders(headers): any;

        /**
         * Gets an array of BlockType sections from a collection of headers.
         *
         * @param  {Header[]} headers Array of Header objects
         * @return {BlockTypeSection[]} Array of BlockTypeSection objects
         */
        public getBlockTypeSectionsForHeaders(headers): BlockTypeSection[];

        /**
         * Gets the PacketSpecification objects matching the given BlockTypeSection objects.
         *
         * @param  {BlockTypeSection[]} sections Array of BlockTypeSection objects
         * @return {PacketSpecification[]} Array of PacketSpecificationObjects
         */
        public getBlockTypePacketSpecificationsForSections(sections): PacketSpecification[];

        /**
         * Gets an array of PacketField objects for the provided BlockTypeSection objects.
         *
         * @param  {BlockTypeSection[]} sections Array of BlockTypeSection objects.
         * @return {PacketField[]} Array of PacketField objects
         */
        public getBlockTypeFieldsForSections(sections): PacketField[];

        public static loadSpecificationData(rawSpecificationData, options): any;
        public static storeSpecificationData(options): any;
        public static getDefaultSpecification(): Specification;
    }

    export class Connection extends Duplex {
        public dataSource: any;
        public channel: number;
        public selfAddress: number;
        public connectionState: any;
        public rxBuffer: Buffer;

        /**
         * Creates a new Connection instance and optionally initializes its member with the given values.
         *
         * @constructs
         * @augments Duplex
         * @param {object} options Initialization values for this instance's members
         * @param {number} options.channel See {@link Connection#channel}
         * @param {number} options.selfAddress See {@link Connection#selfAddress}
         *
         * @classdesc
         * The `Connection` class is the abstract base class for all VBus live data connections.
         * It extends the `Duplex` stream class. Any data written to a `Connection` instance is
         * parsed according to the VBus Protocol Specification. Once a valid instance of one of the
         * `Header` sub-classes (`Packet`, `Datagram` or `Telegram`)
         * is created from the binary data stream, the respective event is emitted on
         * the `Connection` instance.
         *
         * In addition to receiving incoming data the `Connection` class
         * offers several helper methods e.g. to send data to the underlying VBus connection.
         *
         * The `Connection` class itself has no knowledge about the underlying VBus connection.
         * Several sub-classes exist that know how to contact different types of VBus live streams.
         *
         * See `SerialConnection` or `TcpConnection` for concrete implementations.
         *
         * @example
         * var connection = new SerialConnection({ path: '/dev/tty.usbserial' });
         * connection.on('connectionState', function(state) {
         *     console.log(state);
         * });
         * connection.on('packet', function(packet) {
         *     console.log(packet.getId());
         * });
         * connection.on('datagram', function(datagram) {
         *     console.log(datagram.getId());
         * });
         * connection.connect();
         */
        public constructor(options: any);

        public connect(force?: boolean): void;

        public disconnect(): void;

        public receive(timestamp: number, chunk: Buffer): void;

        /**
         * Send raw data over this Connection instance.
         *
         * @param {Header|Buffer} data The Header or Buffer instance to be sent.
         */
        public send(data: Buffer): void;

        /**
         * Sends and / or receives a VBus data.
         *
         * @param {Header|Buffer} txData The Header or Buffer instance to be sent.
         * @param {object} options
         * @param {number} options.timeout Timeout in milliseconds after which the `txData` will be sent again
         * @param {number} options.timeoutIncr After each timeout retransmission the timeout value for the next try is
         * increment by this value.
         * @param {number} options.tries After this number of tries the returned Promise will resolve with value `null`.
         * @param {?function} options.filterPacket Will be called when a Packet has been received with the Packet and
         * a callback as arguments.
         * @param {?function} options.filterDatagram Will be called when a Datagram has been received with the Datagram
         *  and a callback as arguments.
         * @param {?function} options.filterTelegram Will be called when a Telegram has been received with the Telegram
         * and a callback as arguments.
         * @returns {Promise} A Promise that either resolves to the VBus data selected by one of the filter callbacks
         * or `null` on timeout.
         */
        public async transceive(txData: Buffer, options): Promise<Buffer | null>;

        /**
         * Waits for a VBus bus offering datagram (Command 0x0500).
         *
         * Returns a Promise that resolves with the Datagram or `null` if the method timed out.
         * @param {number} timeout=20000 Timeout in milliseconds
         * @returns {Promise} A Promise that resolves to the bus offering Datagram or `null` on timeout.
         */
        public waitForFreeBus(timeout: number): Promise<Buffer>;

        /**
         * Sends a VBus bus release datagram (Command 0x0600).
         * Returns a Promise that resolves with the first VBus packet received after the release or `null` on timeout.
         *
         * @param {number} address The VBus address of the master device to give the bus ownership back to.
         * @param {object} options
         * @param {number} options.tries=2 Number of tries to give the bus ownership back.
         * @param {number} options.timeout=1500 Time in milliseconds to wait between tries.
         */
        public releaseBus(address: number, options): Promise<Buffer>;

        /**
         * Sends a Datagram to get a value from a device.
         * Returns a Promise that resolves to the answer Datagram or `null` on timeout.
         *
         * @param {number} address The VBus address of the device to get the value from
         * @param {number} valueId The ID of the value to read from the device.
         * @param {object} options
         * @param {number} options.timeout=500 Time in milliseconds between tries.
         * @param {number} options.timeoutIncr=500 Additional time in milliseconds to increase the timeout per try.
         * @param {number} options.tries=3 Number of tries to get the value.
         * @returns {Promise} A promise that resolves to the received Datagram or `null` on timeout.
         */
        public getValueById(address: number, valueId: number, options): Promise<Buffer>;

        /**
         * Sends a Datagram to set a value in a device.
         * Returns a Promise that resolves to the answer Datagram or `null` on timeout.
         *
         * @param {number} address The VBus address of the device to set the value in
         * @param {number} valueId The ID of the value to write to the device.
         * @param {number} value The value to write to the device.
         * @param {object} options
         * @param {number} options.timeout=500 Time in milliseconds between tries.
         * @param {number} options.timeoutIncr=500 Additional time in milliseconds to increase the timeout per try.
         * @param {number} options.tries=3 Number of tries to get the value.
         * @returns {Promise} A promise that resolves to the received Datagram or `null` on timeout.
         */
        public setValueById(address: number, valueId: number, value: number, options): Promise<Buffer>;

        /**
         * Sends a Datagram to lookup a value ID hash in a device.
         * Returns a Promise that resolves to the answer Datagram or `null` on timeout.
         *
         * @param  {number} address The VBus address of the device to lookup the value in.
         * @param  {number} valueId The ID of the value to lookup in the device.
         * @param  {object} options
         * @param  {number} options.timeout=500 Time in milliseconds between tries.
         * @param {number} options.timeoutIncr=500 Additional time in milliseconds to increase the timeout per try.
         * @param  {number} options.tries=3 Number of tries to lookup the value.
         * @return {Promise} A Promise the resolves to the received Datagram or `null` on timeout.
         */
        public getValueIdHashById(address: number, valueId: number, options): Promise<Buffer>;

        /**
         * Sends a Datagram to lookup a value ID in a device.
         * Returns a Promise that resolves to the answer Datagram or `null` on timeout.
         *
         * @param  {number} address The VBus address of the device to lookup the value in.
         * @param  {number} valueIdHash The ID hash of the value to lookup in the device.
         * @param  {object} options
         * @param  {number} options.timeout=500 Time in milliseconds between tries.
         * @param {number} options.timeoutIncr=500 Additional time in milliseconds to increase the timeout per try.
         * @param  {number} options.tries=3 Number of tries to lookup the value.
         * @return {Promise} A Promise the resolves to the received Datagram or `null` on timeout.
         */
        public getValueIdByIdHash(address: number, valueIdHash: number, options): Promise<Buffer>;

        /**
         * Sends a Datagram to lookup the controller's capabilities (part 1).
         * Returns a Promise that resolves to the answer Datagram or `null` on timeout.
         *
         * @param  {number} address The VBus address of the device to get the capabilities from.
         * @param  {object} options
         * @param  {number} options.timeout=500 Time in milliseconds between tries.
         * @param  {number} options.timeoutIncr=500 Additional time in milliseconds to increase the timeout per try.
         * @param  {number} options.tries=3 Number of tries to lookup the value.
         * @return {Promise} A Promise the resolves to the received Datagram or `null` on timeout.
         */
        public getCaps1(address: number, options): Promise<Buffer>;

        /**
         * Sends a Datagram to begin a bulk valke transaction.
         * Returns a Promise that resolves to the answer Datagram or `null` on timeout.
         *
         * @param  {number} address The VBus address of the device to begin the transaction on.
         * @param  {number} txTimeout The number of seconds of inactivity after which the transaction is rolled back.
         * @param  {object} options
         * @param  {number} options.timeout=500 Time in milliseconds between tries.
         * @param  {number} options.timeoutIncr=500 Additional time in milliseconds to increase the timeout per try.
         * @param  {number} options.tries=3 Number of tries to lookup the value.
         * @return {Promise} A Promise the resolves to the received Datagram or `null` on timeout.
         */
        public beginBulkValueTransaction(address: number, txTimeout: number, options): Promise<Buffer>;

        /**
         * Sends a Datagram to commit a bulk valke transaction.
         * Returns a Promise that resolves to the answer Datagram or `null` on timeout.
         *
         * @param  {number} address The VBus address of the device to commit the transaction on.
         * @param  {object} options
         * @param  {number} options.timeout=500 Time in milliseconds between tries.
         * @param  {number} options.timeoutIncr=500 Additional time in milliseconds to increase the timeout per try.
         * @param  {number} options.tries=3 Number of tries to lookup the value.
         * @return {Promise} A Promise the resolves to the received Datagram or `null` on timeout.
         */
        public commitBulkValueTransaction(address: number, options): Promise<Buffer>;

        /**
         * Sends a Datagram to rollback a bulk valke transaction.
         * Returns a Promise that resolves to the answer Datagram or `null` on timeout.
         *
         * @param  {number} address The VBus address of the device to perform the rollback on.
         * @param  {object} options
         * @param  {number} options.timeout=500 Time in milliseconds between tries.
         * @param  {number} options.timeoutIncr=500 Additional time in milliseconds to increase the timeout per try.
         * @param  {number} options.tries=3 Number of tries to lookup the value.
         * @return {Promise} A Promise the resolves to the received Datagram or `null` on timeout.
         */
        public rollbackBulkValueTransaction(address: number, options): Promise<void>;

        /**
         * Sends a Datagram to set a value during a bulk value transaction.
         * Returns a Promise that resolves to the answer Datagram or `null` on timeout.
         *
         * @param  {number} address The VBus address of the device to set the value on.
         * @param  {number} valueId The ID of the value to write to the device.
         * @param  {number} value The value to write to the device.
         * @param  {object} options
         * @param  {number} options.timeout=500 Time in milliseconds between tries.
         * @param  {number} options.timeoutIncr=500 Additional time in milliseconds to increase the timeout per try.
         * @param  {number} options.tries=3 Number of tries to lookup the value.
         * @return {Promise} A Promise the resolves to the received Datagram or `null` on timeout.
         */
        public setBulkValueById(address, valueId, value, options): Promise<Buffer>;

        public ping(address: number, valueId: number, value: number, options): Promise<Buffer>;

        public getStorageActivity(address: number, options): Promise<any>;

        /**
         * Creates a promise that resolves when this Connection
         * instance is connected and rejects if it is disconnected.
         * If it is neither connected nor disconnected the promise
         * will stay pending until one of the states is entered.
         *
         * @returns {Promise}
         */
        public createConnectedPromise(): Promise<void>;
    }

    export class TcpConnection extends Connection {
        public host: string;
        public port: number;
        public viaTag: string;
        public password: string;
        public channelListCallback: any;
        public channel: string | number;
        public rawVBusDataOnly: boolean;
        public tlsOptions: any;
        public reconnectTimeout: number;
        public reconnectTimeoutIncr: number;
        public reconnectTimeoutMax: number;

        /**
         * Creates a new TcpConnection instance and optionally initializes its
         * members to the given values.
         *
         * @constructs
         * @augments Connection
         * @param {object} options Initialization values
         * @param {string} options.host See {@link TcpConnection#host}
         * @param {number} options.port See {@link TcpConnection#port}
         * @param {string} options.viaTag See {@link TcpConnection#viaTag}
         * @param {string} options.password See {@link TcpConnection#password}
         * @param {boolean} options.rawVBusDataOnly See {@link TcpConnection#rawVBusDataOnly}
         *
         * @classdesc
         * The TcpConnection class is primarily designed to provide access to VBus live data
         * using the VBus-over-TCP specification. That includes the VBus/LAN adapter, the
         * Dataloggers (DL2 and DL3) and VBus.net.
         * In addition to that it can be used to connect to a raw VBus data stream using TCP
         * (for example provided by a serial-to-LAN gateway).
         */
        public constructor(options: {
            host: string;
            port?: number;
            viaTag?: string;
            password: string;
            rawVBusDataOnly?: boolean;
        });

        public connect(force?: boolean): void;

        public disconnect(): void;
    }
}
