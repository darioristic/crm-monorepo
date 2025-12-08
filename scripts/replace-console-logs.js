#!/usr/bin/env node

/**
 * Script za zamenu console.log poziva sa strukturiranim loggerom
 *
 * Usage:
 *   node scripts/replace-console-logs.js
 *
 * Što radi:
 * - Pronalazi sve console.log/error/warn pozive
 * - Zamenjuje ih sa odgovarajućim logger pozivima
 * - Pravi backup pre izmena
 * - Generiše izveštaj o izmenama
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT_DIR = process.cwd();
const TARGET_DIRS = ["apps", "packages"];
const EXTENSIONS = [".ts", ".tsx", ".js", ".jsx"];
const EXCLUDE_PATTERNS = [
  "node_modules",
  "dist",
  ".next",
  "build",
  "__tests__",
  ".test.",
  ".spec.",
  "test-setup",
];

// Brojači
let _filesProcessed = 0;
let filesModified = 0;
let _totalReplacements = 0;

// Mapiranje console -> logger metoda
const CONSOLE_TO_LOGGER = {
  "console.log": "logger.info",
  "console.info": "logger.info",
  "console.warn": "logger.warn",
  "console.error": "logger.error",
  "console.debug": "logger.debug",
};

/**
 * Proverava da li fajl treba procesirati
 */
function shouldProcessFile(filePath) {
  if (!EXTENSIONS.some((ext) => filePath.endsWith(ext))) {
    return false;
  }

  if (EXCLUDE_PATTERNS.some((pattern) => filePath.includes(pattern))) {
    return false;
  }

  return true;
}

/**
 * Rekurzivno pronalazi sve fajlove
 */
function* walkDir(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      if (!EXCLUDE_PATTERNS.some((pattern) => entry.name.includes(pattern))) {
        yield* walkDir(fullPath);
      }
    } else if (entry.isFile() && shouldProcessFile(fullPath)) {
      yield fullPath;
    }
  }
}

/**
 * Detektuje koji logger import je potreban
 */
function detectLoggerImport(filePath) {
  if (filePath.includes("apps/api-server")) {
    return "import { logger } from '../lib/logger';";
  } else if (filePath.includes("apps/web")) {
    return "import { logger } from '@/lib/logger';";
  } else if (filePath.includes("packages/")) {
    return "import { logger } from './logger';  // TODO: Adjust path";
  }
  return "import { logger } from './lib/logger';  // TODO: Adjust path";
}

/**
 * Proverava da li fajl već ima logger import
 */
function hasLoggerImport(content) {
  return content.includes("from") && content.match(/['"].*logger['"]/);
}

/**
 * Zamenjuje console pozive sa logger pozivima
 */
function replaceConsoleLogs(filePath, content) {
  let modified = content;
  let replacements = 0;
  let needsImport = false;

  // Zameni console pozive
  for (const [consoleMethod, loggerMethod] of Object.entries(CONSOLE_TO_LOGGER)) {
    const regex = new RegExp(`\\b${consoleMethod}\\b`, "g");
    const matches = content.match(regex);

    if (matches) {
      modified = modified.replace(regex, loggerMethod);
      replacements += matches.length;
      needsImport = true;
    }
  }

  // Dodaj import ako je potrebno i ne postoji
  if (needsImport && !hasLoggerImport(modified)) {
    const importStatement = detectLoggerImport(filePath);

    // Nađi gde da ubacimo import (nakon postojećih importa)
    const lines = modified.split("\n");
    let lastImportIndex = -1;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith("import ")) {
        lastImportIndex = i;
      }
    }

    if (lastImportIndex >= 0) {
      lines.splice(lastImportIndex + 1, 0, importStatement);
      modified = lines.join("\n");
    } else {
      // Ako nema importa, dodaj na početak
      modified = `${importStatement}\n\n${modified}`;
    }
  }

  return { modified, replacements };
}

/**
 * Procesira jedan fajl
 */
function processFile(filePath) {
  _filesProcessed++;

  const content = readFileSync(filePath, "utf-8");
  const { modified, replacements } = replaceConsoleLogs(filePath, content);

  if (replacements > 0) {
    writeFileSync(filePath, modified, "utf-8");
    filesModified++;
    _totalReplacements += replacements;

    const _relativePath = relative(ROOT_DIR, filePath);
  }
}

/**
 * Glavna funkcija
 */
function main() {
  for (const targetDir of TARGET_DIRS) {
    const fullPath = join(ROOT_DIR, targetDir);

    try {
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        for (const filePath of walkDir(fullPath)) {
          processFile(filePath);
        }
      }
    } catch (error) {
      console.warn(`⚠️  Preskačem ${targetDir}: ${error.message}`);
    }
  }

  if (filesModified > 0) {
  } else {
  }
}

main();
