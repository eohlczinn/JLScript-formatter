import {
  tokenize
}
from "./tokenizer.js";
import {
  detectLanguage,
  JS_FAMILY
}
from "./languages.js";
import {
  formatPython
}
from "./pythonFormatter.js";
import {
  formatHTML
}
from "./htmlFormatter.js";
import {
  formatCSS
}
from "./cssFormatter.js";
import {
  formatJSON,
  formatMarkdown,
  formatYAML,
  formatXML,
  formatSQL
}
from "./extraFormatters.js";
import {
  getPlugin
}
from "./plugins.js";

const PROFILES = {
  jls: {
    indentSize: 4,
    controls: new Set([
      "if",
      "se",
      "for",
      "para",
      "while",
      "enquanto",
      "catch",
      "capture",
      "try",
      "tente"
    ]),
    continuations: new Set(["else", "senao", "catch", "capture", "finally", "finalmente"]),
    tightNamedArgs: true
  },
  javascript: {
    indentSize: 2,
    controls: new Set(["if", "for", "while", "switch", "catch", "with"]),
    continuations: new Set(["else", "catch", "finally", "while"]),
    tightNamedArgs: false
  },
  typescript: {
    indentSize: 2,
    controls: new Set(["if", "for", "while", "switch", "catch", "with"]),
    continuations: new Set(["else", "catch", "finally", "while"]),
    tightNamedArgs: false
  },
  tsx: {
    indentSize: 2,
    controls: new Set(["if", "for", "while", "switch", "catch", "with"]),
    continuations: new Set(["else", "catch", "finally", "while"]),
    tightNamedArgs: false
  },
  jsx: {
    indentSize: 2,
    controls: new Set(["if", "for", "while", "switch", "catch", "with"]),
    continuations: new Set(["else", "catch", "finally", "while"]),
    tightNamedArgs: false
  },
  cpp: {
    indentSize: 4,
    controls: new Set(["if", "for", "while", "switch", "catch"]),
    continuations: new Set(["else", "catch", "while"]),
    tightNamedArgs: false
  }
};

const BINARY_OPERATORS = new Set([
  "=",
  "+=",
  "-=",
  "*=",
  "/=",
  "%=",
  "==",
  "!=",
  "===",
  "!==",
  "<",
  ">",
  "<=",
  ">=",
  "+",
  "-",
  "*",
  "/",
  "%",
  "&&",
  "||",
  "&",
  "|",
  "^",
  "<<",
  ">>",
  "=>",
  "??",
  "**",
  "<=>"
  ]);
const PREFIX_OPERATORS = new Set(["!", "~"]);
const TIGHT_OPERATORS = new Set(["++", "--", ".", "?.", "::", "->", "->*", ".*"]);

const BASE_DEFAULTS = {
  useTabs: false,
  maxBlankLines: 1,
  finalNewline: true,
  braceStyle: "same-line",
  printWidth: 100,
  quotes: "preserve",
  semicolons: true,
  trailingComma: "none",
  bracketSpacing: true,
  organizeImports: false
};

function nextSignificant(tokens, index) {
  for (let i = index + 1; i < tokens.length; i++) {
    if (tokens[i].type !== "space" && tokens[i].type !== "newline") return tokens[i];
  }
  return null;
}

function prevSignificant(tokens, index) {
  for (let i = index - 1; i >= 0; i--) {
    if (tokens[i].type !== "space" && tokens[i].type !== "newline") return tokens[i];
  }
  return null;
}

function hadNewlineBetween(tokens, a, b) {
  for (let i = a + 1; i < b; i++) if (tokens[i].type === "newline") return true;
  return false;
}

