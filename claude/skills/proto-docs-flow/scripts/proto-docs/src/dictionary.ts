import fs from 'node:fs';

const required = ['term','scope','canonical_description','aliases','forbidden_aliases','approved_examples','status','version','owner'];

export function loadDictionary(path) {
  const raw = JSON.parse(fs.readFileSync(path, 'utf8'));
  for (const [key, entry] of Object.entries(raw)) {
    for (const field of required) {
      if (!(field in entry)) throw new Error(`Dictionary entry ${key} missing ${field}`);
    }
    if (!Array.isArray(entry.aliases) || !Array.isArray(entry.forbidden_aliases) || !Array.isArray(entry.approved_examples)) {
      throw new Error(`Dictionary entry ${key} has invalid array fields`);
    }
    if (entry.status !== 'approved') throw new Error(`Dictionary entry ${key} is not approved`);
  }
  return raw;
}

export function resolveTerm(dictionary, message, field) {
  const scoped = `${message}.${field}`;
  return dictionary[scoped] ?? dictionary[field] ?? null;
}
