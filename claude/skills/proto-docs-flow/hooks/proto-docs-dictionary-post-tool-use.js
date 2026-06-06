#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function reminder(title, lines) {
  console.error(`\n[PROTO DOCS DICTIONARY REMINDER] ${title}`);
  for (const line of lines) console.error(`- ${line}`);
  console.error('');
}

function run(command, args) {
  return spawnSync(command, args, { cwd: process.cwd(), encoding: 'utf8' });
}

function parseEvent(raw) {
  try {
    return raw.trim() ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function changedPath(event) {
  const toolInput = event.tool_input ?? event.toolInput ?? {};
  return toolInput.file_path ?? toolInput.path;
}

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  const event = parseEvent(input);
  const filePath = changedPath(event);
  if (!filePath) process.exit(0);

  const normalized = filePath.replace(/\\/g, '/');
  if (!normalized.endsWith('/dictionary/word-dictionary.json') && !normalized.endsWith('/dictionary/word-dictionary.sha256')) {
    process.exit(0);
  }

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const flowSkillDir = path.resolve(__dirname, '..');
  const manager = path.resolve(flowSkillDir, '../proto-docs-dictionary/scripts/dictionary-manager.js');
  const dictionary = path.join(flowSkillDir, 'dictionary/word-dictionary.json');
  const hashPath = path.join(flowSkillDir, 'dictionary/word-dictionary.sha256');

  const validate = run(process.execPath, [manager, 'validate', '--dictionary', dictionary]);
  if (validate.stdout) process.stdout.write(validate.stdout);
  if (validate.stderr) process.stderr.write(validate.stderr);
  if ((validate.status ?? 0) !== 0) {
    reminder('Approved Dictionary validation failed.', [
      'Fix the JSON/schema before continuing.',
      'Use field-level entries for shared semantics and Message.field only for overrides.',
      'Do not use unapproved candidate entries as approved Dictionary entries.'
    ]);
    process.exit(validate.status ?? 1);
  }

  if (!fs.existsSync(hashPath)) {
    reminder('Dictionary baseline hash is missing.', [
      'After approval, run dictionary-manager hash --approval-manifest <path> to regenerate word-dictionary.sha256.',
      'Do not report completion until validate and hash checks pass.'
    ]);
    process.exit(1);
  }

  const expected = fs.readFileSync(hashPath, 'utf8').trim();
  const actual = sha256(dictionary);
  if (expected !== actual) {
    reminder('Dictionary hash does not match the approved Dictionary.', [
      'If this Dictionary change is approved, update word-dictionary.sha256 with dictionary-manager hash --approval-manifest <path>.',
      'If approval is missing, revert the approved Dictionary change and create a candidate instead.',
      'Do not ask for step-by-step permission; either repair the evidence/hash or stop and ask the user for the missing domain meaning.'
    ]);
    process.exit(1);
  }

  process.exit(0);
});
