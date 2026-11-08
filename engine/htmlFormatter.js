const DEFAULTS = {
  indentSize: 2,
  useTabs: false,
  maxBlankLines: 1,
  finalNewline: true
};

const VOID_TAGS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr"
  ]);

function openingTag(line) {
  const m = line.match(/^<([A-Za-z][\w:-]*)(?:\s|>|\/)/);
  return m?.[1]?.toLowerCase() ?? null;
}

function isClosing(line) {
  return /^<\//.test(line);
}

function closesOnSameLine(line, tag) {
  return new RegExp(`<\\/${tag}\\s*>`, "i").test(line);
}

export function formatHTML(source, userOptions = {}) {
  const options = { ...DEFAULTS, ...userOptions };
  const eol = source.includes("\r\n")?"\r\n": "\n";
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const indentText = level => options.useTabs?"\t".repeat(level): " ".repeat(level * options.indentSize);
  const out = [];
  let level = 0;
  let blanks = 0;
  let rawTag = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      if (out.length && blanks < options.maxBlankLines) {
        out.push("");
        blanks++;
      }
      continue;
    }
    blanks = 0;

    if (rawTag) {
      out.push(indentText(level) + line);
      if (new RegExp(`<\\/${rawTag}\\s*>`, "i").test(line)) {
        level = Math.max(0, level - 1);
        rawTag = null;
      }
      continue;
    }

    if (isClosing(line)) level = Math.max(0, level - 1);
    out.push(indentText(level) + line);

    if (/^<!--/.test(line) || /^<!DOCTYPE/i.test(line) || /^<\?/.test(line)) continue;
    const tag = openingTag(line);
    if (!tag || isClosing(line) || VOID_TAGS.has(tag) || /\/\s*>$/.test(line) || closesOnSameLine(line,
      
      tag)) continue;

    level++;
    if (["script", "style", "pre", "textarea"].includes(tag)) rawTag = tag;
  }

  while (out.length && out[out.length - 1] === "") out.pop();
  const result = out.join(eol);
  return options.finalNewline && result?result + eol: result;
}
