# JLScript Formatter

<p align="center">
  <img src="./assets/jlscript-formatter-banner.png" alt="JLScript Formatter" width="100%">
</p>

<p align="center">
  <strong>Um formatter rápido, configurável e multi-linguagem do ecossistema JLScript.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-3.2.0-7c3aed?style=for-the-badge" alt="Version">
  <img src="https://img.shields.io/badge/VS%20Code-1.85%2B-007ACC?style=for-the-badge&logo=visualstudiocode&logoColor=white" alt="VS Code">
  <img src="https://img.shields.io/badge/Node.js-18%2B-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/JLScript-Formatter-BD93F9?style=for-the-badge" alt="JLScript Formatter">
</p>

---

## Sobre

**JLScript Formatter** é o formatador oficial do ecossistema JLScript.

Ele foi criado para manter o código consistente sem exigir configuração complicada, funcionando tanto pela linha de comando quanto dentro do Visual Studio Code.

A versão `3.2.0` suporta múltiplas linguagens, configuração por projeto, cache, arquivos ignorados, preview de alterações, formatação de seleção e integração com outros editores por `stdin/stdout`.

Uma das regras visuais principais do formatter é simples:

```js
function somar(a, b) {
  return a + b;
}
```

A chave de abertura permanece na mesma linha da declaração.

O formatter não utiliza este estilo:

```js
function somar(a, b)
{
  return a + b;
}
```

---

## Linguagens suportadas

| Linguagem | Extensões |
| --- | --- |
| JLScript | `.jls` |
| JavaScript | `.js` |
| JSX | `.jsx` |
| TypeScript | `.ts` |
| TSX | `.tsx` |
| Python | `.py` |
| C++ | `.cpp`, `.cc`, `.cxx` |
| Headers | `.h`, `.hpp`, `.hh`, `.chh` |
| HTML | `.html`, `.htm` |
| CSS | `.css` |
| JSON | `.json` |
| JSONC | `.jsonc` |
| Markdown | `.md`, `.markdown` |
| YAML | `.yaml`, `.yml` |
| XML | `.xml` |
| SQL | `.sql` |

---

## Antes e depois

### JavaScript

Antes:

```js
function somar(a,b)
{
return a+b;
}
```

Depois:

```js
function somar(a, b) {
  return a + b;
}
```

### JLScript

Antes:

```jls
func soma(a,b){va resultado=a+b;retorne resultado}
```

Depois:

```jls
func soma(a, b) {
    va resultado = a + b;
    retorne resultado
}
```

### C++

Antes:

```cpp
if(ativo)
{
executar();
}
```

Depois:

```cpp
if (ativo) {
    executar();
}
```

### JSON

Antes:

```json
{"nome":"JLScript","versao":"3.2.0","ativo":true}
```

Depois:

```json
{
  "nome": "JLScript",
  "versao": "3.2.0",
  "ativo": true
}
```

---

## Visual Studio Code

A extensão adiciona integração direta com o VS Code.

### Atalhos

| Atalho | Ação |
| --- | --- |
| `Ctrl + Alt + F` | Formatar documento |
| `Ctrl + K`, `Ctrl + F` | Formatar seleção |
| `Ctrl + Alt + P` | Abrir preview antes/depois |
| `Shift + Alt + F` | Format Document padrão do VS Code |

No macOS:

| Atalho | Ação |
| --- | --- |
| `Cmd + Option + F` | Formatar documento |
| `Cmd + K`, `Cmd + F` | Formatar seleção |
| `Cmd + Option + P` | Preview |

---

## Comandos do VS Code

Abra a Command Palette:

```text
Ctrl + Shift + P
```

Os comandos disponíveis incluem:

```text
JLScript Formatter: Formatar documento
JLScript Formatter: Formatar seleção
JLScript Formatter: Formatar projeto inteiro
JLScript Formatter: Preview antes/depois
JLScript Formatter: Ativar/Desativar formatar ao salvar
JLScript Formatter: Criar .jlsfmt.json
JLScript Formatter: Criar .jlsfmtignore
```

---

## CLI

Depois de instalar o formatter:

```bash
jlsfmt --version
```

Resultado:

```text
3.2.0
```

Formatar um arquivo:

```bash
jlsfmt app.js
```

Formatar um projeto inteiro:

```bash
jlsfmt .
```

Verificar sem modificar:

```bash
jlsfmt . --check
```

Desativar cache:

```bash
jlsfmt . --no-cache
```

Limpar cache:

```bash
jlsfmt . --clear-cache
```

---

## Preview

O JLScript Formatter possui preview antes/depois.

Use:

```text
Ctrl + Alt + P
```

O VS Code abre uma comparação entre:

```text
ORIGINAL  ↔  FORMATADO
```

O arquivo original não é modificado durante o preview.

---

## Format on Save

O formatter pode executar automaticamente ao salvar.

No VS Code:

```text
Ctrl + Shift + P
```

Execute:

```text
JLScript Formatter: Ativar/Desativar formatar ao salvar
```

Ou configure manualmente:

```json
{
  "jlsFormatter.formatOnSave": true
}
```

---

## Configuração

Crie na raiz do projeto:

```text
.jlsfmt.json
```

