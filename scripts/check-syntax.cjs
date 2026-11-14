#!/usr/bin/env node
/**
 * Catch TS/TSX syntax errors before Expo/Metro shows a red-screen failure.
 * This uses the project's existing TypeScript dependency and adds no runtime
 * or native dependency. It is a syntax-only check; npm run typecheck also runs.
 */
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const excluded = new Set([
  '.git', '.expo', '.next', '.turbo', 'node_modules', 'dist',
  'build', 'coverage', 'web-build', '.vercel'
]);
const files = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') && !entry.name.endsWith('.ts') && !entry.name.endsWith('.tsx')) continue;
    if (excluded.has(entry.name)) continue;
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(absolute);
    } else if (entry.isFile() && /\.tsx?$/.test(entry.name)) {
      files.push(absolute);
    }
  }
}

walk(root);
let errors = 0;
for (const file of files) {
  const sourceText = fs.readFileSync(file, 'utf8');
  const source = ts.createSourceFile(
    file,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  for (const diagnostic of source.parseDiagnostics) {
    const { line, character } = source.getLineAndCharacterOfPosition(diagnostic.start || 0);
    const relativeFile = path.relative(root, file);
    const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
    console.error(`${relativeFile}:${line + 1}:${character + 1} — ${message}`);
    errors++;
  }
}
if (errors) {
  console.error(`Syntax check failed: ${errors} error(s) in ${files.length} TS/TSX files.`);
  process.exitCode = 1;
} else {
  console.log(`Syntax check passed: ${files.length} TS/TSX files parsed cleanly.`);
}
