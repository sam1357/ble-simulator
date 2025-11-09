# BLE Data Encoders

This document explains how to use the encoder system in the BLE simulator.

## Overview

The simulator includes a flexible encoder system that properly formats data according to Bluetooth specifications. You can specify encoders in your YAML config files or use them via REPL commands.

## Available Encoders

### `blood-pressure`

Encodes blood pressure measurements according to BLE Blood Pressure Profile (0x2A35).

**Format:** Includes systolic, diastolic, MAP, optional pulse rate, and timestamp.

**YAML Example:**

```yaml
- uuid: "00002a35-0000-1000-8000-00805f9b34fb"
  name: "blood-pressure-measurement"
  properties: ["indicate"]
  encoder:
    type: "blood-pressure"
```

**REPL Usage:**

```
bp 120/80          # Without pulse rate
bp 120/80 72       # With pulse rate
```

### `battery-level`

Encodes battery level as a percentage (0-100).

**YAML Example:**

```yaml
encoder:
  type: "battery-level"
```

**REPL Usage:**

```
write battery-level 85
```

### `heart-rate`

Encodes heart rate measurement (0x2A37).

**YAML Example:**

```yaml
encoder:
  type: "heart-rate"
```

### `temperature`

Encodes temperature measurement (0x2A1C) in Celsius or Fahrenheit.

**YAML Example:**

```yaml
encoder:
  type: "temperature"
```

### `text`

Plain UTF-8 text encoding.

**YAML Example:**

```yaml
encoder:
  type: "text"
```

### `uint8` / `uint16`

Simple integer encoding.

**YAML Example:**

```yaml
encoder:
  type: "uint8" # or uint16
```

## Blood Pressure Payload Format

The blood pressure encoder follows the official Bluetooth specification (GATT Blood Pressure Profile):

### Byte Structure:

```
Byte 0: Flags
  Bit 0: Blood Pressure Units (0=mmHg, 1=kPa)
  Bit 1: Time Stamp Present
  Bit 2: Pulse Rate Present
  Bit 3: User ID Present
  Bit 4: Measurement Status Present
  Bits 5-7: Reserved

Bytes 1-2: Systolic (IEEE-11073 16-bit SFLOAT)
Bytes 3-4: Diastolic (IEEE-11073 16-bit SFLOAT)
Bytes 5-6: Mean Arterial Pressure (IEEE-11073 16-bit SFLOAT)

[If Bit 1 set]
Bytes 7-8: Year
Byte 9: Month
Byte 10: Day
Byte 11: Hour
Byte 12: Minute
Byte 13: Second

[If Bit 2 set]
Bytes 14-15: Pulse Rate (IEEE-11073 16-bit SFLOAT)
```

### IEEE-11073 SFLOAT Format:

- 4-bit exponent (signed)
- 12-bit mantissa (signed)
- Value = mantissa × 10^exponent

Our implementation uses exponent -1 (multiply by 10 for one decimal place).

## Using Encoders in YAML

Add an `encoder` section to any characteristic:

```yaml
characteristics:
  - uuid: "00002a35-0000-1000-8000-00805f9b34fb"
    name: "blood-pressure-measurement"
    properties: ["indicate"]
    encoder:
      type: "blood-pressure"
      params: # Optional parameters
        includeTimestamp: true
        includePulseRate: true
```

## Viewing Available Encoders

In the REPL, type:

```
encoders
```

This will list all available encoders with descriptions and examples.

## Creating Custom Encoders

To add a new encoder, edit `src/lib/encoder-registry.ts`:

```typescript
encoders["my-custom"] = {
  encode: (value: number) => {
    const buffer = Buffer.alloc(2);
    buffer.writeUInt16LE(value, 0);
    return buffer;
  },
  description: "My custom encoder",
  example: "1234",
};
```

## Device Name Length

BLE advertising has a 31-byte limit. Device names longer than ~10-15 characters may be truncated in advertisements. For full device identification, use the Device Name characteristic (0x2A00) in the Generic Access Service.

**Recommendation:** Keep advertised names short (≤10 chars) for better visibility.
