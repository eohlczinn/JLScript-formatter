import fs from "node:fs";
import path from "node:path";
import {
  isSupportedFile
}
from "./languages.js";
import {
  loadIgnore,
  isIgnored
}
from "./ignore.js";
import {
  getPlugin
}
from "./plugins.js";

export function collectSupportedFiles(target, options = {}) {
  const absolute = path.resolve(target);
  if (!fs.existsSync(absolute)) throw new Error(`Caminho não encontrado: ${target}`);
  const stat = fs.statSync(absolute);
  const root = options.root ??(stat.isDirectory()?absolute: path.dirname(absolute));
  const rules = options.ignore === false?[]: loadIgnore(root);
  if (stat.isFile()) return (isSupportedFile(absolute) || getPlugin(absolute,
    "")) &&!isIgnored(absolute, root, rules)?[absolute]: [];
  const out = [];
  const walk = dir => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (isIgnored(full, root, rules)) continue;
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() &&(isSupportedFile(full) || getPlugin(full, ""))) out.push(full);
    }
  };
  walk(absolute);
  return out.sort();
}
export const collectJlsFiles = collectSupportedFiles;
