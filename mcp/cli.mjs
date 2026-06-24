#!/usr/bin/env node
/**
 * slides-mcp CLI — installs the Slides MCP server into Claude Code or Claude Desktop.
 *
 * Usage:
 *   npx slides-mcp                  # install (default)
 *   npx slides-mcp install          # same
 *   npx slides-mcp uninstall        # remove the MCP entry
 *   npx slides-mcp status           # check if installed
 */

import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_PATH = path.resolve(__dirname, "server.mjs");

const ENTRY_KEY = "slides";

const CONFIG_TARGETS = [
  {
    label: "Claude Code (user settings)",
    file: path.join(os.homedir(), ".claude", "settings.json"),
  },
  {
    label: "Claude Desktop (macOS)",
    file: path.join(
      os.homedir(),
      "Library",
      "Application Support",
      "Claude",
      "claude_desktop_config.json",
    ),
  },
  {
    label: "Claude Desktop (Linux)",
    file: path.join(os.homedir(), ".config", "Claude", "claude_desktop_config.json"),
  },
];

async function readJson(file) {
  try {
    const raw = await fs.readFile(file, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function writeJson(file, data) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

function mcpEntry(baseUrl) {
  return {
    command: "node",
    args: [SERVER_PATH],
    env: baseUrl ? { SLIDES_BASE_URL: baseUrl } : {},
  };
}

async function install(baseUrl) {
  let installed = 0;
  for (const target of CONFIG_TARGETS) {
    const config = await readJson(target.file);
    config.mcpServers ??= {};
    config.mcpServers[ENTRY_KEY] = mcpEntry(baseUrl);
    await writeJson(target.file, config);
    console.log(`  ✓ ${target.label}: ${target.file}`);
    installed++;
  }
  console.log(`\nInstalled "${ENTRY_KEY}" MCP server in ${installed} config file(s).`);
  console.log(`\nServer path: ${SERVER_PATH}`);
  console.log(`App URL:     ${baseUrl ?? "http://localhost:3000"} (override with SLIDES_BASE_URL)`);
  console.log("\nRestart Claude Code / Claude Desktop for the change to take effect.");
  console.log("\nAvailable tools:");
  console.log("  get_slide_schema       — JSON Schema for all slide types");
  console.log("  list_presentations     — list saved presentations");
  console.log("  get_presentation       — get a presentation with all slides");
  console.log("  create_presentation    — create a new empty presentation");
  console.log("  update_slides          — author slides as typed JSON");
  console.log("  add_slides_from_topic  — AI-generate slides about a topic");
  console.log("  regenerate_slide       — rewrite a single slide");
  console.log("  delete_presentation    — delete a presentation");
  console.log("  get_player_url         — get the preview URL");
}

async function uninstall() {
  let removed = 0;
  for (const target of CONFIG_TARGETS) {
    const config = await readJson(target.file);
    if (config.mcpServers?.[ENTRY_KEY]) {
      delete config.mcpServers[ENTRY_KEY];
      await writeJson(target.file, config);
      console.log(`  ✓ Removed from ${target.label}: ${target.file}`);
      removed++;
    }
  }
  if (removed === 0) {
    console.log('  — Not found in any config file. Nothing to remove.');
  } else {
    console.log(`\nRemoved "${ENTRY_KEY}" from ${removed} config file(s).`);
  }
}

async function status() {
  for (const target of CONFIG_TARGETS) {
    const config = await readJson(target.file);
    const entry = config.mcpServers?.[ENTRY_KEY];
    if (entry) {
      console.log(`  ✓ Installed — ${target.label}`);
      console.log(`    ${JSON.stringify(entry)}`);
    } else {
      console.log(`  — Not installed — ${target.label}`);
    }
  }
}

const [, , cmd, ...rest] = process.argv;
const baseUrl = rest.find((a) => a.startsWith("--url="))?.slice(6) ?? process.env.SLIDES_BASE_URL;

console.log("Slides MCP Installer\n");

switch (cmd ?? "install") {
  case "install":
    await install(baseUrl);
    break;
  case "uninstall":
    await uninstall();
    break;
  case "status":
    await status();
    break;
  default:
    console.error(`Unknown command: ${cmd}`);
    console.error("Usage: npx slides-mcp [install|uninstall|status] [--url=http://localhost:3000]");
    process.exit(1);
}
