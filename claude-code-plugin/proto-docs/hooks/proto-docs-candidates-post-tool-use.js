#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function pluginRoot() {
  return process.env.CLAUDE_PLUGIN_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
}

function run(command, args) {
  return spawnSync(command, args, { cwd: process.cwd(), encoding: 'utf8' });
}

function reminder(title, lines) {
  console.error(`\n[PROTO DOCS CANDIDATE REMINDER] ${title}`);
  for (const line of lines) console.error(`- ${line}`);
  console.error('');
}

function parseEvent(raw) {
  try { return raw.trim() ? JSON.parse(raw) : {}; } catch { return {}; }
}

function changedPath(event) {
  const toolInput = event.tool_input ?? event.toolInput ?? {};
  return toolInput.file_path ?? toolInput.path;
}

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  const filePath = changedPath(parseEvent(input));
  if (!filePath) process.exit(0);
  const normalized = filePath.replace(/\\/g, '/');
  if (!normalized.includes('/.proto-docs/dictionary/candidates/') && !normalized.startsWith('.proto-docs/dictionary/candidates/')) process.exit(0);

  const candidatesDir = path.join('.proto-docs', 'dictionary', 'candidates');
  if (!fs.existsSync(candidatesDir)) process.exit(0);
  const cli = path.join(pluginRoot(), 'scripts/proto-docs/src/cli.ts');
  const result = run(process.execPath, [cli, 'validate-candidates', '--candidates', candidatesDir]);
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if ((result.status ?? 0) !== 0) {
    reminder('Candidate Dictionary validation failed.', [
      'Fix candidate JSON shape before continuing.',
      'Create .proto-docs/dictionary/candidates/word-dictionary.json first.',
      'Message candidates must live under .proto-docs/dictionary/candidates/messages/<MessageName>.json.'
    ]);
    process.exit(result.status ?? 1);
  }
});
