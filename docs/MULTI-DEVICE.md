# Multi-Device Support

The BLE simulator now supports multiple device configurations and runtime device switching without terminating the program.

## Available Devices

The simulator automatically discovers all YAML config files in the `configs/` directory:

- **and-ua651-blood-pressure**: A&D Blood Pressure Monitor
- **yk-oximeter**: YK Pulse Oximeter
- **and-uc352-weight-scale**: A&D Weight Scale

## Device Switching Commands

### View Available Devices

```
> devices
```

Lists all available device configurations in the `configs/` directory with their display names.

### Switch to a Different Device

```
> switch <device-name>
```

Stops the current peripheral, loads the new config, and starts advertising as the new device.

Example:

```
> switch yk-oximeter
```

### View Current Device

```
> current
```

Shows the currently active device information.

## Writing Data to Characteristics

Instead of device-specific commands, use the flexible `write` and `notify` commands that automatically use the appropriate encoder based on the characteristic's configuration.

### Blood Pressure Monitor

```
> write blood-pressure-measurement 120 80 72
```

Arguments: systolic, diastolic, pulse rate

### Pulse Oximeter

```
> notify measurement 98 72
```

Arguments: SpO2%, pulse rate

### Weight Scale

```
> notify weight-measurement 75.5 kg
```

Arguments: weight, unit (kg or lb)

### Battery Level

```
> write battery-level 95
```

Arguments: battery percentage (0-100)

## How It Works

1. **Encoder System**: Each characteristic in the YAML config specifies an encoder type
2. **Automatic Encoding**: The `write` and `notify` commands automatically parse arguments and use the correct encoder
3. **Runtime Switching**: Devices can be switched at runtime without restarting the application
4. **Service Discovery**: The simulator automatically registers all GATT services and characteristics from the config

## Adding New Devices

1. Create a new YAML file in the `configs/` directory
2. Define the device name, services, and characteristics
3. Specify the encoder type for each characteristic
4. The device will automatically appear in the `devices` list

Example structure:

```yaml
name: "DeviceName"
displayName: "Device Display Name"
screenDisplayName: "Screen Name"

services:
  - uuid: "service-uuid"
    characteristics:
      - uuid: "char-uuid"
        name: "char-name"
        properties: ["read", "write", "notify"]
        initial: ""
        encoder:
          type: "encoder-name"
```

## Available Encoders

See `docs/ENCODERS.md` for a complete list of available encoders and their formats.

Common encoders:

- `blood-pressure`: IEEE-11073 blood pressure format
- `pulse-oximeter`: SpO2 and pulse rate
- `weight-scale`: Weight measurement with unit
- `battery-level`: 0-100% battery
- `heart-rate`: Heart rate in bpm
- `temperature`: Temperature value
- `text`: Plain text data
- `uint8`, `uint16`, `uint32`: Numeric values