function annotatePairs(tokens) {
  const stack = [];
  const pairs = new Map();
  const openerFor = { ")": "(", "]": "[", "}": "{" };
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if ([
      "string",
      "regex",
      "jsx_tag"
    ].includes(t.type) || t.type.endsWith("comment") || t.type === "preprocessor") continue;
    if (["(", "[", "{"].includes(t.raw)) stack.push({ raw: t.raw, index: i });
    if ([")", "]", "}"].includes(t.raw)) {
      for (let s = stack.length - 1; s >= 0; s--) {
        if (stack[s].raw === openerFor[t.raw]) {
          const open = stack.splice(s, 1)[0];
          pairs.set(open.index, i);
          pairs.set(i, open.index);
          break;
        }
      }
    }
  }
  return pairs;
}

function classifyCurly(tokens, index, language) {
  const prev = prevSignificant(tokens, index);
  if (!prev) return "block";
  if (language === "cpp") return "block";
  if (["=", ":", ",", "(", "[", "return", "retorne", "=>"].includes(prev.raw)) return "object";
  if (prev.raw === "{") return "object";
  return "block";
}

function isUnaryPosition(prev) {
  if (!prev) return true;
  return["(", "[", "{", ",", ":", ";", "="].includes(prev.raw) ||
  (prev.type === "operator" &&!TIGHT_OPERATORS.has(prev.raw));
}

class Emitter {
  constructor(options, eol) {
    this.options = options;
    this.eol = eol;
    this.lines = [];
    this.current = "";
    this.indent = 0;
    this.blankCount = 0;
  }
  indentText() {
    return this.options.useTabs?"\t".repeat(this.indent): " ".repeat(this.indent * this.options.indentSize);
  }
  ensureIndent() {
    if (!this.current) this.current = this.indentText();
  }
  trimEnd() {
    this.current = this.current.replace(/[ \t]+$/g, "");
  }
  space() {
    this.ensureIndent();
    if (!/[ \t]$/.test(this.current)) this.current += " ";
  }
  write(text) {
    if (!text) return;
    this.ensureIndent();
    this.current += text;
    this.blankCount = 0;
  }
  appendToLast(text) {
    if (!text ||!this.lines.length) return;
    this.lines[this.lines.length - 1] = this.lines[this.lines.length - 1].replace(/[ \t]+$/g,
      "") + text;
  }
  newline(forceBlank = false) {
    this.trimEnd();
    if (this.current.trim()) {
      this.lines.push(this.current);
      this.current = "";
      this.blankCount = 0;
      return;
    }
    this.current = "";
    if (forceBlank && this.lines.length && this.blankCount < this.options.maxBlankLines) {
      this.lines.push("");
      this.blankCount++;
    }
  }
  finish(finalNewline) {
    this.trimEnd();
    if (this.current.trim()) this.lines.push(this.current);
    while (this.lines.length && this.lines[this.lines.length - 1] === "") this.lines.pop();
    const out = this.lines.join(this.eol);
    return finalNewline && out?out + this.eol: out;
  }
}

