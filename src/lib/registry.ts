import type { Registry } from "../types";

// Stores all characteristic handles
export const registry: Registry = {};

export function clearRegistry() {
  for (const key in registry) {
    delete registry[key];
  }
}
