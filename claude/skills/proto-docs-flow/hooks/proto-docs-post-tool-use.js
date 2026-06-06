#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  let event;
  try {
    event = input.trim() ? JSON.parse(input) : {};
  } catch {
    process.exit(0);
  }

  const toolInput = event.tool_input ?? event.toolInput ?? {};
  const filePath = toolInput.file_path ?? toolInput.path;
  if (!filePath || !filePath.endsWith('.proto')) process.exit(0);

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const skillDir = path.resolve(__dirname, '..');
  const cli = path.join(skillDir, 'scripts/proto-docs/src/cli.ts');
  const dictionary = path.join(skillDir, 'dictionary/word-dictionary.json');

  const result = spawnSync(process.execPath, [cli, 'lint-comments', '--proto', filePath, '--dictionary', dictionary], {
    cwd: process.cwd(),
    encoding: 'utf8'
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  process.exit(result.status ?? 0);
});
