"use strict";
import fs = require("node:fs");

export function parseEnvFile(filePath: string): Record<string, string> {
  const content = fs.readFileSync(filePath, "utf8");
  return parseEnvString(content);
}

export function parseEnvString(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    // Strip surrounding quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key && value) result[key] = value;
  }
  return result;
}

/**
 * Format env object into .env-style string for output.
 * Sorts keys alphabetically.
 */
export function formatEnvOutput(envMap: Record<string, string>): string {
  const keys = Object.keys(envMap).sort();
  return keys.map((k) => `${k}=${envMap[k]}`).join("\n") + "\n";
}