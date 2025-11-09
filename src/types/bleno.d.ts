declare module "@abandonware/bleno" {
  import { EventEmitter } from "events";

  export type Property =
    | "read"
    | "write"
    | "writeWithoutResponse"
    | "notify"
    | "indicate"
    | "authenticatedSignedWrites"
    | "extendedProperties";

  class CharacteristicClass {
    uuid: string;
    properties: Property[];
    static RESULT_SUCCESS: number;
    static RESULT_INVALID_OFFSET: number;
    static RESULT_INVALID_ATTRIBUTE_LENGTH: number;
    static RESULT_UNLIKELY_ERROR: number;

    constructor(options: {
      uuid: string;
      properties: Property[];
      value?: Buffer;
      descriptors?: Descriptor[];
      onReadRequest?: (
        offset: number,
        callback: (result: number, data?: Buffer) => void
      ) => void;
      onWriteRequest?: (
        data: Buffer,
        offset: number,
        withoutResponse: boolean,
        callback: (result: number) => void
      ) => void;
      onSubscribe?: (
        maxValueSize: number,
        updateValueCallback: (data: Buffer) => void
      ) => void;
      onUnsubscribe?: () => void;
      onNotify?: () => void;
      onIndicate?: () => void;
    });
  }

  class DescriptorClass {
    constructor(options: { uuid: string; value?: string | Buffer });
  }

  class PrimaryServiceClass {
    uuid: string;
    characteristics: CharacteristicClass[];

    constructor(options: {
      uuid: string;
      characteristics: CharacteristicClass[];
    });
  }

  interface Bleno extends EventEmitter {
    state: string;
    address: string;
    platform: string;

    Characteristic: typeof CharacteristicClass;
    PrimaryService: typeof PrimaryServiceClass;
    Descriptor: typeof DescriptorClass;

    on(event: "stateChange", listener: (state: string) => void): this;
    on(
      event: "advertisingStart",
      listener: (error: Error | null) => void
    ): this;
    on(event: "advertisingStartError", listener: (error: Error) => void): this;
    on(event: "advertisingStop", listener: () => void): this;
    on(event: "accept", listener: (clientAddress: string) => void): this;
    on(event: "disconnect", listener: (clientAddress: string) => void): this;
    on(event: "rssiUpdate", listener: (rssi: number) => void): this;

    startAdvertising(
      name: string,
      serviceUuids: string[],
      callback?: (error: Error | null) => void
    ): void;
    startAdvertisingWithEIRData(
      advertisementData: Buffer,
      scanData?: Buffer,
      callback?: (error: Error | null) => void
    ): void;
    startAdvertisingIBeacon(
      uuid: string,
      major: number,
      minor: number,
      measuredPower: number,
      callback?: (error: Error | null) => void
    ): void;
    stopAdvertising(callback?: () => void): void;
    setServices(
      services: PrimaryServiceClass[],
      callback?: (error: Error | null) => void
    ): void;
    disconnect(): void;
    updateRssi(callback?: (error: Error | null, rssi: number) => void): void;
  }

  const bleno: Bleno;
  export default bleno;

  export {
    CharacteristicClass as Characteristic,
    PrimaryServiceClass as PrimaryService,
    DescriptorClass as Descriptor,
  };
}
