import readline from "readline";
import { registry } from "./registry";
import { listEncoders, getEncoder } from "./encoder-registry";
import {
  stopPeripheral,
  startPeripheral,
  getCurrentConfig,
} from "./peripheral";
import type { DeviceConfig } from "../types";
import fs from "fs";
import yaml from "js-yaml";
import path from "path";
import bleno from "@abandonware/bleno";

let rl: readline.Interface;
let availableConfigs: Map<string, string> = new Map();
let configByNumber: Map<number, string> = new Map();

function loadAvailableConfigs() {
  const configsDir = path.join(process.cwd(), "configs");

  if (!fs.existsSync(configsDir)) {
    return;
  }

  const files = fs
    .readdirSync(configsDir)
    .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"));

  let index = 1;
  for (const file of files) {
    const fullPath = path.join(configsDir, file);
    try {
      const content = fs.readFileSync(fullPath, "utf8");
      const config = yaml.load(content) as DeviceConfig;
      const key = file.replace(/\.(yaml|yml)$/, "");
      availableConfigs.set(key, fullPath);
      configByNumber.set(index, key);
      index++;
    } catch (err) {
      console.error(
        `⚠️  Failed to load config ${file}:`,
        (err as Error).message
      );
    }
  }
}

export function startREPL(): void {
  process.stdin.setRawMode?.(false);

  loadAvailableConfigs();

  rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "> ",
    terminal: true,
  });

  console.log("Type 'help' for commands.\n");

  setImmediate(() => {
    rl.prompt();
  });

  rl.on("line", (line: string) => {
    const input = line.trim();

    if (!input) {
      rl.prompt();
      return;
    }

    const parts = input.split(/\s+/);
    const cmd = parts[0].toLowerCase();

    // Handle async commands
    (async () => {
      switch (cmd) {
        case "help":
          showHelp();
          break;

        case "list":
          bleno.disconnect();
          bleno.removeAllListeners();
          bleno.stopAdvertising(); // --- IGNORE ---
          listCharacteristics();
          break;

        case "read":
          if (parts.length < 2) {
            console.log("Usage: read <char>");
          } else {
            readCharacteristic(parts[1]);
          }
          break;

        case "write":
          if (parts.length < 3) {
            console.log("Usage: write <char> <value...>");
            console.log(
              "The value will be encoded based on the characteristic's encoder"
            );
          } else {
            writeCharacteristic(parts[1], parts.slice(2));
          }
          break;

        case "notify":
          if (parts.length < 3) {
            console.log("Usage: notify <char> <value...>");
            console.log(
              "The value will be encoded based on the characteristic's encoder"
            );
          } else {
            notifyCharacteristic(parts[1], parts.slice(2));
          }
          break;

        case "encoders":
          listEncoders();
          break;

        case "devices":
          listDevices();
          break;

        case "switch":
          if (parts.length < 2) {
            console.log("Usage: switch <device-name|number>");
            console.log("Use 'devices' to see available devices");
          } else {
            const deviceId = parts[1];
            // Check if it's a number
            const num = parseInt(deviceId);
            if (!isNaN(num) && configByNumber.has(num)) {
              await switchDevice(configByNumber.get(num)!);
            } else {
              await switchDevice(deviceId);
            }
          }
          break;

        case "current":
          showCurrentDevice();
          break;

        case "exit":
        case "quit":
          console.log("Goodbye!");
          rl.close();
          process.exit(0);

        default:
          console.log(`Unknown command: ${cmd}`);
          console.log("Type 'help' for available commands.");
      }

      setImmediate(() => {
        rl.prompt();
      });
    })().catch((err) => {
      console.error("Error executing command:", err.message);
      setImmediate(() => {
        rl.prompt();
      });
    });
  });

  rl.on("close", () => {
    console.log("\nGoodbye!");
    process.exit(0);
  });

  rl.on("SIGINT", () => {
    rl.close();
    process.exit(0);
  });
}

