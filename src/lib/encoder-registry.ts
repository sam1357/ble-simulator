import { encodeSFloat } from "./utils";

export interface EncoderInfo {
  encode: (...args: any[]) => Buffer;
  description: string;
  example: string;
}

export interface EncoderRegistry {
  [key: string]: EncoderInfo;
}

export const encoders: EncoderRegistry = {
  "blood-pressure": {
    encode: (systolic: number, diastolic: number, pulseRate: number) => {
      const flags = 0x04; // Bit 2: Pulse Rate present
      const size = 9; // buffer size

      const buffer = Buffer.alloc(size);
      let offset = 0;

      buffer.writeUint8(flags, offset++);
      buffer.writeUInt16LE(encodeSFloat(systolic), offset);
      offset += 2;
      buffer.writeUInt16LE(encodeSFloat(diastolic), offset);
      offset += 2;
      buffer.writeUInt16LE(encodeSFloat((systolic + diastolic) / 3), offset); // Mean Arterial Pressure
      offset += 2;
      buffer.writeUInt16LE(encodeSFloat(pulseRate), offset);
      offset += 2;

      return buffer;
    },
    description: "Blood Pressure Measurement (0x2A35) with pulse rate",
    example: "120 80 72 (systolic, diastolic, pulse)",
  },

  "pulse-oximeter": {
    encode: (spo2: number, pulseRate: number, perfusionIndex?: number) => {
      // Pulse Oximeter Measurement format
      const flags = perfusionIndex !== undefined ? 0x01 : 0x00;
      const size = perfusionIndex !== undefined ? 5 : 4;
      const buffer = Buffer.alloc(size);

      buffer.writeUInt8(flags, 0);
      buffer.writeUInt8(spo2, 1); // SpO2 percentage
      buffer.writeUInt16LE(pulseRate * 10, 2); // Pulse rate

      if (perfusionIndex !== undefined) {
        buffer.writeUInt8(Math.round(perfusionIndex * 10), 4);
      }

      return buffer;
    },
    description: "Pulse Oximeter Measurement - SpO2 and pulse rate",
    example: "spo2 98 72 (SpO2%, pulse rate)",
  },

  "weight-scale": {
    encode: (weight: number, unit: "kg" | "lb" = "kg") => {
      let flags = unit === "lb" ? 0x01 : 0x00;

      const size = 3;
      const buffer = Buffer.alloc(size);

      // For lb: divide by 0.01 (multiply by 100)
      // For kg: divide by 0.005 (multiply by 200)
      const encodedWeight =
        unit === "lb" ? Math.round(weight * 100) : Math.round(weight * 200);

      buffer.writeUInt8(flags, 0);
      buffer.writeUInt16LE(encodedWeight, 1);

      return buffer;
    },
    description: "Weight Scale Measurement (0x2A9D)",
    example: "weight 75.5 or weight 165 lb",
  },

  "battery-level": {
    encode: (level: number) => {
      const buffer = Buffer.alloc(1);
      buffer.writeUInt8(Math.max(0, Math.min(100, level)), 0);
      return buffer;
    },
    description: "Battery Level (0x2A19) - 0-100%",
    example: "85",
  },

  uint32: {
    encode: (value: number) => {
      const buffer = Buffer.alloc(4);
      buffer.writeUInt32LE(value, 0);
      return buffer;
    },
    description: "Unsigned 32-bit integer (0-4294967295)",
    example: "12345",
  },

  text: {
    encode: (text: string) => {
      return Buffer.from(text, "utf8");
    },
    description: "Plain text string",
    example: "any text",
  },

  uint8: {
    encode: (value: number) => {
      const buffer = Buffer.alloc(1);
      buffer.writeUInt8(value, 0);
      return buffer;
    },
    description: "Unsigned 8-bit integer (0-255)",
    example: "42",
  },

  uint16: {
    encode: (value: number) => {
      const buffer = Buffer.alloc(2);
      buffer.writeUInt16LE(value, 0);
      return buffer;
    },
    description: "Unsigned 16-bit integer (0-65535)",
    example: "1234",
  },
};

export function getEncoder(name: string): EncoderInfo | undefined {
  return encoders[name];
}

export function listEncoders(): void {
  console.log("\nAvailable Encoders:");
  for (const [name, config] of Object.entries(encoders)) {
    console.log(`  ${name.padEnd(20)} - ${config.description}`);
    console.log(`  ${"".padEnd(20)}   Example: ${config.example}`);
  }
}
