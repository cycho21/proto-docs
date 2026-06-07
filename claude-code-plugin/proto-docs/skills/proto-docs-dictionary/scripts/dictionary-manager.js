#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const REQUIRED = [
  'field_name',
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
const ARRAY_FIELDS = ['aliases', 'forbidden_aliases', 'allowed_contexts', 'approved_examples'];
const VISIBILITY_VALUES = new Set(['public', 'internal', 'restricted']);

function arg(name, fallback) {
  const ix = process.argv.indexOf(`--${name}`);
  return ix >= 0 ? process.argv[ix + 1] : fallback;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function list(value) {
  if (!value) return [];
  return value.split(',').map(item => item.trim()).filter(Boolean);
}

function ensureParent(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  ensureParent(filePath);
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function hashDictionary(dictionaryPath) {
  const bytes = fs.readFileSync(dictionaryPath);
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function normalizePath(value) {
  return path.normalize(value).replace(/\\/g, '/');
}

function reminder(title, lines) {
  console.error(`\n[PROTO DOCS DICTIONARY REMINDER] ${title}`);
  for (const line of lines) console.error(`- ${line}`);
  console.error('');
}

function approvedScopes(change) {
  return new Set([...(change.approvedScopes ?? []), ...(change.scopes ?? [])].map(String));
}

function requireApprovalManifest(dictionaryPath, requiredScopes = []) {
  const manifestPath = arg('approval-manifest');
  if (!manifestPath) {
    reminder('Approval manifest is required for approved Dictionary changes.', [
      'Do not regenerate or re-approve the full existing Dictionary.',
      'Reuse existing approved entries; create candidates only for scopes missing from Message.field and field lookup.',
      'Pass --approval-manifest <path> with dictionaryChanges[].approvedScopes evidence for changed scopes only.'
    ]);
    throw new Error('--approval-manifest is required');
  }
  const manifest = readJson(manifestPath, null);
  const changes = manifest?.dictionaryChanges;
  if (!Array.isArray(changes)) throw new Error(`${manifestPath} must contain dictionaryChanges[]`);
  const dictionaryNorm = normalizePath(dictionaryPath);
  const match = changes.find((change) => {
    const changePath = normalizePath(String(change.path ?? ''));
    return dictionaryNorm === changePath || dictionaryNorm.endsWith(changePath);
  });
  if (!match) throw new Error(`${manifestPath} has no dictionaryChanges entry for ${dictionaryPath}`);
  for (const field of ['approvedBy', 'reason', 'approvedAt']) {
    if (!match[field]) throw new Error(`${manifestPath} dictionaryChanges entry missing ${field}`);
  }
  const scopes = approvedScopes(match);
  if (requiredScopes.length > 0 && scopes.size === 0) {
    throw new Error(`${manifestPath} dictionaryChanges entry must include approvedScopes[] for changed Dictionary scopes`);
  }
  for (const scope of requiredScopes) {
    if (!scopes.has(scope)) throw new Error(`${manifestPath} does not approve Dictionary scope ${scope}`);
  }
  return { manifestPath, approval: match };
}

function buildEntry(status) {
  const scope = arg('scope');
  const fieldName = arg('field-name', arg('field_name', scope?.split('.').at(-1)));
  const description = arg('description');
  const owner = arg('owner');

  if (!scope) throw new Error('--scope is required');
  if (!fieldName) throw new Error('--field-name is required');
  if (!description) throw new Error('--description is required');
  if (!owner) throw new Error('--owner is required');

  return {
    field_name: fieldName,
    scope,
    canonical_description: description,
    aliases: list(arg('aliases', '')),
    forbidden_aliases: list(arg('forbidden-aliases', '')),
    allowed_contexts: list(arg('contexts', '')),
    approved_examples: list(arg('examples', description)),
    status,
    version: Number(arg('version', '1')),
    owner,
    last_reviewed_at: arg('reviewed-at', today()),
    visibility: arg('visibility', 'public')
  };
}

function validateEntry(key, entry) {
  const issues = [];
  const allowed = new Set(REQUIRED);
  for (const field of REQUIRED) {
    if (!(field in entry)) issues.push(`${key}: missing ${field}`);
  }
  for (const field of Object.keys(entry ?? {})) {
    if (!allowed.has(field)) issues.push(`${key}: unknown field ${field}`);
  }
  for (const field of ARRAY_FIELDS) {
    if (field in entry && !Array.isArray(entry[field])) issues.push(`${key}: ${field} must be an array`);
    if (field === 'approved_examples' && Array.isArray(entry[field]) && entry[field].length === 0) issues.push(`${key}: approved_examples must not be empty`);
    if (Array.isArray(entry[field])) {
      const seen = new Set();
      for (const item of entry[field]) {
        if (typeof item !== 'string' || item.trim() === '') issues.push(`${key}: ${field} contains invalid item`);
        if (seen.has(item)) issues.push(`${key}: ${field} contains duplicate '${item}'`);
        seen.add(item);
      }
    }
  }
  for (const field of ['field_name', 'scope', 'canonical_description', 'owner']) {
    if (field in entry && (typeof entry[field] !== 'string' || entry[field].trim() === '')) issues.push(`${key}: ${field} must be a non-empty string`);
  }
  if (entry.scope && entry.scope !== key) issues.push(`${key}: scope must match dictionary key`);
  if (entry.status && entry.status !== 'approved') issues.push(`${key}: status must be approved`);
  if (entry.version && (!Number.isInteger(entry.version) || entry.version < 1)) issues.push(`${key}: version must be a positive integer`);
  if (entry.last_reviewed_at && !/^\d{4}-\d{2}-\d{2}$/.test(entry.last_reviewed_at)) issues.push(`${key}: last_reviewed_at must be YYYY-MM-DD`);
  if (entry.visibility && !VISIBILITY_VALUES.has(entry.visibility)) issues.push(`${key}: visibility must be public, internal, or restricted`);
  return issues;
}

function validateDictionary(dictionaryPath) {
  const dictionary = readJson(dictionaryPath, null);
  if (!dictionary || typeof dictionary !== 'object' || Array.isArray(dictionary)) {
    throw new Error('Dictionary must be a JSON object');
  }
  const issues = [];
  for (const [key, entry] of Object.entries(dictionary)) {
    issues.push(...validateEntry(key, entry));
    if (entry.status !== 'approved') issues.push(`${key}: approved dictionary entries must have status approved`);
  }
  return issues;
}

function approvedEntryFromCandidate(candidate) {
  const entry = { ...candidate };
  delete entry.source;
  entry.status = 'approved';
  for (const field of REQUIRED) {
    if (!(field in entry)) throw new Error(`Candidate ${candidate?.scope ?? '(unknown)'} missing ${field}`);
  }
  for (const field of Object.keys(entry)) {
    if (!REQUIRED.includes(field)) delete entry[field];
  }
  return entry;
}

function collectCandidateEntries(candidatesDir) {
  const entries = {};
  const globalPath = path.join(candidatesDir, 'word-dictionary.json');
  const global = readJson(globalPath, {});
  for (const [scope, entry] of Object.entries(global)) entries[scope] = entry;

  const messagesDir = path.join(candidatesDir, 'messages');
  if (fs.existsSync(messagesDir)) {
    for (const fileName of fs.readdirSync(messagesDir)) {
      if (!fileName.endsWith('.json')) continue;
      const candidate = readJson(path.join(messagesDir, fileName), null);
      for (const field of candidate?.fields ?? []) {
        if (field.message_dictionary_override) {
          entries[field.message_dictionary_override.scope] = field.message_dictionary_override;
        }
      }
    }
  }
  return entries;
}

function commandPromoteCandidates() {
  const candidatesDir = arg('candidates');
  const dictionaryPath = arg('dictionary');
  if (!candidatesDir) throw new Error('--candidates is required');
  if (!dictionaryPath) throw new Error('--dictionary is required');
  const approval = requireApprovalManifest(dictionaryPath);
  const scopes = [...approvedScopes(approval.approval)].sort();
  if (scopes.length === 0) throw new Error('approval manifest must include dictionaryChanges[].approvedScopes');

  const candidates = collectCandidateEntries(candidatesDir);
  const dictionary = readJson(dictionaryPath, {});
  const promoted = [];
  for (const scope of scopes) {
    const candidate = candidates[scope];
    if (!candidate) throw new Error(`No candidate found for approved scope ${scope}`);
    if (dictionary[scope] && !process.argv.includes('--force')) throw new Error(`${scope} already exists; pass --force to overwrite`);
    const approved = approvedEntryFromCandidate(candidate);
    const issues = validateEntry(scope, approved);
    if (issues.length) throw new Error(`Approved candidate ${scope} is invalid: ${issues.join('; ')}`);
    dictionary[scope] = approved;
    promoted.push(scope);
  }
  const sorted = Object.fromEntries(Object.entries(dictionary).sort(([a], [b]) => a.localeCompare(b)));
  writeJson(dictionaryPath, sorted);
  console.log(JSON.stringify({ dictionary: dictionaryPath, promoted, approval }, null, 2));
}

function commandInit() {
  const dictionaryPath = arg('dictionary');
  const hashPath = arg('hash');
  if (!dictionaryPath) throw new Error('--dictionary is required');
  if (fs.existsSync(dictionaryPath) && !process.argv.includes('--force')) {
    throw new Error(`${dictionaryPath} already exists; pass --force to overwrite`);
  }
  writeJson(dictionaryPath, {});
  const result = { dictionary: dictionaryPath };
  if (hashPath) {
    ensureParent(hashPath);
    fs.writeFileSync(hashPath, `${hashDictionary(dictionaryPath)}\n`, 'utf8');
    result.hash = hashPath;
  }
  console.log(JSON.stringify(result, null, 2));
}

function commandAddCandidate() {
  const candidatesDir = arg('candidates');
  if (!candidatesDir) throw new Error('--candidates is required');
  const entry = buildEntry('candidate');
  const fileName = `${entry.scope.replace(/[^A-Za-z0-9_.-]/g, '_')}.json`;
  const candidatePath = path.join(candidatesDir, fileName);
  if (fs.existsSync(candidatePath) && !process.argv.includes('--force')) {
    throw new Error(`${candidatePath} already exists; pass --force to overwrite`);
  }
  writeJson(candidatePath, entry);
  console.log(JSON.stringify({ candidate: candidatePath, entry }, null, 2));
}

function commandAddApproved() {
  const dictionaryPath = arg('dictionary');
  if (!dictionaryPath) throw new Error('--dictionary is required');
  const entry = buildEntry('approved');
  const approval = requireApprovalManifest(dictionaryPath, [entry.scope]);
  const dictionary = readJson(dictionaryPath, {});
  if (dictionary[entry.scope] && !process.argv.includes('--force')) {
    throw new Error(`${entry.scope} already exists; pass --force to overwrite`);
  }
  dictionary[entry.scope] = entry;
  const sorted = Object.fromEntries(Object.entries(dictionary).sort(([a], [b]) => a.localeCompare(b)));
  writeJson(dictionaryPath, sorted);
  console.log(JSON.stringify({ dictionary: dictionaryPath, added: entry.scope, approval }, null, 2));
}

function commandValidate() {
  const dictionaryPath = arg('dictionary');
  if (!dictionaryPath) throw new Error('--dictionary is required');
  const issues = validateDictionary(dictionaryPath);
  console.log(JSON.stringify({ ok: issues.length === 0, issues }, null, 2));
  if (issues.length) process.exitCode = 1;
}

function commandHash() {
  const dictionaryPath = arg('dictionary');
  const hashPath = arg('hash');
  if (!dictionaryPath) throw new Error('--dictionary is required');
  if (!hashPath) throw new Error('--hash is required');
  const approval = requireApprovalManifest(dictionaryPath);
  const issues = validateDictionary(dictionaryPath);
  if (issues.length) {
    console.log(JSON.stringify({ ok: false, issues }, null, 2));
    process.exitCode = 1;
    return;
  }
  ensureParent(hashPath);
  const hash = hashDictionary(dictionaryPath);
  fs.writeFileSync(hashPath, `${hash}\n`, 'utf8');
  console.log(JSON.stringify({ ok: true, hash, written: hashPath, approval }, null, 2));
}

function usage() {
  console.log('Usage: dictionary-manager <init|add-candidate|add-approved|promote-candidates|validate|hash> [options]');
}

try {
  const command = process.argv[2] ?? 'help';
  if (command === 'init') commandInit();
  else if (command === 'add-candidate') commandAddCandidate();
  else if (command === 'add-approved') commandAddApproved();
  else if (command === 'promote-candidates') commandPromoteCandidates();
  else if (command === 'validate') commandValidate();
  else if (command === 'hash') commandHash();
  else usage();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