function normalizeStringToken(raw, quoteMode, language) {
  if (!JS_FAMILY.has(language) || quoteMode === "preserve" || raw.startsWith("`")) return raw;
  const target = quoteMode === "single"?"'": quoteMode === "double"?'"': null;
  if (!target ||!["'", '"'].includes(raw[0]) || raw.at(- 1) !== raw[0]) return raw;
  const body = raw.slice(1, - 1);
  // Conservador: só troca quando não cria escapes ambíguos.
  if (body.includes(target) &&!body.includes(`\\${target}`)) return raw;
  const old = raw[0];
  let converted = body.replace(new RegExp(`\\\\${old}`, "g"), old);
  converted = converted.replace(new RegExp(target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"),
    `\\${target}`);
  return target + converted + target;
}

function organizeImportsSafe(source, language) {
  if (!["javascript", "jsx", "typescript", "tsx", "jls"].includes(language)) return source;
  const eol = source.includes("\r\n")?"\r\n": "\n";
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  let start = 0;
  while (start < lines.length &&(!lines[start].trim() || lines[start].trim().startsWith("//") || lines[start].trim().startsWith("/*"))) start++;
  let end = start;
  while (end < lines.length && /^\s*import\b/.test(lines[end])) end++;
  if (end - start < 2) return source;
  const block = lines.slice(start, end);
  // Imports de efeito colateral ficam na posição original.
  const sortable = block.filter(x =>!/^\s*import\s+["']/.test(x)).sort((a, b) => a.localeCompare(b));
  let si = 0;
  const replaced = block.map(x => /^\s*import\s+["']/.test(x)?x: sortable[si++]);
  lines.splice(start, block.length, ...replaced);
  return lines.join(eol);
}

function safeCommaPositions(line) {
  const positions = [];
  let quote = null,
  escaped = false,
  depth = 0;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (quote) {
      if (ch === "\\") escaped = true;
      else if (ch === quote) quote = null;
      continue;
    }
    if (["'", '"', "`"].includes(ch)) {
      quote = ch;
      continue;
    }
    if (["(", "[", "{"].includes(ch)) depth++;
    if ([")", "]", "}"].includes(ch)) depth = Math.max(0, depth - 1);
    if (ch === "," && depth > 0) positions.push(i);
  }
  return positions;
}

function wrapLongLines(text, options) {
  const width = Number(options.printWidth) || 0;
  if (width < 40) return text;
  const eol = text.includes("\r\n")?"\r\n": "\n";
  const result = [];
  for (const line of text.replace(/\r\n/g, "\n").split("\n")) {
    if (line.length <= width || /^\s*(\/\/|#|<|\*)/.test(line)) {
      result.push(line);
      continue;
    }
    const commas = safeCommaPositions(line);
    if (!commas.length) {
      result.push(line);
      continue;
    }
    const lead = line.match(/^\s*/)?.[0] ?? "";
    const continuation = lead +(options.useTabs?"\t": " ".repeat(options.indentSize || 2));
    let rest = line,
    first = true;
    while (rest.length > width) {
      const all = safeCommaPositions(rest);
      if (!all.length) break;
      const under = all.filter(x => x < width);
      const cut =(under.length?under.at(- 1): all[0]) + 1;
      result.push((first?"": continuation) + rest.slice(0, cut).trimEnd());
      rest = rest.slice(cut).trimStart();
      first = false;
    }
    result.push((first?"": continuation) + rest);
  }
  return result.join(eol);
}

export function formatCStyle(source, userOptions = {}, language = "jls") {
  const profile = PROFILES[language] ?? PROFILES.jls;
  const options = { ...BASE_DEFAULTS, indentSize: profile.indentSize, ...userOptions };
  const eol = source.includes("\r\n")?"\r\n": "\n";
  const preparedSource = options.organizeImports?organizeImportsSafe(source, language): source;
  const tokens = tokenize(preparedSource, { language });
  const pairs = annotatePairs(tokens);
  const emitter = new Emitter(options, eol);
  const stack = [];
  let parenDepth = 0;
  let pendingOriginalNewlines = 0;
  let prev = null;
  let tightEqualsAfter = false;

  const containerMultiline =() => stack.some(x => x.multiline);
  const currentParenCtx =() => {
    for (let s = stack.length - 1; s >= 0; s--) if (stack[s].raw === "(") return stack[s];
    return null;
  };
  const currentParenOwner =() => currentParenCtx()?.owner ?? null;
  const consumePendingNewline =() => {
    if (!pendingOriginalNewlines) return;
    const keep = parenDepth === 0 || containerMultiline();
    if (keep && emitter.current.trim()) {
      emitter.newline();
      const pctx = currentParenCtx();
      if (pctx?.multiline &&!pctx.indented) {
        emitter.indent++;
        pctx.indented = true;
      }
    }
    if (keep && pendingOriginalNewlines > 1) emitter.newline(true);
    pendingOriginalNewlines = 0;
  };

  const writeWithSpacing =(curr, index) => {
    const raw = curr.type === "string"?normalizeStringToken(curr.raw, options.quotes,
      language): curr.raw;
    if (!prev ||!emitter.current.trim()) {
      emitter.write(raw);
      tightEqualsAfter = false;
      return;
    }
    if (tightEqualsAfter) {
      emitter.write(raw);
      tightEqualsAfter = false;
      return;
    }

    if (prev.type === "number" && curr.type === "identifier" && prev.end === curr.start) {
      emitter.write(raw);
      return;
    }

    if (profile.tightNamedArgs && raw === "=" && parenDepth > 0 && prev.type === "identifier" &&!new Set([
      "for",
      "para"
    ]).has(currentParenOwner())) {
      emitter.write("=");
      tightEqualsAfter = true;
      return;
    }

    const p = prev.raw;
    if (curr.type === "jsx_tag") {
      emitter.write(raw);
      return;
    }
    if (prev.type === "jsx_tag") {
      if (curr.type === "identifier" &&!/^<\//.test(prev.raw)) emitter.write(raw);
      else emitter.write(raw);
      return;
    }

    if (TIGHT_OPERATORS.has(raw) || TIGHT_OPERATORS.has(p)) {
      emitter.write(raw);
      return;
    }
    if (raw === ")" || raw === "]" || raw === "," || raw === ";" || raw === ":") {
      emitter.write(raw);
      return;
    }
    if (p === "(" || p === "[" || p === "#") {
      emitter.write(raw);
      return;
    }

    if (raw === "#") {
      if (["identifier", "number", "string"].includes(prev.type)) emitter.space();
      emitter.write(raw);
      return;
    }

    if (raw === "(") {
      let control = prev.type === "identifier" && profile.controls.has(prev.raw);
      if (language === "jls" && prev.type === "identifier" && [
        "switch",
        "escolha"
      ].includes(prev.raw)) {
        const close = pairs.get(index);
        const afterClose = close == null?null: nextSignificant(tokens, close);
        control = afterClose?.raw === "{";
      }
      if (control || [
        "return",
        "retorne",
        "throw",
        "yield",
        "await"
      ].includes(prev.raw)) emitter.space();
      emitter.write(raw);
      return;
    }

    if (raw === "[" && prev.raw === "import") {
      emitter.space();
      emitter.write(raw);
      return;
    }

    if (PREFIX_OPERATORS.has(raw) ||(raw === "-" && isUnaryPosition(prev)) ||(raw === "+" && isUnaryPosition(prev))) {
      emitter.write(raw);
      return;
    }

    if (BINARY_OPERATORS.has(raw) || BINARY_OPERATORS.has(p)) {
      emitter.space();
      emitter.write(raw);
      return;
    }
    if (p === ":") {
      emitter.space();
      emitter.write(raw);
      return;
    }

    if ([
      "identifier",
      "number",
      "string",
      "regex"
    ].includes(prev.type) || prev.raw === ")" || prev.raw === "]") {
      if (["identifier", "number", "string", "regex"].includes(curr.type)) emitter.space();
    }
    emitter.write(raw);
  };

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.type === "space") continue;
    if (t.type === "newline") {
      pendingOriginalNewlines++;
      continue;
    }

    const next = nextSignificant(tokens, i);

    // Regra oficial v2.2.0: NUNCA deixar a chave de abertura sozinha na próxima linha.
    if (t.raw === "{" && emitter.current.trim()) pendingOriginalNewlines = 0;
    consumePendingNewline();

    if (t.type === "preprocessor") {
      if (emitter.current.trim()) emitter.newline();
      emitter.write(t.raw.trim());
      emitter.newline();
      pendingOriginalNewlines = 0;
      prev = t;
      continue;
    }

    if (t.type === "line_comment") {
      if (emitter.current.trim()) emitter.space();
      emitter.write(t.raw.trimEnd());
      emitter.newline();
      pendingOriginalNewlines = 0;
      prev = t;
      continue;
    }

    if (t.type === "block_comment") {
      if (emitter.current.trim()) emitter.space();
      const commentLines = t.raw.replace(/\r\n/g, "\n").split("\n");
      for (let c = 0; c < commentLines.length; c++) {
        if (c > 0) emitter.newline();
        emitter.write(commentLines[c].trimEnd());
      }
      if (next) emitter.newline();
      prev = t;
      continue;
    }

    if (t.raw === "(") {
      writeWithSpacing(t, i);
      parenDepth++;
      stack.push({
        raw: "(",
        owner: prev?.raw ?? null,
        multiline: pairs.has(i)?hadNewlineBetween(tokens, i, pairs.get(i)): false
      });
      prev = t;
      continue;
    }
    if (t.raw === ")") {
      emitter.trimEnd();
      let closingParen = null;
      for (let s = stack.length - 1; s >= 0; s--) if (stack[s].raw === "(") {
        closingParen = stack.splice(s, 1)[0];
        break;
      }
      if (closingParen?.indented) emitter.indent = Math.max(0, emitter.indent - 1);
      emitter.write(")");
      parenDepth = Math.max(0, parenDepth - 1);
      prev = t;
      continue;
    }
    if (t.raw === "[") {
      writeWithSpacing(t, i);
      const close = pairs.get(i);
      const multiline = close != null && hadNewlineBetween(tokens, i, close);
      stack.push({ raw: "[", multiline });
      if (multiline && next?.raw !== "]") {
        emitter.indent++;
        emitter.newline();
      }
      prev = t;
      continue;
    }
    if (t.raw === "]") {
      const ctxIndex = [...stack].map(x => x.raw).lastIndexOf("[");
      const ctx = ctxIndex >= 0?stack.splice(ctxIndex, 1)[0]: { multiline: false };
      if (ctx.multiline) {
        if (options.trailingComma !== "none" && [
          "jls",
          "javascript",
          "jsx",
          "typescript",
          "tsx"
        ].includes(language)) {
          if (emitter.current.trim() &&!emitter.current.trimEnd().endsWith(",")) emitter.write(",");
          else if (!emitter.current.trim() && emitter.lines.length &&!emitter.lines.at(- 1).trimEnd().endsWith(",")) emitter.appendToLast(",");
        }
        if (emitter.current.trim()) emitter.newline();
        emitter.indent = Math.max(0, emitter.indent - 1);
      }
      emitter.trimEnd();
      emitter.write("]");
      prev = t;
      continue;
    }
    if (t.raw === "{") {
      const kind = classifyCurly(tokens, i, language);
      const close = pairs.get(i);
      const originalMultiline = close != null && hadNewlineBetween(tokens, i, close);
      const multiline = kind === "block" || originalMultiline;
      if (emitter.current.trim() && prev?.raw !== "(" &&!/[ \t]$/.test(emitter.current)) emitter.space();
      emitter.write("{");
      stack.push({ raw: "{", kind, multiline });
      if (multiline && next?.raw !== "}") {
        emitter.indent++;
        emitter.newline();
      }
      else if (kind === "object" && next?.raw !== "}" && options.bracketSpacing !== false) emitter.space();
      prev = t;
      continue;
    }
    if (t.raw === "}") {
      let ctxIndex =- 1;
      for (let s = stack.length - 1; s >= 0; s--) if (stack[s].raw === "{") {
        ctxIndex = s;
        break;
      }
      const ctx = ctxIndex >= 0?stack.splice(ctxIndex, 1)[0]: { kind: "block", multiline: true };
      if (ctx.multiline) {
        if (ctx.kind === "object" && options.trailingComma !== "none" && [
          "jls",
          "javascript",
          "jsx",
          "typescript",
          "tsx"
        ].includes(language)) {
          if (emitter.current.trim() &&!emitter.current.trimEnd().endsWith(",")) emitter.write(",");
          else if (!emitter.current.trim() && emitter.lines.length &&!emitter.lines.at(- 1).trimEnd().endsWith(",")) emitter.appendToLast(",");
        }
        if (emitter.current.trim()) emitter.newline();
        emitter.indent = Math.max(0, emitter.indent - 1);
        emitter.write("}");
      } else {
        emitter.trimEnd();
        if (!emitter.current.endsWith("{") && options.bracketSpacing !== false) emitter.space();
        emitter.write("}");
      }
      if (next && profile.continuations.has(next.raw)) emitter.space();
      else if (ctx.kind === "block" && next &&![
        ")",
        "]",
        ",",
        ";",
        ".",
        "?.",
        "::",
        "->"
      ].includes(next.raw)) emitter.newline();
      prev = t;
      continue;
    }
    if (t.raw === ",") {
      emitter.trimEnd();
      emitter.write(",");
      const top = stack[stack.length - 1];
      if (top?.multiline && top.raw !== "(") emitter.newline();
      else emitter.space();
      prev = t;
      continue;
    }
    if (t.raw === ";") {
      emitter.trimEnd();
      const omit = JS_FAMILY.has(language) && options.semicolons === false && parenDepth === 0;
      if (!omit) emitter.write(";");
      if (parenDepth > 0) emitter.space();
      else emitter.newline();
      prev = t;
      continue;
    }
    if (t.raw === ":") {
      emitter.trimEnd();
      emitter.write(":");
      emitter.space();
      prev = t;
      continue;
    }
    if (profile.continuations.has(t.raw) && prev?.raw === "}") {
      emitter.write(t.raw);
      prev = t;
      continue;
    }

    writeWithSpacing(t, i);
    prev = t;
  }

  return wrapLongLines(emitter.finish(options.finalNewline), options);
}

export function formatCode(source, userOptions = {}, filePath = "main.jls") {
  const options = { ...userOptions };
  if (!(Number.isInteger(options.indentSize) && options.indentSize > 0)) delete options.indentSize;
  const language = options.language ?? detectLanguage(filePath);
  const plugin = getPlugin(filePath, language);
  if (plugin) return plugin.format(source, { ...options, language, filePath });
  if (language === "python") return formatPython(source, options);
  if (language === "html") return formatHTML(source, options);
  if (language === "css") return formatCSS(source, options);
  if (language === "json") return formatJSON(source, options, false);
  if (language === "jsonc") return formatJSON(source, options, true);
  if (language === "markdown") return formatMarkdown(source, options);
  if (language === "yaml") return formatYAML(source, options);
  if (language === "xml") return formatXML(source, options);
  if (language === "sql") return formatSQL(source, options);
  return formatCStyle(source, options, language);
}

export function formatRange(source, start, end, userOptions = {}, filePath = "main.jls") {
  const eol = source.includes("\r\n")?"\r\n": "\n";
  const lineStart = source.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
  let lineEnd = source.indexOf("\n", end);
  if (lineEnd < 0) lineEnd = source.length;
  else lineEnd += 1;
  const before = source.slice(0, lineStart);
  const selected = source.slice(lineStart, lineEnd);
  const after = source.slice(lineEnd);
  const base = selected.match(/^[ \t]*/)?.[0] ?? "";
  const formatted = formatCode(selected, { ...userOptions, finalNewline: false }, filePath)
  .replace(/\r\n/g, "\n").split("\n")
  .map((line, i) => i === 0 ||!line?line: base + line).join(eol);
  return {
    start: lineStart,
    end: lineEnd,
    text: formatted,
    result: before + formatted +(lineEnd < source.length &&!formatted.endsWith(eol)?eol: "") + after
  };
}

export function formatJLScript(source, userOptions = {}) {
  return formatCStyle(source, userOptions, "jls");
}
export const formatterDefaults = { ...BASE_DEFAULTS };
