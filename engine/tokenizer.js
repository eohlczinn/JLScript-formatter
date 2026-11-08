const MULTI_OPERATORS = [
  "<=>",
  "->*",
  "...",
  "===",
  "!==",
  "<<=",
  ">>=",
  "**=",
  "??=",
  "&&=",
  "||=",
  "++",
  "--",
  "+=",
  "-=",
  "*=",
  "/=",
  "%=",
  "==",
  "!=",
  "<=",
  ">=",
  "<<",
  ">>",
  "&&",
  "||",
  "=>",
  "**",
  "??",
  "?.",
  "::",
  "->",
  ".*"
].sort((a, b) => b.length - a.length);

const SINGLE = new Set("+-*/%=!<>&|^(){}[],.;:#?");

function isIdentStart(ch) {
  return /[A-Za-z_À-ÿ$]/u.test(ch ?? "");
}

function isIdentPart(ch) {
  return /[A-Za-z0-9_À-ÿ$]/u.test(ch ?? "");
}

function canStartRegex(prev) {
  if (!prev) return true;
  if ([
    "(",
    "[",
    "{",
    ",",
    ";",
    ":",
    "=",
    "!",
    "?",
    "=>",
    "&&",
    "||",
    "??"
  ].includes(prev.raw)) return true;
  if (prev.type === "operator" &&!["++", "--"].includes(prev.raw)) return true;
  return prev.type === "identifier" && [
    "return",
    "throw",
    "case",
    "delete",
    "typeof",
    "void",
    "new",
    "in",
    "of",
    "yield",
    "await"
  ].includes(prev.raw);
}

function readRegex(source, start) {
  let i = start + 1;
  let escaped = false;
  let inClass = false;
  while (i < source.length) {
    const ch = source[i];
    if (ch === "\n" || ch === "\r") return null;
    if (escaped) {
      escaped = false;
      i++;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      i++;
      continue;
    }
    if (ch === "[") {
      inClass = true;
      i++;
      continue;
    }
    if (ch === "]") {
      inClass = false;
      i++;
      continue;
    }
    if (ch === "/" &&!inClass) {
      i++;
      while (/[A-Za-z]/.test(source[i] ?? "")) i++;
      return i;
    }
    i++;
  }
  return null;
}

function readJsxTag(source, start) {
  if (source[start] !== "<") return null;
  const next = source[start + 1] ?? "";
  if (!(next === "/" || next === ">" || /[A-Za-z]/.test(next))) return null;
  let i = start + 1;
  let quote = null;
  let escaped = false;
  let braceDepth = 0;
  while (i < source.length) {
    const ch = source[i];
    if (escaped) {
      escaped = false;
      i++;
      continue;
    }
    if (quote) {
      if (ch === "\\") escaped = true;
      else if (ch === quote) quote = null;
      i++;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      i++;
      continue;
    }
    if (ch === "{") {
      braceDepth++;
      i++;
      continue;
    }
    if (ch === "}") {
      braceDepth = Math.max(0, braceDepth - 1);
      i++;
      continue;
    }
    if (ch === ">" && braceDepth === 0) return i + 1;
    i++;
  }
  return null;
}

export function tokenize(source, options = {}) {
  const {
    language = "jls"
  }
  = options;
  const tokens = [];
  let i = 0;
  let lineStart = true;
  let prevSignificant = null;

  const push =(type, raw, start = i) => {
    const token = { type, raw, start, end: start + raw.length };
    tokens.push(token);
    if (!["space", "newline"].includes(type)) prevSignificant = token;
    return token;
  };

  while (i < source.length) {
    const start = i;
    const ch = source[i];

    if (ch === "\r" || ch === "\n") {
      if (ch === "\r" && source[i + 1] === "\n") i += 2;
      else i += 1;
      push("newline", source.slice(start, i), start);
      lineStart = true;
      continue;
    }

    if (ch === " " || ch === "\t" || ch === "\f" || ch === "\v") {
      i++;
      while (i < source.length && /[ \t\f\v]/.test(source[i])) i++;
      push("space", source.slice(start, i), start);
      continue;
    }

    if (language === "cpp" && ch === "#" && lineStart) {
      i++;
      while (i < source.length && source[i] !== "\n" && source[i] !== "\r") i++;
      push("preprocessor", source.slice(start, i).trimEnd(), start);
      lineStart = false;
      continue;
    }

    lineStart = false;

    if (ch === "/" && source[i + 1] === "/") {
      i += 2;
      while (i < source.length && source[i] !== "\n" && source[i] !== "\r") i++;
      push("line_comment", source.slice(start, i), start);
      continue;
    }

    if (ch === "/" && source[i + 1] === "*") {
      i += 2;
      while (i < source.length &&!(source[i] === "*" && source[i + 1] === "/")) i++;
      if (i < source.length) i += 2;
      push("block_comment", source.slice(start, i), start);
      continue;
    }

    if ((language === "javascript" || language === "jsx" || language === "typescript" || language === "tsx") && ch === "/" && canStartRegex(prevSignificant)) {
      const end = readRegex(source, i);
      if (end != null) {
        i = end;
        push("regex", source.slice(start, i), start);
        continue;
      }
    }

    if ((language === "jsx" || language === "tsx") && ch === "<") {
      const end = readJsxTag(source, i);
      if (end != null) {
        i = end;
        push("jsx_tag", source.slice(start, i), start);
        continue;
      }
    }

    if (ch === '"' || ch === "'" || ch === "`") {
      const quote = ch;
      i++;
      while (i < source.length) {
        if (source[i] === "\\") {
          i += Math.min(2, source.length - i);
          continue;
        }
        if (source[i] === quote) {
          i++;
          break;
        }
        i++;
      }
      push("string", source.slice(start, i), start);
      continue;
    }

    if (/[0-9]/.test(ch)) {
      i++;
      while (i < source.length && /[0-9_A-Fa-fxXbBoO]/.test(source[i])) i++;
      if (source[i] === "." && /[0-9]/.test(source[i + 1] ?? "")) {
        i++;
        while (i < source.length && /[0-9_]/.test(source[i])) i++;
      }
      push("number", source.slice(start, i), start);
      continue;
    }

    if (isIdentStart(ch)) {
      i++;
      while (i < source.length && isIdentPart(source[i])) i++;
      push("identifier", source.slice(start, i), start);
      continue;
    }

    const multi = MULTI_OPERATORS.find(op => source.startsWith(op, i));
    if (multi) {
      i += multi.length;
      push("operator", multi, start);
      continue;
    }

    if (SINGLE.has(ch)) {
      i++;
      const type = "(){}[],.;:#?".includes(ch)?"punct": "operator";
      push(type, ch, start);
      continue;
    }

    i++;
    push("unknown", ch, start);
  }

  return tokens;
}
