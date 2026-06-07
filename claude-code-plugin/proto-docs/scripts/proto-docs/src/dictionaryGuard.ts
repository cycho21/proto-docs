import fs from 'node:fs';
import crypto from 'node:crypto';

export class LocalApprovalManifestProvider {
  constructor(manifestPath) { this.manifestPath = manifestPath; }
  approvalsFor(filePath) {
    if (!this.manifestPath || !fs.existsSync(this.manifestPath)) return [];
    const manifest = JSON.parse(fs.readFileSync(this.manifestPath, 'utf8'));
    return (manifest.dictionaryChanges ?? []).filter((entry) => entry.path === filePath || entry.path.endsWith(filePath));
  }
}

export function validateApprovalEntry(entry) {
  return Boolean(entry?.approvedBy && entry?.reason && entry?.approvedAt);
}

export function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

export function detectDictionaryChanged(dictionaryPath, baselineHashPath) {
  if (!baselineHashPath) return false;
  if (!fs.existsSync(baselineHashPath)) return false;
  const expected = fs.readFileSync(baselineHashPath, 'utf8').trim();
  if (!expected) return false;
  return sha256File(dictionaryPath) !== expected;
}

export function guardDictionaryChange({ changed = false, dictionaryPath = '.proto-docs/dictionary/word-dictionary.json', baselineHashPath = '.proto-docs/dictionary/word-dictionary.sha256', manifestPath } = {}) {
  const changedByHash = detectDictionaryChanged(dictionaryPath, baselineHashPath);
  const isChanged = Boolean(changed || changedByHash);
  if (!isChanged) return { ok: true, issues: [] };
  const provider = new LocalApprovalManifestProvider(manifestPath);
  const approvals = provider.approvalsFor(dictionaryPath).filter(validateApprovalEntry);
  if (approvals.length === 0) return { ok: false, issues: [`${dictionaryPath} changed without approval evidence`] };
  return { ok: true, issues: [] };
}
