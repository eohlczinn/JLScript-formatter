import path from "node:path";

export const SUPPORTED_EXTENSIONS = new Set([
  ".jls",
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".py",
  ".cpp",
  ".cc",
  ".cxx",
  ".h",
  ".hpp",
  ".hh",
  ".chh",
  ".html",
  ".htm",
  ".css",
  ".json",
  ".jsonc",
  ".md",
  ".markdown",
  ".yaml",
  ".yml",
  ".xml",
  ".sql"
  ]);

const EXT_TO_LANGUAGE = new Map([
  [".jls", "jls"],
  [".js", "javascript"],
  [".jsx", "jsx"],
  [".ts", "typescript"],
  [".tsx", "tsx"],
  [".py", "python"],
  [".cpp", "cpp"],
  [".cc", "cpp"],
  [".cxx", "cpp"],
  [".h", "cpp"],
  [".hpp", "cpp"],
  [".hh", "cpp"],
  [".chh", "cpp"],
  [".html", "html"],
  [".htm", "html"],
  [".css", "css"],
  [".json", "json"],
  [".jsonc", "jsonc"],
  [".md", "markdown"],
  [".markdown", "markdown"],
  [".yaml", "yaml"],
  [".yml", "yaml"],
  [".xml", "xml"],
  [".sql", "sql"]
  ]);

export function detectLanguage(filePath = "") {
  return EXT_TO_LANGUAGE.get(path.extname(filePath).toLowerCase()) ?? "jls";
}
export function isSupportedFile(filePath) {
  return SUPPORTED_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}
export function supportedExtensionsText() {
  return[...SUPPORTED_EXTENSIONS].join(", ");
}
export const JS_FAMILY = new Set(["javascript", "jsx", "typescript", "tsx"]);
