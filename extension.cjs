const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
let enginePromise;
let statusBar;
let formatOnSaveDisposable;

const SUPPORTED_EXTS = new Set([".jls",".js",".jsx",".ts",".tsx",".py",".cpp",".cc",".cxx",".h",".hpp",".hh",".chh",".html",".htm",".css",".json",".jsonc",".md",".markdown",".yaml",".yml",".xml",".sql"]);
const SUPPORTED_LANGUAGE_IDS = new Set(["jlscript","jls","javascript","javascriptreact","typescript","typescriptreact","python","cpp","c","html","css","json","jsonc","markdown","yaml","xml","sql"]);
function isSupported(document) { return !!document && (SUPPORTED_LANGUAGE_IDS.has(document.languageId) || SUPPORTED_EXTS.has(path.extname(document.fileName).toLowerCase())); }
function fullDocumentRange(document) { const last = document.lineAt(document.lineCount - 1); return new vscode.Range(new vscode.Position(0,0), last.range.end); }

async function loadEngine(context) {
  if (!enginePromise) {
    const u = name => pathToFileURL(path.join(context.extensionPath, "engine", name)).href;
    enginePromise = Promise.all([import(u("formatter.js")), import(u("config.js")), import(u("files.js")), import(u("plugins.js"))]).then(([formatter, config, files, plugins]) => ({
      formatCode: formatter.formatCode,
      formatRange: formatter.formatRange,
      loadConfig: config.loadConfig,
      resolveOptions: config.resolveOptions,
      collectSupportedFiles: files.collectSupportedFiles,
      loadPlugins: plugins.loadPlugins
    }));
  }
  return enginePromise;
}

function editorOverrides(document) {
  const cfg = vscode.workspace.getConfiguration("jlsFormatter", document.uri);
  const options = {
    useTabs: cfg.get("useTabs", false), maxBlankLines: cfg.get("maxBlankLines", 1), finalNewline: cfg.get("finalNewline", true),
    printWidth: cfg.get("printWidth", 100), quotes: cfg.get("quotes", "preserve"), semicolons: cfg.get("semicolons", true),
    trailingComma: cfg.get("trailingComma", "none"), bracketSpacing: cfg.get("bracketSpacing", true), organizeImports: cfg.get("organizeImports", false)
  };
  const indent = cfg.get("indentSize", 0); if (Number.isInteger(indent) && indent > 0) options.indentSize = indent;
  return options;
}

async function optionsFor(context, document) {
  const { loadConfig, resolveOptions, loadPlugins } = await loadEngine(context);
  try {
    const config = loadConfig(document.fileName);
    if (Array.isArray(config.plugins) && config.plugins.length) loadPlugins(config.plugins, config.__configPath ? path.dirname(config.__configPath) : path.dirname(document.fileName));
    return resolveOptions({ ...editorOverrides(document), ...config, languages: config.languages ?? {} }, document.fileName);
  }
  catch (e) { console.warn("[JLScript Formatter] config inválida:", e.message); return editorOverrides(document); }
}

async function formatText(context, document, text, overrides = {}) {
  const { formatCode } = await loadEngine(context);
  return formatCode(text, { ...(await optionsFor(context, document)), ...overrides }, document.fileName);
}

async function formatDocument(context, editor = vscode.window.activeTextEditor) {
  if (!editor || !isSupported(editor.document)) return false;
  if (!vscode.workspace.getConfiguration("jlsFormatter", editor.document.uri).get("enable", true)) return false;
  const before = editor.document.getText(); const after = await formatText(context, editor.document, before);
  if (before === after) { flashStatus("$(check) JLSFmt: já formatado"); return true; }
  await editor.edit(edit => edit.replace(fullDocumentRange(editor.document), after)); flashStatus("$(check) JLSFmt: formatado"); return true;
}

