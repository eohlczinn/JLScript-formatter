import fs from "node:fs";
import path from "node:path";

const DEFAULT_IGNORES = [
  "node_modules/",
  ".git/",
  "dist/",
  "build/",
  ".next/",
  "coverage/",
  "vendor/",
  ".jls-cache/"
];

function escapeRegex(s) {
  return s.replace(/[.+^${}()|[\]\\]/g, "\\$&");
}
function globToRegex(pattern) {
  let p = pattern.trim().replace(/\\/g, "/");
  const anchored = p.startsWith("/");
  if (anchored) p = p.slice(1);
  const dirOnly = p.endsWith("/");
  if (dirOnly) p = p.slice(0, - 1);
  let out = "";
  for (let i = 0; i < p.length; i++) {
    const ch = p[i];
    if (ch === "*") {
      if (p[i + 1] === "*") {
        out += ".*";
        i++;
      }
      else out += "[^/]*";
    } else if (ch === "?") out += "[^/]";
    else out += escapeRegex(ch);
  }
  const prefix = anchored?"^": "(?:^|/)";
  const suffix = dirOnly?"(?:/.*)?$": "$";
  return new RegExp(prefix + out + suffix);
}

export function loadIgnore(root) {
  const file = path.join(root, ".jlsfmtignore");
  const lines = fs.existsSync(file)?fs.readFileSync(file, "utf8").split(/\r?\n/): [];
  const patterns = [
    ...DEFAULT_IGNORES,
    ...lines.map(x => x.trim()).filter(x => x &&!x.startsWith("#"))
  ];
  return patterns.map(pattern =>({
    negated: pattern.startsWith("!"),
    regex: globToRegex(pattern.startsWith("!")?pattern.slice(1): pattern)
  }));
}

export function isIgnored(filePath, root, rules) {
  const rel = path.relative(root, filePath).replace(/\\/g, "/");
  let ignored = false;
  for (const rule of rules) if (rule.regex.test(rel)) ignored =!rule.negated;
  return ignored;
}
