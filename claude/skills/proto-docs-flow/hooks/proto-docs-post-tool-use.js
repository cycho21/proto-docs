#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function run(command, args, options = {}) {
  return spawnSync(command, args, { cwd: process.cwd(), encoding: 'utf8', ...options });
}

function printResult(result) {
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
}

function reminder(title, lines) {
  console.error(`\n[PROTO DOCS REMINDER] ${title}`);
  for (const line of lines) console.error(`- ${line}`);
  console.error('');
}

function parseEvent(raw) {
  try {
    return raw.trim() ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function protoPathFrom(event) {
  const toolInput = event.tool_input ?? event.toolInput ?? {};
  return toolInput.file_path ?? toolInput.path;
}

function gitRoot() {
  const result = run('git', ['rev-parse', '--show-toplevel']);
  if ((result.status ?? 0) !== 0) return process.cwd();
  return result.stdout.trim();
}

function repoPaths(filePath) {
  const root = gitRoot();
  const absolute = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
  const relative = path.relative(root, absolute).replace(/\\/g, '/');
  return { absolute, relative };
}

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  const event = parseEvent(input);
  const filePath = protoPathFrom(event);
  if (!filePath || !filePath.endsWith('.proto')) process.exit(0);
  const paths = repoPaths(filePath);

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const skillDir = path.resolve(__dirname, '..');
  const cli = path.join(skillDir, 'scripts/proto-docs/src/cli.ts');
  const dictionary = path.join(skillDir, 'dictionary/word-dictionary.json');

  const lint = run(process.execPath, [cli, 'lint-comments', '--proto', paths.absolute, '--dictionary', dictionary]);
  printResult(lint);
  if ((lint.status ?? 0) !== 0) {
    reminder('Dictionary-backed comment validation failed.', [
      'Do not invent Proto comments.',
      'Lookup order is Message.field first, then field.',
      'If both mappings are missing, stop and ask the user/domain owner for meaning or create a candidate.',
      'If a mapping exists, use exactly canonical_description or an approved example.'
    ]);
    process.exit(lint.status ?? 1);
  }

  const tracked = run('git', ['ls-files', '--error-unmatch', paths.relative]);
  if ((tracked.status ?? 0) !== 0) {
    reminder('AST guard cannot run for an untracked Proto file.', [
      'Do not treat this hook pass as approval.',
      'Add an explicit baseline or track the file before making Proto documentation changes.',
      'Only comments may change; never change message, field, service, RPC, option, or field numbers.'
    ]);
    process.exit(1);
  }

  const before = run('git', ['show', `HEAD:${paths.relative}`]);
  if ((before.status ?? 0) !== 0) {
    reminder('AST guard could not read the HEAD baseline.', [
      'Do not continue until guard-ast can compare against a baseline.',
      'Run guard-ast manually with an explicit --before file if HEAD is not the intended baseline.',
      'Only comments may change.'
    ]);
    process.exit(1);
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'proto-docs-before-'));
  const beforePath = path.join(tempDir, path.basename(filePath));
  fs.writeFileSync(beforePath, before.stdout, 'utf8');

  const ast = run(process.execPath, [cli, 'guard-ast', '--before', beforePath, '--after', paths.absolute]);
  printResult(ast);
  fs.rmSync(tempDir, { recursive: true, force: true });

  if ((ast.status ?? 0) !== 0) {
    reminder('Proto structure changed.', [
      'Revert structural changes immediately.',
      'This workflow permits comment-only edits for Proto documentation.',
      'Do not change fields, numbers, messages, services, RPCs, or options.'
    ]);
    process.exit(ast.status ?? 1);
  }

  process.exit(0);
});
