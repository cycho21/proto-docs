#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';

function reminder(title, lines) {
  console.error(`\n[PROTO DOCS CANDIDATE REMINDER] ${title}`);
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

function changedPath(event) {
  const toolInput = event.tool_input ?? event.toolInput ?? {};
  return toolInput.file_path ?? toolInput.path;
}

function run(command, args) {
  return spawnSync(command, args, { cwd: process.cwd(), encoding: 'utf8', shell: true });
}

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  const event = parseEvent(input);
  const filePath = changedPath(event);
  if (!filePath) process.exit(0);

  const normalized = filePath.replace(/\\/g, '/');
  if (!normalized.includes('/docs/dictionary/candidates/') && !normalized.startsWith('docs/dictionary/candidates/')) {
    process.exit(0);
  }

  const candidatesDir = path.join('docs', 'dictionary', 'candidates');
  const result = run('npm', ['run', 'proto-docs', '--', 'validate-candidates', '--candidates', candidatesDir]);
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error || (result.status ?? 0) !== 0) {
    reminder('Candidate Dictionary validation failed.', [
      'Fix candidate JSON shape before continuing.',
      'Create the global candidates/word-dictionary.json first.',
      'Message candidates must live under candidates/messages/<MessageName>.json and reference the global word_dictionary scopes.'
    ]);
    if (result.error) console.error(result.error.message);
    process.exit(result.status ?? 1);
  }

  process.exit(0);
});
