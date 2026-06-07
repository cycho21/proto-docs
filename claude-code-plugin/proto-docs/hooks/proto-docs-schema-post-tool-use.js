#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function pluginRoot() { return process.env.CLAUDE_PLUGIN_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); }
function run(command, args) { return spawnSync(command, args, { cwd: process.cwd(), encoding: 'utf8' }); }
function reminder(title, lines) { console.error(`\n[PROTO DOCS SCHEMA REMINDER] ${title}`); for (const line of lines) console.error(`- ${line}`); console.error(''); }
function parseEvent(raw) { try { return raw.trim() ? JSON.parse(raw) : {}; } catch { return {}; } }
function changedPath(event) { const toolInput = event.tool_input ?? event.toolInput ?? {}; return toolInput.file_path ?? toolInput.path; }

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  const filePath = changedPath(parseEvent(input));
  if (!filePath) process.exit(0);
  const normalized = String(filePath).replace(/\\/g, '/');
  if (!normalized.endsWith('/.proto-docs/dictionary/word-dictionary.schema.json') &&
      !normalized.endsWith('/.proto-docs/dictionary/word-dictionary.json') &&
      !normalized.startsWith('.proto-docs/dictionary/word-dictionary')) process.exit(0);

  const dictionaryPath = path.join('.proto-docs', 'dictionary', 'word-dictionary.json');
  if (!fs.existsSync(dictionaryPath)) process.exit(0);
  const manager = path.join(pluginRoot(), 'skills/proto-docs-dictionary/scripts/dictionary-manager.js');
  const validate = run(process.execPath, [manager, 'validate', '--dictionary', dictionaryPath]);
  if (validate.stdout) process.stdout.write(validate.stdout);
  if (validate.stderr) process.stderr.write(validate.stderr);
  if ((validate.status ?? 0) !== 0) {
    reminder('Dictionary does not conform to the approved schema contract.', [
      'Fix .proto-docs/dictionary/word-dictionary.json before using it to annotate Proto comments.',
      'Do not relax the schema to make invalid Dictionary entries pass.'
    ]);
    process.exit(validate.status ?? 1);
  }
});