async function formatSelection(context, editor = vscode.window.activeTextEditor) {
  if (!editor || !isSupported(editor.document)) return false;
  if (editor.selection.isEmpty) return formatDocument(context, editor);
  const { formatRange } = await loadEngine(context);
  const source = editor.document.getText(); const options = await optionsFor(context, editor.document);
  const result = formatRange(source, editor.document.offsetAt(editor.selection.start), editor.document.offsetAt(editor.selection.end), options, editor.document.fileName);
  const start = editor.document.positionAt(result.start), end = editor.document.positionAt(result.end);
  await editor.edit(edit => edit.replace(new vscode.Range(start, end), result.text)); flashStatus("$(check) JLSFmt: seleção formatada"); return true;
}

async function preview(context) {
  const editor = vscode.window.activeTextEditor;
  if (!editor || !isSupported(editor.document)) return;
  const before = editor.document.getText(); const after = await formatText(context, editor.document, before);
  if (before === after) return vscode.window.showInformationMessage("JLScript Formatter: arquivo já está formatado.");
  const previewDoc = await vscode.workspace.openTextDocument({ content: after, language: editor.document.languageId });
  await vscode.commands.executeCommand("vscode.diff", editor.document.uri, previewDoc.uri, `JLSFmt Preview • ${path.basename(editor.document.fileName)}`);
}

async function formatWorkspace(context) {
  if (!vscode.workspace.workspaceFolders?.length) return vscode.window.showWarningMessage("Abra uma pasta/projeto antes de formatar o workspace.");
  const { collectSupportedFiles } = await loadEngine(context); let total = 0, changed = 0;
  await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: "JLScript Formatter 3.2.0", cancellable: true }, async (progress, token) => {
    const all = vscode.workspace.workspaceFolders.flatMap(folder => collectSupportedFiles(folder.uri.fsPath)); total = all.length;
    for (let i = 0; i < all.length; i++) {
      if (token.isCancellationRequested) break;
      const file = all[i]; progress.report({ message: path.basename(file), increment: 100 / Math.max(total, 1) });
      const document = await vscode.workspace.openTextDocument(file); const before = document.getText(); const after = await formatText(context, document, before);
      if (before === after) continue;
      const edit = new vscode.WorkspaceEdit(); edit.replace(document.uri, fullDocumentRange(document), after); await vscode.workspace.applyEdit(edit); await document.save(); changed++;
    }
  });
  vscode.window.showInformationMessage(`JLScript Formatter: ${changed} arquivo(s) formatado(s) de ${total}.`);
}

