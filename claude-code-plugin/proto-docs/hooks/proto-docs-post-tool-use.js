#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function pluginRoot() { return process.env.CLAUDE_PLUGIN_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); }
function run(command, args, options = {}) { return spawnSync(command, args, { cwd: process.cwd(), encoding: 'utf8', ...options }); }
function printResult(result) { if (result.stdout) process.stdout.write(result.stdout); if (result.stderr) process.stderr.write(result.stderr); }
function reminder(title, lines) { console.error(`\n[PROTO DOCS REMINDER] ${title}`); for (const line of lines) console.error(`- ${line}`); console.error(''); }
function parseEvent(raw) { try { return raw.trim() ? JSON.parse(raw) : {}; } catch { return {}; } }
function changedPath(event) { const toolInput = event.tool_input ?? event.toolInput ?? {}; return toolInput.file_path ?? toolInput.path; }
function gitRoot() { const result = run('git', ['rev-parse', '--show-toplevel']); return (result.status ?? 0) === 0 ? result.stdout.trim() : process.cwd(); }
function repoPaths(filePath) { const root = gitRoot(); const absolute = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath); return { absolute, relative: path.relative(root, absolute).replace(/\\/g, '/') }; }

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  const filePath = changedPath(parseEvent(input));
  if (!filePath || !String(filePath).endsWith('.proto')) process.exit(0);

  const dictionary = path.join('docs', 'dictionary', 'word-dictionary.json');
  if (!fs.existsSync(dictionary)) {
    reminder('Project Dictionary is missing.', [
      'Expected docs/dictionary/word-dictionary.json in the target project.',
      'Create/promote approved Dictionary entries before relying on automatic Proto comment validation.'
    ]);
    process.exit(1);
  }

  const cli = path.join(pluginRoot(), 'scripts/proto-docs/src/cli.ts');
  const paths = repoPaths(filePath);
  const lint = run(process.execPath, [cli, 'lint-comments', '--proto', paths.absolute, '--dictionary', dictionary]);
  printResult(lint);
  if ((lint.status ?? 0) !== 0) {
    reminder('Dictionary-backed comment validation failed.', [
      'Do not invent Proto comments.',
      'Lookup order is Message.field first, then field.',
      'If mappings are missing, create candidates or ask the domain owner.',
      'If a mapping exists, use exactly canonical_description or an approved example.'
    ]);
    process.exit(lint.status ?? 1);
  }

  const tracked = run('git', ['ls-files', '--error-unmatch', paths.relative]);
  if ((tracked.status ?? 0) !== 0) process.exit(0);
  const before = run('git', ['show', `HEAD:${paths.relative}`]);
  if ((before.status ?? 0) !== 0) process.exit(0);

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'proto-docs-before-'));
  const beforePath = path.join(tempDir, path.basename(filePath));
  fs.writeFileSync(beforePath, before.stdout, 'utf8');
  const ast = run(process.execPath, [cli, 'guard-ast', '--before', beforePath, '--after', paths.absolute]);
  printResult(ast);
  fs.rmSync(tempDir, { recursive: true, force: true });
  if ((ast.status ?? 0) !== 0) {
    reminder('Proto structure changed.', [
      'Revert structural changes immediately.',
      'This workflow permits comment-only edits for Proto documentation.'
    ]);
    process.exit(ast.status ?? 1);
  }
});
