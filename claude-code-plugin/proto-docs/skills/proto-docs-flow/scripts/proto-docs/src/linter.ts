import { resolveTerm } from './dictionary.ts';
import { scanProtoPath } from './protoScanner.ts';
import { findMissingMappings } from './candidates.ts';

function includesAny(text, terms) {
  const lower = text.toLowerCase();
  return terms.find((term) => lower.includes(String(term).toLowerCase()));
}

function normalizeComment(text) {
  return String(text ?? '').replace(/\s+/g, ' ').trim();
}

function matchesApprovedComment(comment, approved) {
  const normalized = normalizeComment(comment);
  return approved.some((text) => normalized === normalizeComment(text));
}

export function lintComments(protoPath, dictionary, { failMissing = true } = {}) {
  const issues = [];
  const missing = findMissingMappings(protoPath, dictionary);
  if (failMissing) {
    for (const miss of missing) issues.push({ rule: 'Missing Mapping', message: `${miss.scope} has no dictionary mapping`, file: miss.file });
  }
  for (const file of scanProtoPath(protoPath)) {
    for (const message of file.messages) {
      for (const field of message.fields) {
        const entry = resolveTerm(dictionary, message.name, field.name);
        if (!entry) continue;
        if (!field.comment) {
          issues.push({ rule: 'Missing Comment', message: `${message.name}.${field.name} has no comment`, file: file.file });
          continue;
        }
        const forbidden = includesAny(field.comment, entry.forbidden_aliases);
        if (forbidden) issues.push({ rule: 'Forbidden Alias', message: `${message.name}.${field.name} uses forbidden alias '${forbidden}'`, file: file.file });
        const approved = [entry.canonical_description, ...(entry.approved_examples ?? [])].filter(Boolean);
        if (!matchesApprovedComment(field.comment, approved)) {
          issues.push({ rule: 'Semantic Drift', message: `${message.name}.${field.name} comment must exactly match canonical description or an approved example`, file: file.file });
        }
      }
    }
  }
  return issues;
}