function showHelp(): void {
  console.log("Commands:");
  console.log("  list                      - List all characteristics");
  console.log("  read <char>              - Read a characteristic value");
  console.log(
    "  write <char> <value...>  - Write to a characteristic (uses encoder)"
  );
  console.log("  notify <char> <value...> - Send notification (uses encoder)");
  console.log("  encoders                  - List all available data encoders");
  console.log("  devices                   - List available device configs");
  console.log("  switch <device|number>    - Switch to a different device");
  console.log("  current                   - Show current device");
  console.log("  help                      - Show this help");
  console.log("  exit/quit                 - Exit the program");
  console.log("");
  console.log("Examples:");
  console.log(
    "  switch 2                                     (switch to device #2)"
  );
  console.log(
    "  write blood-pressure-measurement 120 80 72  (systolic, diastolic, pulse)"
  );
  console.log("  notify measurement 98 72                     (spo2%, pulse)");
  console.log("  write weight-measurement 75.5 kg            (weight, unit)");
  console.log("  write battery-level 95                       (battery %)");
}

function listCharacteristics(): void {
  const names = Object.keys(registry);

  if (names.length === 0) {
    console.log("No characteristics registered.");
    return;
  }

  console.log("Characteristics:");
  for (const name of names) {
    const handle = registry[name];
    const props = handle.config.properties.join(", ");
    console.log(`  - ${name} [${props}] = "${handle.value.toString()}"`);
  }
}

function readCharacteristic(name: string): void {
  const handle = registry[name];

  if (!handle) {
    console.log(`❌ No such characteristic: ${name}`);
    return;
  }

  console.log(`✅ ${name} = "${handle.value.toString()}"`);
}

function writeCharacteristic(name: string, values: string[]): void {
  const handle = registry[name];

  if (!handle) {
    console.log(`❌ No such characteristic: ${name}`);
    return;
  }

  // Check if characteristic has an encoder
  const encoderType = handle.config.encoder?.type;
  let buffer: Buffer;

  if (encoderType) {
    const encoder = getEncoder(encoderType);
    if (!encoder) {
      console.log(`❌ Encoder '${encoderType}' not found`);
      return;
    }

    try {
      // Parse values based on encoder type
      const args = parseEncoderArgs(encoderType, values);
      buffer = encoder.encode(...args);
      handle.value = buffer;
      console.log(
        `✅ Write: ${name} = ${values.join(" ")} (encoded with ${encoderType})`
      );
    } catch (err) {
      console.log(`❌ Error encoding value: ${(err as Error).message}`);
      console.log(`   Expected format: ${encoder.example}`);
      return;
    }
  } else {
    // No encoder, treat as text
    buffer = Buffer.from(values.join(" "));
    handle.value = buffer;
    console.log(`✅ Write: ${name} = "${values.join(" ")}"`);
  }
}

function notifyCharacteristic(name: string, values: string[]): void {
  const handle = registry[name];

  if (!handle) {
    console.log(`❌ No such characteristic: ${name}`);
    return;
  }

  if (!handle.updateValueCallback) {
    console.log(`⚠️  No clients subscribed to ${name}`);
    return;
  }

  // Check if characteristic has an encoder
  const encoderType = handle.config.encoder?.type;
  let buffer: Buffer;

  if (encoderType) {
    const encoder = getEncoder(encoderType);
    if (!encoder) {
      console.log(`❌ Encoder '${encoderType}' not found`);
      return;
    }

    try {
      // Parse values based on encoder type
      const args = parseEncoderArgs(encoderType, values);
      buffer = encoder.encode(...args);
      handle.value = buffer;
      handle.updateValueCallback(buffer);
      console.log(
        `✅ Notify: ${name} -> ${values.join(
          " "
        )} (encoded with ${encoderType})`
      );
    } catch (err) {
      console.log(`❌ Error encoding value: ${(err as Error).message}`);
      console.log(`   Expected format: ${encoder.example}`);
      return;
    }
  } else {
    // No encoder, treat as text
    buffer = Buffer.from(values.join(" "));
    handle.value = buffer;
    handle.updateValueCallback(buffer);
    console.log(`✅ Notify: ${name} -> "${values.join(" ")}"`);
  }
}

