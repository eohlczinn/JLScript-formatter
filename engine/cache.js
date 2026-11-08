import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const CACHE_NAME = ".jlsfmt-cache.json";
export function contentHash(content, options, version) {
  return crypto.createHash("sha256").update(version).update("\0").update(content).update("\0").update(JSON.stringify(options)).digest("hex");
}
export function loadCache(root) {
  const file = path.join(root, CACHE_NAME);
  try {
    return { file, data: JSON.parse(fs.readFileSync(file, "utf8")) };
  } catch {
    return { file, data: { version: 1, files: {} } };
  }
}
export function saveCache(cache) {
  fs.writeFileSync(cache.file, JSON.stringify(cache.data, null, 2) + "\n", "utf8");
}
export function clearCache(root) {
  const f = path.join(root, CACHE_NAME);
  if (fs.existsSync(f)) fs.unlinkSync(f);
}
