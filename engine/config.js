import fs from "node:fs";
import path from "node:path";
import {
  detectLanguage
}
from "./languages.js";

export const DEFAULT_CONFIG = {
  indentSize: 0,
  useTabs: false,
  maxBlankLines: 1,
  finalNewline: true,
  braceStyle: "same-line",
  printWidth: 100,
  quotes: "preserve",
  semicolons: true,
  trailingComma: "none",
  bracketSpacing: true,
  organizeImports: false,
  cache: true,
  plugins: [],
  languages: {}
};

export function findConfigPath(startPath) {
  let dir = fs.existsSync(startPath) && fs.statSync(startPath).isDirectory()
  ?path.resolve(startPath): path.dirname(path.resolve(startPath));
  while (true) {
    const candidate = path.join(dir, ".jlsfmt.json");
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export function loadConfig(startPath) {
  const configPath = findConfigPath(startPath);
  if (!configPath) return { ...DEFAULT_CONFIG };
  const parsed = JSON.parse(fs.readFileSync(configPath, "utf8"));
  return {
    ...DEFAULT_CONFIG,
    ...parsed,
    languages: {
      ...(parsed.languages ?? {
      })
  },
  __configPath: configPath
};
}

export function resolveOptions(config, filePath, overrides = {}) {
  const language = overrides.language ?? detectLanguage(filePath);
  const languageOptions = config.languages?.[language] ?? {
};
const merged = { ...DEFAULT_CONFIG, ...config, ...languageOptions, ...overrides, language };
delete merged.languages;
delete merged.__configPath;
if (!Number.isInteger(merged.indentSize) || merged.indentSize <= 0) delete merged.indentSize;
merged.braceStyle = "same-line";
// identidade fixa do formatter
return merged;
}

export function projectRootFromConfig(config, fallbackPath) {
  return config.__configPath?path.dirname(config.__configPath): (fs.existsSync(fallbackPath) && fs.statSync(fallbackPath).isDirectory()?path.resolve(fallbackPath): path.dirname(path.resolve(fallbackPath)));
}