function parseEncoderArgs(encoderType: string, values: string[]): any[] {
  switch (encoderType) {
    case "blood-pressure":
      // Expect: systolic diastolic pulse
      if (values.length < 3) {
        throw new Error(
          "Blood pressure requires 3 values: systolic diastolic pulse"
        );
      }
      return [parseInt(values[0]), parseInt(values[1]), parseInt(values[2])];

    case "pulse-oximeter":
      // Expect: spo2 pulse [perfusionIndex]
      if (values.length < 2) {
        throw new Error(
          "Pulse oximeter requires at least 2 values: spo2% pulse [perfusionIndex]"
        );
      }
      return [
        parseInt(values[0]),
        parseInt(values[1]),
        values[2] ? parseFloat(values[2]) : undefined,
      ];

    case "weight-scale":
      // Expect: weight [unit] [bmi] [height]
      if (values.length < 1) {
        throw new Error(
          "Weight scale requires at least 1 value: weight [kg|lb] [bmi] [height]"
        );
      }
      return [
        parseFloat(values[0]),
        values[1] === "lb" || values[1] === "kg" ? values[1] : "kg",
        values[2] ? parseFloat(values[2]) : undefined,
        values[3] ? parseFloat(values[3]) : undefined,
      ];

    case "battery-level":
    case "uint8":
      // Single number 0-255
      return [parseInt(values[0])];

    case "uint16":
      // Single number 0-65535
      return [parseInt(values[0])];

    case "uint32":
      // Single number
      return [parseInt(values[0])];

    case "heart-rate":
      // heart rate value
      return [parseInt(values[0])];

    case "temperature":
      // temperature value
      return [parseFloat(values[0])];

    case "text":
      // Join all values as text
      return [values.join(" ")];

    default:
      // Default: try to parse numbers, fallback to strings
      return values.map((v) => {
        const num = parseFloat(v);
        return isNaN(num) ? v : num;
      });
  }
}

function listDevices(): void {
  if (availableConfigs.size === 0) {
    console.log("No device configs found in ./configs directory");
    return;
  }

  const current = getCurrentConfig();
  console.log("Available devices:");

  // Get sorted entries by number
  const sortedEntries = Array.from(configByNumber.entries()).sort(
    (a, b) => a[0] - b[0]
  );

  for (const [num, name] of sortedEntries) {
    const configPath = availableConfigs.get(name);
    if (!configPath) continue;

    try {
      const content = fs.readFileSync(configPath, "utf8");
      const config = yaml.load(content) as DeviceConfig;
      const isCurrent =
        current && current.name === config.name ? " ← current" : "";
      console.log(`  ${num}. ${config.displayName || config.name}${isCurrent}`);
    } catch (err) {
      console.log(`  ${num}. ${name} (error loading)`);
    }
  }
  console.log("\nSwitch using: switch <number> or switch <name>");
}

function showCurrentDevice(): void {
  const current = getCurrentConfig();
  if (!current) {
    console.log("No device currently active");
    return;
  }

  console.log(`Current device: ${current.displayName || current.name}`);
  console.log(`Advertising as: ${current.name}`);
  console.log(`Services: ${current.services.length}`);
}

async function switchDevice(deviceName: string): Promise<void> {
  const configPath = availableConfigs.get(deviceName);

  if (!configPath) {
    console.log(`❌ Device '${deviceName}' not found`);
    console.log("Use 'devices' to see available devices");
    return;
  }

  try {
    const content = fs.readFileSync(configPath, "utf8");
    const config = yaml.load(content) as DeviceConfig;

    console.log(`Switching to ${config.displayName || config.name}...`);

    await stopPeripheral();

    await new Promise((resolve) => setTimeout(resolve, 20000));

    console.log("Starting new device...");

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Timeout waiting for peripheral to start"));
      }, 15000);

      startPeripheral(config, () => {
        clearTimeout(timeout);
        console.log("✅ Device switched successfully");
        console.log("");
        resolve();
      });
    });
  } catch (err) {
    console.error("❌ Error switching device:", (err as Error).message);
  }
}
