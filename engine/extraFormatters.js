import {
  formatHTML
}
from "./htmlFormatter.js";

function eolOf(source) {
  return source.includes("\r\n")?"\r\n": "\n";
}
function finish(lines, options, eol) {
  while (lines.length && lines[lines.length - 1] === "") lines.pop();
  const out = lines.join(eol);
  return options.finalNewline !== false && out?out + eol: out;
}
function indent(level, options, fallback = 2) {
  const size = Number.isInteger(options.indentSize) && options.indentSize > 0?options.indentSize: fallback;
  return options.useTabs?"\t".repeat(level): " ".repeat(level * size);
}

export function formatJSON(source, options = {}, jsonc = false) {
  const eol = eolOf(source);
  const size = Number.isInteger(options.indentSize) && options.indentSize > 0?options.indentSize: 2;
  if (!jsonc) {
    const value = JSON.parse(source);
    const gap = options.useTabs?"\t": size;
    const out = JSON.stringify(value, null, gap);
    return options.finalNewline === false?out: out + eol;
  }

  // JSONC conservador: preserva comentários e só normaliza estrutura/espaçamento.
  const lines = [];
  let current = "",
  level = 0,
  quote = null,
  escaped = false,
  inLine = false,
  inBlock = false;
  const write = s => {
    if (!current) current = indent(level, options, 2);
    current += s;
  };
  const nl =() => {
    const t = current.trimEnd();
    if (t.trim()) lines.push(t);
    current = "";
    inLine = false;
  };
  const space =() => {
    if (!current.endsWith(" ")) current += " ";
  };
  for (let i = 0; i < source.length; i++) {
    const ch = source[i],
    next = source[i + 1];
    if (inLine) {
      write(ch);
      if (ch === "\n") nl();
      continue;
    }
    if (inBlock) {
      write(ch);
      if (ch === "*" && next === "/") {
        write("/");
        i++;
        inBlock = false;
      }
      continue;
    }
    if (quote) {
      write(ch);
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === "/" && next === "/") {
      if (current.trim()) space();
      write("//");
      i++;
      inLine = true;
      continue;
    }
    if (ch === "/" && next === "*") {
      if (current.trim()) space();
      write("/*");
      i++;
      inBlock = true;
      continue;
    }
    if (ch === '"') {
      quote = ch;
      write(ch);
      continue;
    }
    if (/\s/.test(ch)) continue;
    if (ch === "{") {
      write("{");
      nl();
      level++;
      continue;
    }
    if (ch === "[") {
      write("[");
      nl();
      level++;
      continue;
    }
    if (ch === "}" || ch === "]") {
      if (current.trim()) nl();
      level = Math.max(0, level - 1);
      write(ch);
      continue;
    }
    if (ch === ",") {
      write(",");
      nl();
      continue;
    }
    if (ch === ":") {
      write(":");
      space();
      continue;
    }
    write(ch);
  }
  if (current.trim()) nl();
  return finish(lines, options, eol);
}

export function formatMarkdown(source, options = {}) {
  const eol = eolOf(source);
  const raw = source.replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let blanks = 0,
  inFence = false;
  for (const line of raw) {
    const trimmedRight = line.endsWith("  ")?line.replace(/[ \t]+$/g,
      "") + "  ": line.replace(/[ \t]+$/g, "");
    if (/^\s*```/.test(trimmedRight) || /^\s*~~~/.test(trimmedRight)) {
      inFence =!inFence;
      out.push(trimmedRight);
      blanks = 0;
      continue;
    }
    if (inFence) {
      out.push(line);
      continue;
    }
    if (!trimmedRight.trim()) {
      if (out.length && blanks <(options.maxBlankLines ?? 1)) {
        out.push("");
        blanks++;
      }
      continue;
    }
    blanks = 0;
    let text = trimmedRight.replace(/^(\s*[-*+]\s+)\s+/, "$1").replace(/^(\s*\d+\.\s+)\s+/, "$1");
    if (/^#{1,6}\S/.test(text)) text = text.replace(/^(#{1,6})(\S)/, "$1 $2");
    out.push(text);
  }
  return finish(out, options, eol);
}

export function formatYAML(source, options = {}) {
  const eol = eolOf(source);
  const out = [];
  let blanks = 0;
  for (const raw of source.replace(/\r\n/g, "\n").split("\n")) {
    if (!raw.trim()) {
      if (out.length && blanks <(options.maxBlankLines ?? 1)) {
        out.push("");
        blanks++;
      }
      continue;
    }
    blanks = 0;
    const lead = raw.match(/^\s*/)?.[0] ?? "";
    let body = raw.slice(lead.length).replace(/[ \t]+$/g, "");
    if (!body.startsWith("#") &&!body.includes("http://") &&!body.includes("https://")) body = body.replace(/^([^#"']*?):\s*/, "$1: ");
    out.push(lead.replace(/\t/g, " ".repeat(options.indentSize || 2)) + body);
  }
  return finish(out, options, eol);
}

export function formatXML(source, options = {}) {
  return formatHTML(source, { ...options, indentSize: options.indentSize || 2 });
}

const SQL_KEYWORDS = [
  "SELECT",
  "FROM",
  "WHERE",
  "JOIN",
  "LEFT JOIN",
  "RIGHT JOIN",
  "INNER JOIN",
  "OUTER JOIN",
  "GROUP BY",
  "ORDER BY",
  "HAVING",
  "LIMIT",
  "OFFSET",
  "INSERT INTO",
  "VALUES",
  "UPDATE",
  "SET",
  "DELETE FROM",
  "CREATE TABLE",
  "ALTER TABLE",
  "DROP TABLE",
  "UNION",
  "UNION ALL",
  "AND",
  "OR",
  "AS",
  "ON"
];
export function formatSQL(source, options = {}) {
  const eol = eolOf(source);
  let text = source.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();
  // Não toca conteúdo dentro de strings; tokenização simples por aspas.
  const parts = text.split(/('(?:''|[^'])*'|"(?:""|[^"])*")/g);
  for (let i = 0; i < parts.length; i += 2) {
    for (const kw of SQL_KEYWORDS.sort((a, b) => b.length - a.length)) {
      const re = new RegExp(`\\b${kw.replace(/ /g, "\\s+")}\\b`, "gi");
      parts[i] = parts[i].replace(re, kw);
    }
  }
  text = parts.join("");
  const breakBefore = [
    "SELECT",
    "FROM",
    "WHERE",
    "GROUP BY",
    "ORDER BY",
    "HAVING",
    "LIMIT",
    "OFFSET",
    "INSERT INTO",
    "VALUES",
    "UPDATE",
    "SET",
    "DELETE FROM",
    "CREATE TABLE",
    "ALTER TABLE",
    "DROP TABLE",
    "UNION",
    "UNION ALL",
    "LEFT JOIN",
    "RIGHT JOIN",
    "INNER JOIN",
    "OUTER JOIN",
    "JOIN"
  ];
  for (const kw of breakBefore.sort((a,
    b) => b.length - a.length)) text = text.replace(new RegExp(`\\s+${kw.replace(/ /g,"\\s+")}\\s+`,
    "g"), `\n${kw} `);
  text = text.replace(/^\n/, "").replace(/\s*,\s*/g, ", ").replace(/\s*;\s*$/g, ";");
  const out = text.split("\n").map(x => x.trimEnd());
  return finish(out, options, eol);
}
