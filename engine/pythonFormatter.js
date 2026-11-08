const DEFAULTS = {
  indentSize: 4,
  useTabs: false,
  maxBlankLines: 1,
  finalNewline: true
};

function gcd(a, b) {
  while (b)[a, b] = [b, a % b];
  return a;
}

function indentWidth(text) {
  let width = 0;
  for (const ch of text) width += ch === "\t"?4: 1;
  return width;
}

function splitComment(line) {
  let quote = null;
  let escaped = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\" && quote) {
      escaped = true;
      continue;
    }
    if (quote) {
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      continue;
    }
    if (ch === "#") return[line.slice(0, i), line.slice(i)];
  }
  return[line, ""];
}

function normalizeCode(code) {
  // Conservador: corrige vírgulas e espaços externos sem reescrever expressões.
  let out = "";
  let quote = null;
  let escaped = false;
  let pendingSpace = false;

  for (let i = 0; i < code.length; i++) {
    const ch = code[i];
    if (escaped) {
      out += ch;
      escaped = false;
      continue;
    }
    if (quote) {
      out += ch;
      if (ch === "\\") escaped = true;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"') {
      if (pendingSpace && out &&!/[\s([{.]$/.test(out)) out += " ";
      pendingSpace = false;
      quote = ch;
      out += ch;
      continue;
    }
    if (/\s/.test(ch)) {
      pendingSpace = true;
      continue;
    }
    if (ch === ",") {
      out = out.replace(/[ \t]+$/g, "") + ", ";
      pendingSpace = false;
      continue;
    }
    if ([")", "]", "}"].includes(ch)) {
      out = out.replace(/[ \t]+$/g, "") + ch;
      pendingSpace = false;
      continue;
    }
    if (["(", "[", "{"].includes(ch)) {
      if (pendingSpace && out && /[A-Za-z0-9_)]$/.test(out) && ch === "(") {
        // def/if/while precisam espaço antes de (, chamadas não.
        const word = out.match(/([A-Za-z_][A-Za-z0-9_]*)$/)?.[1] ?? "";
        if (["if", "elif", "while", "for", "with", "except", "assert"].includes(word)) out += " ";
      }
      out += ch;
      pendingSpace = false;
      continue;
    }
    if (ch === ":") {
      out = out.replace(/[ \t]+$/g, "") + ":";
      pendingSpace = false;
      continue;
    }

    const two = code.slice(i, i + 2);
    const multiOps = new Set([
      "==",
      "!=",
      "<=",
      ">=",
      "+=",
      "-=",
      "*=",
      "/=",
      "%=",
      "//=",
      "**",
      "//",
      ":="
    ]);
    let op = multiOps.has(two)?two: ([
      "=",
      "+",
      "-",
      "*",
      "/",
      "%",
      "<",
      ">",
      "|",
      "&",
      "^"
    ].includes(ch)?ch: null);
    if (op) {
      const prevCh = out.replace(/[ \t]+$/g, "").slice(- 1);
      let j = i + op.length;
      while (/\s/.test(code[j] ?? "")) j++;
      const nextCh = code[j] ?? "";
      const binary = /[A-Za-z0-9_\])}]/.test(prevCh) && /[A-Za-z0-9_\[({"']/.test(nextCh);
      if (binary || [
        "=",
        "==",
        "!=",
        "<=",
        ">=",
        "+=",
        "-=",
        "*=",
        "/=",
        "%=",
        "//=",
        ":="
      ].includes(op)) {
        out = out.replace(/[ \t]+$/g, "");
        if (out &&!/\s$/.test(out)) out += " ";
        out += op + " ";
        pendingSpace = false;
        i += op.length - 1;
        continue;
      }
    }

    if (pendingSpace && out &&!/[\s([{.]$/.test(out)) out += " ";
    pendingSpace = false;
    out += ch;
  }
  return out.trimEnd();
}

export function formatPython(source, userOptions = {}) {
  const options = { ...DEFAULTS, ...userOptions };
  const eol = source.includes("\r\n")?"\r\n": "\n";
  const rawLines = source.replace(/\r\n/g, "\n").split("\n");

  const widths = rawLines
  .filter(line => line.trim())
  .map(line => indentWidth(line.match(/^[ \t]*/)?.[0] ?? ""))
  .filter(n => n > 0);
  let unit = widths.length?widths.reduce((a, b) => gcd(a, b)): options.indentSize;
  if (!unit || unit > 8) unit = options.indentSize;

  const indentText = level => options.useTabs?"\t".repeat(level): " ".repeat(level * options.indentSize);
  const out = [];
  let blankCount = 0;
  let inTriple = null;

  for (const original of rawLines) {
    const trailingTrimmed = original.replace(/[ \t]+$/g, "");
    if (!trailingTrimmed.trim()) {
      if (out.length && blankCount < options.maxBlankLines) {
        out.push("");
        blankCount++;
      }
      continue;
    }
    blankCount = 0;

    const lead = trailingTrimmed.match(/^[ \t]*/)?.[0] ?? "";
    const body = trailingTrimmed.slice(lead.length);
    const level = Math.max(0, Math.round(indentWidth(lead) / unit));

    if (inTriple) {
      out.push(indentText(level) + body);
      if (body.includes(inTriple)) inTriple = null;
      continue;
    }

    const triple = body.match(/(?:^|[^\\])("""|''')/);
    if (triple) {
      const marker = triple[1];
      const count = body.split(marker).length - 1;
      if (count % 2 === 1) inTriple = marker;
      out.push(indentText(level) + body);
      continue;
    }

    const[code, comment] = splitComment(body);
    let normalized = normalizeCode(code);
    if (comment) {
      if (normalized) normalized += "  ";
      normalized += comment.trimEnd();
    }
    out.push(indentText(level) + normalized);
  }

  while (out.length && out[out.length - 1] === "") out.pop();
  const result = out.join(eol);
  return options.finalNewline && result?result + eol: result;
}