async function toggleFormatOnSave() { const cfg = vscode.workspace.getConfiguration("jlsFormatter"); const current = cfg.get("formatOnSave", false); await cfg.update("formatOnSave", !current, vscode.ConfigurationTarget.Workspace); vscode.window.showInformationMessage(`JLScript Formatter: formatar ao salvar ${!current ? "ativado" : "desativado"}.`); }
async function createConfig() {
  const folder = vscode.workspace.workspaceFolders?.[0]; if (!folder) return vscode.window.showWarningMessage("Abra uma pasta/projeto antes de criar .jlsfmt.json.");
  const file = path.join(folder.uri.fsPath, ".jlsfmt.json");
  if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify({ printWidth:100, quotes:"preserve", semicolons:true, trailingComma:"none", bracketSpacing:true, organizeImports:false, languages:{ javascript:{indentSize:2}, typescript:{indentSize:2}, jls:{indentSize:4}, python:{indentSize:4}, cpp:{indentSize:4}, json:{indentSize:2} } }, null, 2) + "\n");
  const doc = await vscode.workspace.openTextDocument(file); await vscode.window.showTextDocument(doc);
}
async function createIgnore() {
  const folder = vscode.workspace.workspaceFolders?.[0]; if (!folder) return vscode.window.showWarningMessage("Abra uma pasta/projeto antes de criar .jlsfmtignore.");
  const file = path.join(folder.uri.fsPath, ".jlsfmtignore");
  if (!fs.existsSync(file)) fs.writeFileSync(file, ["node_modules/","dist/","build/","coverage/","vendor/","*.min.js","*.min.css",""] .join("\n"));
  const doc = await vscode.workspace.openTextDocument(file); await vscode.window.showTextDocument(doc);
}
function flashStatus(text) { if (!statusBar) return; statusBar.text = text; setTimeout(() => { if (statusBar) statusBar.text = "$(symbol-method) JLSFmt"; }, 1400); }
function updateStatusBar() { if (!statusBar) return; const editor = vscode.window.activeTextEditor; if (editor && isSupported(editor.document) && vscode.workspace.getConfiguration("jlsFormatter", editor.document.uri).get("statusBar", true)) statusBar.show(); else statusBar.hide(); }
function registerFormatOnSave(context) {
  if (formatOnSaveDisposable) formatOnSaveDisposable.dispose();
  formatOnSaveDisposable = vscode.workspace.onWillSaveTextDocument(event => {
    const document = event.document; if (!isSupported(document)) return;
    const cfg = vscode.workspace.getConfiguration("jlsFormatter", document.uri); if (!cfg.get("enable", true) || !cfg.get("formatOnSave", false)) return;
    event.waitUntil((async () => { const before = document.getText(); const after = await formatText(context, document, before); return before === after ? [] : [vscode.TextEdit.replace(fullDocumentRange(document), after)]; })());
  });
  context.subscriptions.push(formatOnSaveDisposable);
}

async function activate(context) {
  const selector = [...SUPPORTED_LANGUAGE_IDS].map(language => ({ language }));
  for (const ext of SUPPORTED_EXTS) selector.push({ scheme: "file", pattern: `**/*${ext}` });
  context.subscriptions.push(
    vscode.languages.registerDocumentFormattingEditProvider(selector, { provideDocumentFormattingEdits: async document => { if (!vscode.workspace.getConfiguration("jlsFormatter", document.uri).get("enable", true)) return []; const before = document.getText(); const after = await formatText(context, document, before); return before === after ? [] : [vscode.TextEdit.replace(fullDocumentRange(document), after)]; } }),
    vscode.languages.registerDocumentRangeFormattingEditProvider(selector, { provideDocumentRangeFormattingEdits: async (document, range) => { const { formatRange } = await loadEngine(context); const source = document.getText(); const result = formatRange(source, document.offsetAt(range.start), document.offsetAt(range.end), await optionsFor(context, document), document.fileName); return [vscode.TextEdit.replace(new vscode.Range(document.positionAt(result.start), document.positionAt(result.end)), result.text)]; } }),
    vscode.commands.registerCommand("jlsFormatter.formatDocument", () => formatDocument(context)),
    vscode.commands.registerCommand("jlsFormatter.formatSelection", () => formatSelection(context)),
    vscode.commands.registerCommand("jlsFormatter.formatWorkspace", () => formatWorkspace(context)),
    vscode.commands.registerCommand("jlsFormatter.preview", () => preview(context)),
    vscode.commands.registerCommand("jlsFormatter.toggleFormatOnSave", toggleFormatOnSave),
    vscode.commands.registerCommand("jlsFormatter.createConfig", createConfig),
    vscode.commands.registerCommand("jlsFormatter.createIgnore", createIgnore)
  );
  statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 90); statusBar.text = "$(symbol-method) JLSFmt"; statusBar.tooltip = "JLScript Formatter 3.2.0 • clique para formatar"; statusBar.command = "jlsFormatter.formatDocument"; context.subscriptions.push(statusBar);
  registerFormatOnSave(context); context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(updateStatusBar), vscode.workspace.onDidChangeConfiguration(e => { if (e.affectsConfiguration("jlsFormatter")) updateStatusBar(); })); updateStatusBar();
}
function deactivate() {}
module.exports = { activate, deactivate };