Exemplo:

```json
{
  "printWidth": 100,
  "quotes": "single",
  "semicolons": true,
  "trailingComma": "multiline",
  "bracketSpacing": true,
  "organizeImports": false,
  "cache": true,

  "languages": {
    "javascript": {
      "indentSize": 2
    },

    "typescript": {
      "indentSize": 2
    },

    "jls": {
      "indentSize": 4
    },

    "python": {
      "indentSize": 4
    },

    "cpp": {
      "indentSize": 4
    },

    "json": {
      "indentSize": 2
    }
  }
}
```

O formatter procura a configuração do projeto subindo a árvore de diretórios.

---

## Arquivos ignorados

Crie:

```text
.jlsfmtignore
```

Exemplo:

```gitignore
node_modules/
dist/
build/
coverage/
vendor/

*.min.js
*.min.css
```

O formatter também evita automaticamente algumas pastas conhecidas de build, cache e dependências.

---

## Opções

### `printWidth`

Define a largura preferida das linhas.

```json
{
  "printWidth": 100
}
```

### `quotes`

Controla as aspas utilizadas em JavaScript, JSX, TypeScript e TSX.

```json
{
  "quotes": "single"
}
```

Valores:

```text
preserve
single
double
```

### `semicolons`

```json
{
  "semicolons": true
}
```

### `trailingComma`

```json
{
  "trailingComma": "multiline"
}
```

Valores:

```text
none
multiline
all
```

### `bracketSpacing`

Com:

```json
{
  "bracketSpacing": true
}
```

o formatter pode gerar:

```js
const usuario = { nome: "Lucas" };
```

### `organizeImports`

```json
{
  "organizeImports": true
}
```

A organização de imports é opcional porque altera mais do que apenas espaçamento visual.

---

## Cache

Arquivos que não foram modificados podem ser ignorados em execuções posteriores.

```bash
jlsfmt .
```

Para ignorar o cache temporariamente:

```bash
jlsfmt . --no-cache
```

Para limpar:

```bash
jlsfmt . --clear-cache
```

---

## Check e diff

O comando:

```bash
jlsfmt . --check
```

não modifica os arquivos.

Quando encontra um arquivo fora do padrão, o formatter pode mostrar diferenças semelhantes a:

```diff
-function teste()
-{
+function teste() {
   return true;
 }
```

Isso permite utilizar o formatter em CI, testes e pipelines de validação.

---

## Formatação por seleção

O JLScript Formatter suporta formatação de apenas uma parte do arquivo.

Selecione o trecho desejado e pressione:

```text
Ctrl + K
Ctrl + F
```

Somente o intervalo selecionado é formatado.

---

## Plugins

O formatter possui uma API básica para adicionar novas linguagens sem modificar o núcleo.

Exemplo:

```js
module.exports = {
  extensions: [".lua"],

  format(source, options) {
    return source;
  }
};
```

Depois registre o plugin:

```json
{
  "plugins": [
    "./tools/jlsfmt-plugin-lua.cjs"
  ]
}
```

Isso abre espaço para extensões futuras como:

```text
jlsfmt-plugin-lua
jlsfmt-plugin-rust
jlsfmt-plugin-java
```

---

## Integração com outros editores

O formatter oferece entrada e saída por `stdin/stdout`.

Isso permite integração futura com:

```text
Visual Studio
Neovim
Sublime Text
Zed
JetBrains IDEs
outros editores
```

A ideia é manter um único motor de formatação.

```text
VS Code ──────────┐
Visual Studio ────┤
Neovim ───────────┼── JLScript Formatter
Sublime ──────────┤
Zed ──────────────┘
```

---

## Arquitetura

```text
JLScript Formatter
│
├── Core
│   ├── detector de linguagem
│   ├── formatter
│   ├── config
│   ├── ignore
│   ├── cache
│   └── plugins
│
├── CLI
│   └── jlsfmt
│
└── VS Code
    ├── Format Document
    ├── Format Selection
    ├── Format Workspace
    ├── Preview
    └── Format on Save
```

---

## Filosofia

O formatter segue alguns princípios simples:

- código previsível;
- configuração pequena;
- resultado idempotente;
- não alterar a lógica do programa;
- preservar strings e comentários;
- evitar transformações agressivas;
- permitir regras diferentes por linguagem;
- manter `{` na mesma linha da declaração;
- funcionar fora do VS Code.

Formatar novamente um arquivo já formatado deve produzir exatamente o mesmo resultado.

---

## JLScript

O JLScript Formatter faz parte do ecossistema **JLScript**, uma linguagem de programação e conjunto de ferramentas voltados para uma experiência de desenvolvimento simples e integrada.

Outros componentes do ecossistema incluem:

```text
JLScript Core
JLShell
JLScript Formatter
JLScript Language Server
JLScript VS Code Extension
JLScript Visual Studio Extension
JLS AI
```

---

## Versão

```text
JLScript Formatter v3.2.0
```

---

## Autor

Desenvolvido como parte do projeto **JLScript / JLScripter**.

---

<p align="center">
  <strong>JLScript Formatter</strong><br>
  Código organizado. Mesma regra. Qualquer editor.
</p>