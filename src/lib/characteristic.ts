import bleno, { ConnectionHandle, type Property } from "@stoprocent/bleno";
import { registry } from "./registry";
import type { CharacteristicConfig } from "../types";

export function createCharacteristic(
  config: CharacteristicConfig
): InstanceType<typeof bleno.Characteristic> {
  const properties = config.properties.map((p) => p.toLowerCase() as Property);

  const handle = {
    config: config,
    value: Buffer.from(config.initial || ""),
    updateValueCallback: null as ((data: Buffer) => void) | null,
  };

  registry[config.name] = handle;

  const characteristic = new bleno.Characteristic({
    uuid: config.uuid,
    properties: properties,

    onReadRequest: function (
      _handle: ConnectionHandle,
      _offset: number,
      callback: (result: number, data?: Buffer) => void
    ) {
      console.log(`[READ] ${config.name} <- ${handle.value.toString()}`);
      callback(bleno.Characteristic.RESULT_SUCCESS, handle.value);
    },

    onWriteRequest: function (
      _handle: ConnectionHandle,
      data: Buffer,
      _offset: number,
      _withoutResponse: boolean,
      callback: (result: number) => void
    ) {
      handle.value = Buffer.from(data);
      console.log(`[WRITE] ${config.name} -> ${data.toString()}`);
      callback(bleno.Characteristic.RESULT_SUCCESS);
    },

    onSubscribe: function (
      _handle: ConnectionHandle,
      _maxValueSize: number,
      updateValueCallback: (data: Buffer) => void
    ) {
      console.log(`[SUBSCRIBE] ${config.name}`);
      handle.updateValueCallback = updateValueCallback;
    },

    onUnsubscribe: function () {
      console.log(`[UNSUBSCRIBE] ${config.name}`);
      handle.updateValueCallback = null;
    },
  });

  return characteristic;
}
