#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REQUIRED = [
  'term',
  'scope',
  'canonical_description',
  'aliases',
  'forbidden_aliases',
  'allowed_contexts',
  'approved_examples',
  'status',
  'version',
  'owner',
  'last_reviewed_at',
  'visibility'
];

function reminder(title, lines) {
  console.error(`\n[PROTO DOCS SCHEMA REMINDER] ${title}`);
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

function validateSchemaShape(schemaPath) {
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  const entry = schema?.$defs?.dictionaryEntry;
  const required = entry?.required;
  const properties = entry?.properties;
  const issues = [];

  if (schema.type !== 'object') issues.push('schema.type must be object');
  if (!entry || entry.type !== 'object') issues.push('$defs.dictionaryEntry must be an object schema');
  if (entry?.additionalProperties !== false) issues.push('dictionaryEntry.additionalProperties must be false');
  if (!Array.isArray(required)) issues.push('dictionaryEntry.required must be an array');
  if (!properties || typeof properties !== 'object') issues.push('dictionaryEntry.properties must be an object');

  for (const field of REQUIRED) {
    if (!required?.includes(field)) issues.push(`required[] missing ${field}`);
    if (!properties?.[field]) issues.push(`properties missing ${field}`);
  }
  if (properties?.status?.const !== 'approved') issues.push('status.const must be approved');
  if (!Array.isArray(properties?.visibility?.enum) || !properties.visibility.enum.includes('public')) {
    issues.push('visibility.enum must include public/internal/restricted values');
  }
  return issues;
}

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  const event = parseEvent(input);
  const filePath = changedPath(event);
  if (!filePath) process.exit(0);

  const normalized = filePath.replace(/\\/g, '/');
  if (!normalized.endsWith('/dictionary/word-dictionary.schema.json') && !normalized.endsWith('/dictionary/word-dictionary.json')) {
    process.exit(0);
  }

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const flowSkillDir = path.resolve(__dirname, '..');
  const manager = path.resolve(flowSkillDir, '../proto-docs-dictionary/scripts/dictionary-manager.js');
  const schemaPath = path.join(flowSkillDir, 'dictionary/word-dictionary.schema.json');
  const dictionaryPath = path.join(flowSkillDir, 'dictionary/word-dictionary.json');

  if (!fs.existsSync(schemaPath)) {
    reminder('Dictionary schema is missing.', [
      'Keep word-dictionary.schema.json next to word-dictionary.json.',
      'The schema is the approved Dictionary contract.'
    ]);
    process.exit(1);
  }

  const schemaIssues = validateSchemaShape(schemaPath);
  if (schemaIssues.length > 0) {
    reminder('Dictionary schema contract is invalid.', schemaIssues);
    process.exit(1);
  }

  const validate = run(process.execPath, [manager, 'validate', '--dictionary', dictionaryPath]);
  if (validate.stdout) process.stdout.write(validate.stdout);
  if (validate.stderr) process.stderr.write(validate.stderr);
  if ((validate.status ?? 0) !== 0) {
    reminder('Dictionary does not conform to the approved schema contract.', [
      'Fix word-dictionary.json before using it to annotate Proto comments.',
      'Do not relax the schema to make invalid Dictionary entries pass.'
    ]);
    process.exit(validate.status ?? 1);
  }

  process.exit(0);
});
