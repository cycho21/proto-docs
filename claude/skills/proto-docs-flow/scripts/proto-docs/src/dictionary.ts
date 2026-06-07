import fs from 'node:fs';

const required = [
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

const arrayFields = ['aliases', 'forbidden_aliases', 'allowed_contexts', 'approved_examples'];
const allowedVisibility = new Set(['public', 'internal', 'restricted']);

function assertNonEmptyString(value, message) {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(message);
}

function assertStringArray(value, message, { minItems = 0 } = {}) {
  if (!Array.isArray(value)) throw new Error(message);
  if (value.length < minItems) throw new Error(message);
  const seen = new Set();
  for (const item of value) {
    assertNonEmptyString(item, message);
    if (seen.has(item)) throw new Error(`${message}: duplicate '${item}'`);
    seen.add(item);
  }
}

function validateEntry(key, entry) {
  for (const field of required) {
    if (!(field in entry)) throw new Error(`Dictionary entry ${key} missing ${field}`);
  }
  const allowed = new Set(required);
  for (const field of Object.keys(entry)) {
    if (!allowed.has(field)) throw new Error(`Dictionary entry ${key} has unknown field ${field}`);
  }
  assertNonEmptyString(entry.term, `Dictionary entry ${key} has invalid term`);
  assertNonEmptyString(entry.scope, `Dictionary entry ${key} has invalid scope`);
  if (entry.scope !== key) throw new Error(`Dictionary entry ${key} scope must match key`);
  assertNonEmptyString(entry.canonical_description, `Dictionary entry ${key} has invalid canonical_description`);
  for (const field of arrayFields) {
    assertStringArray(entry[field], `Dictionary entry ${key} has invalid ${field}`, { minItems: field === 'approved_examples' ? 1 : 0 });
  }
  if (entry.status !== 'approved') throw new Error(`Dictionary entry ${key} is not approved`);
  if (!Number.isInteger(entry.version) || entry.version < 1) throw new Error(`Dictionary entry ${key} has invalid version`);
  assertNonEmptyString(entry.owner, `Dictionary entry ${key} has invalid owner`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.last_reviewed_at)) throw new Error(`Dictionary entry ${key} has invalid last_reviewed_at`);
  if (!allowedVisibility.has(entry.visibility)) throw new Error(`Dictionary entry ${key} has invalid visibility`);
}

export function loadDictionary(path) {
  const raw = JSON.parse(fs.readFileSync(path, 'utf8'));
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Dictionary must be a JSON object');
  for (const [key, entry] of Object.entries(raw)) validateEntry(key, entry);
  return raw;
}

export function resolveTerm(dictionary, message, field) {
  const scoped = `${message}.${field}`;
  return dictionary[scoped] ?? dictionary[field] ?? null;
}
