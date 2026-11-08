import path from "node:path";
import {
  createRequire
}
from "node:module";
const require = createRequire(import.meta.url);
const registry = new Map();

export function registerPlugin(plugin) {
  if (!plugin || typeof plugin.format !== "function") throw new Error("Plugin inválido: exporte { extensions/languages, format }.");
  for (const key of[
    ...(plugin.extensions ?? []),
    ...(plugin.languages ?? [])
  ]) registry.set(String(key).toLowerCase(), plugin);
}
export function getPlugin(filePath, language) {
  return registry.get(String(language).toLowerCase()) ?? registry.get(path.extname(filePath).toLowerCase());
}
export function loadPlugins(pluginList = [], baseDir = process.cwd()) {
  for (const spec of pluginList) {
    const resolved = spec.startsWith(".") || spec.startsWith("/")
    ?path.resolve(baseDir, spec)
    : require.resolve(spec, { paths: [baseDir] });
    const mod = require(resolved);
    registerPlugin(mod.default ?? mod);
  }
}
export function clearPlugins() {
  registry.clear();
}
