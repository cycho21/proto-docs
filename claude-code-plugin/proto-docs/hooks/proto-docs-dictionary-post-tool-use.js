#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function pluginRoot() { return process.env.CLAUDE_PLUGIN_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); }
function run(command, args) { return spawnSync(command, args, { cwd: process.cwd(), encoding: 'utf8' }); }
function reminder(title, lines) { console.error(`\n[PROTO DOCS DICTIONARY REMINDER] ${title}`); for (const line of lines) console.error(`- ${line}`); console.error(''); }
function parseEvent(raw) { try { return raw.trim() ? JSON.parse(raw) : {}; } catch { return {}; } }
function changedPath(event) { const toolInput = event.tool_input ?? event.toolInput ?? {}; return toolInput.file_path ?? toolInput.path; }
function sha256(filePath) { return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex'); }
function gitRoot() { const result = run('git', ['rev-parse', '--show-toplevel']); return (result.status ?? 0) === 0 ? result.stdout.trim() : process.cwd(); }
function repoRelative(filePath) { const root = gitRoot(); const absolute = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath); return path.relative(root, absolute).replace(/\\/g, '/'); }
function readHeadJson(relativePath) { const result = run('git', ['show', `HEAD:${relativePath}`]); if ((result.status ?? 0) !== 0) return null; return JSON.parse(result.stdout); }
function changedScopes(before, after) { const scopes = new Set(); const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]); for (const key of keys) if (JSON.stringify(before?.[key] ?? null) !== JSON.stringify(after?.[key] ?? null)) scopes.add(key); return [...scopes].sort(); }
function approvedScopes(approval) { return new Set([...(approval.approvedScopes ?? []), ...(approval.scopes ?? [])].map(String)); }
function approvalForDictionary(dictionaryPath) {
  for (const manifestPath of [path.join('.proto-docs', 'dictionary', 'approval-manifest.json'), path.join('.proto-docs', 'dictionary', 'approval-manifest.sample.json')]) {
    if (!fs.existsSync(manifestPath)) continue;
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const changes = manifest.dictionaryChanges;
    if (!Array.isArray(changes)) continue;
    const dictionaryRelative = repoRelative(dictionaryPath);
    const match = changes.find((change) => {
      const changePath = String(change.path ?? '').replace(/\\/g, '/');
      return dictionaryRelative === changePath || dictionaryRelative.endsWith(changePath);
    });
    if (match) return { manifestPath, approval: match };
  }
  return null;
}

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  const filePath = changedPath(parseEvent(input));
  if (!filePath) process.exit(0);
  const normalized = String(filePath).replace(/\\/g, '/');
  if (!normalized.endsWith('/.proto-docs/dictionary/word-dictionary.json') &&
      !normalized.endsWith('/.proto-docs/dictionary/word-dictionary.sha256') &&
      !normalized.startsWith('.proto-docs/dictionary/word-dictionary')) process.exit(0);

  const dictionary = path.join('.proto-docs', 'dictionary', 'word-dictionary.json');
  const hashPath = path.join('.proto-docs', 'dictionary', 'word-dictionary.sha256');
  if (!fs.existsSync(dictionary)) process.exit(0);

  const manager = path.join(pluginRoot(), 'skills/proto-docs-dictionary/scripts/dictionary-manager.js');
  const validate = run(process.execPath, [manager, 'validate', '--dictionary', dictionary]);
  if (validate.stdout) process.stdout.write(validate.stdout);
  if (validate.stderr) process.stderr.write(validate.stderr);
  if ((validate.status ?? 0) !== 0) {
    reminder('Approved Dictionary validation failed.', [
      'Fix JSON/schema before continuing.',
      'Use field-level entries for shared semantics and Message.field only for overrides.'
    ]);
    process.exit(validate.status ?? 1);
  }

  const beforeDictionary = readHeadJson(repoRelative(dictionary));
  const afterDictionary = JSON.parse(fs.readFileSync(dictionary, 'utf8'));
  const changed = changedScopes(beforeDictionary, afterDictionary);
  // beforeDictionary === null 이면 git에 처음 추가되는 파일 — scope 승인 체크 스킵
  if (changed.length > 0 && beforeDictionary !== null) {
    const approval = approvalForDictionary(dictionary);
    if (!approval) {
      reminder('Approved Dictionary scopes changed without approval manifest.', [
        `Changed scopes: ${changed.join(', ')}`,
        'Create candidates first, then promote only approved scopes with dictionaryChanges[].approvedScopes.'
      ]);
      process.exit(1);
    }
    const allowed = approvedScopes(approval.approval);
    const unapproved = changed.filter((scope) => !allowed.has(scope));
    if (allowed.size === 0 || unapproved.length > 0) {
      reminder('Approved Dictionary changed outside approved scopes.', [
        `Changed scopes: ${changed.join(', ')}`,
        `Approved scopes: ${[...allowed].join(', ') || '(none)'}`,
        `Unapproved scopes: ${unapproved.join(', ') || changed.join(', ')}`
      ]);
      process.exit(1);
    }
  }

  if (!fs.existsSync(hashPath)) process.exit(0);
  const expected = fs.readFileSync(hashPath, 'utf8').trim();
  const actual = sha256(dictionary);
  if (expected && expected !== actual) {
    reminder('Dictionary hash does not match the approved Dictionary.', [
      'If approved, update word-dictionary.sha256 with dictionary-manager hash --approval-manifest <path>.',
      'If approval is missing, revert the approved Dictionary change and create a candidate instead.'
    ]);
    process.exit(1);
  }
});
