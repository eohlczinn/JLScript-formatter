const DEFAULTS = {
  indentSize: 2,
  useTabs: false,
  maxBlankLines: 1,
  finalNewline: true
};

export function formatCSS(source, userOptions = {}) {
  const options = { ...DEFAULTS, ...userOptions };
  const eol = source.includes("\r\n")?"\r\n": "\n";
  const indentText = n => options.useTabs?"\t".repeat(n): " ".repeat(n * options.indentSize);
  const lines = [];
  let current = "";
  let indent = 0;
  let quote = null;
  let escaped = false;
  let inComment = false;
  let pendingSpace = false;

  const trimEnd =() => {
    current = current.replace(/[ \t]+$/g, "");
  };
  const write = text => {
    if (!current) current = indentText(indent);
    current += text;
  };
  const space =() => {
    if (!current) current = indentText(indent);
    if (!/[ \t]$/.test(current)) current += " ";
  };
  const newline =() => {
    trimEnd();
    if (current.trim()) lines.push(current);
    current = "";
    pendingSpace = false;
  };

  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    const next = source[i + 1];

    if (inComment) {
      write(ch);
      if (ch === "*" && next === "/") {
        write("/");
        i++;
        inComment = false;
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
    if (ch === "/" && next === "*") {
      if (current.trim()) space();
      write("/*");
      i++;
      inComment = true;
      continue;
    }
    if (ch === '"' || ch === "'") {
      if (pendingSpace && current.trim()) space();
      pendingSpace = false;
      quote = ch;
      write(ch);
      continue;
    }
    if (/\s/.test(ch)) {
      pendingSpace = true;
      continue;
    }
    if (ch === "{") {
      trimEnd();
      if (current.trim()) space();
      write("{");
      newline();
      indent++;
      continue;
    }
    if (ch === "}") {
      if (current.trim()) newline();
      indent = Math.max(0, indent - 1);
      write("}");
      // Fecha bloco sempre em linha própria.
      newline();
      continue;
    }
    if (ch === ";") {
      trimEnd();
      write(";");
      newline();
      continue;
    }
    if (ch === ":") {
      trimEnd();
      write(":");
      if (indent > 0) space();
      continue;
    }
    if (ch === ",") {
      trimEnd();
      write(",");
      space();
      continue;
    }

    if (pendingSpace && current.trim() &&!/[>+~(]/.test(ch)) space();
    pendingSpace = false;
    write(ch);
  }

  if (current.trim()) newline();
  while (lines.length && lines[lines.length - 1] === "") lines.pop();
  const result = lines.join(eol);
  return options.finalNewline && result?result + eol: result;
}
