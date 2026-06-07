import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import childProcess from 'node:child_process';
import { loadDictionary } from '../src/dictionary.ts';
import { findMissingMappings, promoteCandidateOverride, reviewCandidates, validateCandidateOutput, writeCandidates } from '../src/candidates.ts';
import { lintComments } from '../src/linter.ts';
import { compareProtoStructure } from '../src/astGuard.ts';
import { guardDictionaryChange, sha256File } from '../src/dictionaryGuard.ts';
import { checkFreshness } from '../src/freshness.ts';
import { BufDocGenerator } from '../src/docGenerator.ts';
import { applyDictionaryComments } from '../src/commentApplier.ts';

const root = process.cwd();
const dictPath = path.join(root, '.proto-docs/dictionary/word-dictionary.json');
const validProto = path.join(root, 'samples/proto/asset.proto');
const unmappedProto = path.join(root, 'samples/proto/unmapped.proto');

function tmpDir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'proto-docs-test-')); }
function write(file, content) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, content); return file; }
function run(args) { return childProcess.spawnSync(process.execPath, ['claude-code-plugin/proto-docs/scripts/proto-docs/src/cli.ts', ...args], { cwd: root, encoding: 'utf8' }); }

test('dictionary loading validates sample dictionary', () => {
  const dictionary = loadDictionary(dictPath);
  assert.equal(dictionary['Asset.owner_key'].canonical_description, 'Internal key that identifies the asset owner.');
});

test('missing mapping is detected and message candidate file is generated', () => {
  const dictionary = loadDictionary(dictPath);
  const misses = findMissingMappings(unmappedProto, dictionary);
  assert.equal(misses.length, 1);
  const out = tmpDir();
  const written = writeCandidates(misses, out, '2026-06-06');
  assert.equal(path.basename(written.wordDictionary), 'word-dictionary.json');
  assert.equal(written.messages.length, 1);
  assert.equal(path.basename(written.messages[0]), 'FusionRequest.json');
  assert.deepEqual(validateCandidateOutput(out).ok, true);
  const wordDictionary = JSON.parse(fs.readFileSync(written.wordDictionary, 'utf8'));
  assert.equal(wordDictionary.fusion_material_id.scope, 'fusion_material_id');
  assert.equal(wordDictionary.fusion_material_id.status, 'draft_for_human_review');
  const candidate = JSON.parse(fs.readFileSync(written.messages[0], 'utf8'));
  assert.equal(candidate.candidate_type, 'message_dictionary');
  assert.equal(candidate.message_name, 'FusionRequest');
  assert.equal(candidate.status, 'pending_human_review');
  assert.equal(candidate.fields.length, 1);
  assert.equal(candidate.fields[0].field_name, 'fusion_material_id');
  assert.equal(candidate.fields[0].word_dictionary_scope, 'fusion_material_id');
  assert.equal(candidate.fields[0].word_dictionary_entry.scope, 'fusion_material_id');
  assert.equal(candidate.fields[0].message_field_scope, 'FusionRequest.fusion_material_id');
  assert.equal(candidate.fields[0].effective_dictionary_scope, 'fusion_material_id');
  assert.equal(candidate.fields[0].message_dictionary_override, null);
  assert.equal(candidate.fields[0].inference.has_message_specific_meaning, false);
  assert.notEqual(candidate.fields[0].word_dictionary_entry.canonical_description, 'TODO: Human review required');
  assert.match(candidate.fields[0].word_dictionary_entry.canonical_description, /fusion material/i);
  assert.match(candidate.fields[0].inference.candidate_override.canonical_description, /fusion request/i);
});

test('message override candidate can be promoted and still validates', () => {
  const dictionary = loadDictionary(dictPath);
  const misses = findMissingMappings(unmappedProto, dictionary);
  const out = tmpDir();
  writeCandidates(misses, out, '2026-06-06');
  const promoted = promoteCandidateOverride(out, 'FusionRequest', 'fusion_material_id');
  assert.equal(promoted.scope, 'FusionRequest.fusion_material_id');
  const candidate = JSON.parse(fs.readFileSync(path.join(out, 'messages', 'FusionRequest.json'), 'utf8'));
  const field = candidate.fields[0];
  assert.equal(field.effective_dictionary_scope, 'FusionRequest.fusion_material_id');
  assert.equal(field.message_dictionary_override.scope, 'FusionRequest.fusion_material_id');
  assert.equal(field.inference.has_message_specific_meaning, true);
  assert.equal(validateCandidateOutput(out).ok, true);
});

test('candidate review groups scopes for natural-language approval UX', () => {
  const out = tmpDir();
  writeCandidates([
    { file: 'workflow.proto', message: 'BuildSettlementReportRequest', field: 'amount', field_type: 'int64', repeated: false, number: 1, scope: 'BuildSettlementReportRequest.amount' },
    { file: 'workflow.proto', message: 'SettlementLine', field: 'amount', field_type: 'int64', repeated: false, number: 2, scope: 'SettlementLine.amount' },
    { file: 'workflow.proto', message: 'TransferAuditEvent', field: 'status', field_type: 'string', repeated: false, number: 3, scope: 'TransferAuditEvent.status' }
  ], out, '2026-06-06');
  promoteCandidateOverride(out, 'SettlementLine', 'amount');

  const review = reviewCandidates(out);
  assert.equal(review.ok, true);
  assert.equal(review.summary.fieldLevelCandidates, 2);
  assert.equal(review.summary.messageFieldUsages, 3);
  assert.equal(review.summary.promotedMessageOverrides, 1);
  assert.deepEqual(review.recommendedApprovalBatches[0].scopes, ['amount', 'status']);
  assert.deepEqual(review.messageOverrideReview.promoted.map((item) => item.scope), ['SettlementLine.amount']);
  const amountGroup = review.messageOverrideReview.pendingByField.find((item) => item.field === 'amount');
  assert.equal(amountGroup.count, 1);
  assert.deepEqual(amountGroup.messageScopes, ['BuildSettlementReportRequest.amount']);
});

test('forbidden alias fails lint', () => {
  const dir = tmpDir();
  const proto = write(path.join(dir, 'bad.proto'), fs.readFileSync(validProto, 'utf8').replace('Internal key that identifies the asset owner.', 'User id for asset owner.'));
  const issues = lintComments(proto, loadDictionary(dictPath));
  assert.ok(issues.some((issue) => issue.rule === 'Forbidden Alias'));
});

test('semantic mismatch fails lint', () => {
  const dir = tmpDir();
  const proto = write(path.join(dir, 'drift.proto'), fs.readFileSync(validProto, 'utf8').replace('Internal key that identifies the asset owner.', 'Identifier for login account.'));
  const issues = lintComments(proto, loadDictionary(dictPath));
  assert.ok(issues.some((issue) => issue.rule === 'Semantic Drift'));
});

test('semantic drift fails when unapproved meaning is appended to approved text', () => {
  const dir = tmpDir();
  const proto = write(path.join(dir, 'drift-appended.proto'), fs.readFileSync(validProto, 'utf8').replace('Internal key that identifies the asset owner.', 'Internal key that identifies the asset owner. Customer reference for billing.'));
  const issues = lintComments(proto, loadDictionary(dictPath));
  assert.ok(issues.some((issue) => issue.rule === 'Semantic Drift'));
});

test('dictionary comments are applied, lint clean, and proto structure is preserved', () => {
  const dir = tmpDir();
  const before = write(path.join(dir, 'before.proto'), `syntax = "proto3";\n\npackage sample.asset.v1;\n\nmessage Asset {\n  string asset_key = 1;\n\n  // Wrong owner text.\n  string owner_key = 2;\n}\n`);
  const after = path.join(dir, 'after.proto');
  const dictionary = loadDictionary(dictPath);
  const result = applyDictionaryComments(before, dictionary, { outputPath: after });
  assert.equal(result.changed, true);
  const afterText = fs.readFileSync(after, 'utf8');
  assert.match(afterText, /\/\/ Internal key that identifies the asset\.\n  string asset_key = 1;/);
  assert.match(afterText, /\/\/ Internal key that identifies the asset owner\.\n  string owner_key = 2;/);
  assert.deepEqual(lintComments(after, dictionary), []);
  assert.equal(compareProtoStructure(before, after).equal, true);
});

test('CLI review-candidates summarizes approval batches without dumping every file', () => {
  const dictionary = loadDictionary(dictPath);
  const misses = findMissingMappings(unmappedProto, dictionary);
  const out = tmpDir();
  writeCandidates(misses, out, '2026-06-06');
  const result = run(['review-candidates', '--candidates', out]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const review = JSON.parse(result.stdout);
  assert.equal(review.ok, true);
  assert.equal(review.approvalBatches[0].id, 'field-level-defaults');
  assert.equal(review.approvalBatches[0].scopeCount, 1);
  assert.deepEqual(review.approvalBatches[0].sampleScopes, ['fusion_material_id']);
  assert.equal('pendingByField' in review.messageOverrideReview, false);
});

test('CLI apply-comments writes annotated proto that passes lint and AST guard', () => {
  const dir = tmpDir();
  const before = write(path.join(dir, 'before.proto'), `syntax = "proto3";\n\npackage sample.asset.v1;\n\nmessage GetAssetRequest {\n  string asset_key = 1;\n}\n`);
  const after = path.join(dir, 'after.proto');
  const apply = run(['apply-comments', '--proto', before, '--dictionary', '.proto-docs/dictionary/word-dictionary.json', '--out', after]);
  assert.equal(apply.status, 0, apply.stderr || apply.stdout);
  const lint = run(['lint-comments', '--proto', after, '--dictionary', '.proto-docs/dictionary/word-dictionary.json']);
  assert.equal(lint.status, 0, lint.stderr || lint.stdout);
  const guard = run(['guard-ast', '--before', before, '--after', after]);
  assert.equal(guard.status, 0, guard.stderr || guard.stdout);
});

test('AST guard allows comment-only changes and rejects structural changes', () => {
  const dir = tmpDir();
  const before = write(path.join(dir, 'before.proto'), fs.readFileSync(validProto, 'utf8'));
  const afterComment = write(path.join(dir, 'after-comment.proto'), fs.readFileSync(validProto, 'utf8').replace('Asset service for sample documentation.', 'Asset service comment changed.'));
  assert.equal(compareProtoStructure(before, afterComment).equal, true);
  const afterStruct = write(path.join(dir, 'after-struct.proto'), fs.readFileSync(validProto, 'utf8').replace('string owner_key = 2;', 'string owner_key = 3;'));
  assert.equal(compareProtoStructure(before, afterStruct).equal, false);
});

test('dictionary guard requires local approval evidence for changed dictionary', () => {
  assert.equal(guardDictionaryChange({ changed: true, dictionaryPath: '.proto-docs/dictionary/word-dictionary.json' }).ok, false);
  const manifest = write(path.join(tmpDir(), 'approval.json'), JSON.stringify({ dictionaryChanges: [{ path: '.proto-docs/dictionary/word-dictionary.json', approvedBy: '@domain-owner', reason: 'sample approval', approvedAt: '2026-06-06' }] }));
  assert.equal(guardDictionaryChange({ changed: true, dictionaryPath: '.proto-docs/dictionary/word-dictionary.json', manifestPath: manifest }).ok, true);
});

test('dictionary guard detects changed dictionary by baseline hash without caller flag', () => {
  const dir = tmpDir();
  const dictionary = write(path.join(dir, 'word-dictionary.json'), fs.readFileSync(dictPath, 'utf8'));
  const baseline = write(path.join(dir, 'word-dictionary.sha256'), `${sha256File(dictionary)}\n`);
  fs.writeFileSync(dictionary, fs.readFileSync(dictionary, 'utf8').replace('Internal key that identifies the asset owner.', 'Changed description.'));
  assert.equal(guardDictionaryChange({ dictionaryPath: dictionary, baselineHashPath: baseline }).ok, false);
  const manifest = write(path.join(dir, 'approval.json'), JSON.stringify({ dictionaryChanges: [{ path: dictionary, approvedBy: '@domain-owner', reason: 'sample approval', approvedAt: '2026-06-06' }] }));
  assert.equal(guardDictionaryChange({ dictionaryPath: dictionary, baselineHashPath: baseline, manifestPath: manifest }).ok, true);
});

test('freshness checker passes on committed sample and fails on mismatch', () => {
  assert.equal(checkFreshness(validProto, path.join(root, 'docs/generated')).ok, true);
  const dir = tmpDir();
  write(path.join(dir, 'proto-docs.md'), 'stale\n');
  const stale = checkFreshness(validProto, dir);
  assert.equal(stale.ok, false);
  assert.ok(stale.diffs.includes('proto-docs.md'));
});

test('CLI verify exits 0 for valid sample', () => {
  const result = run(['verify', '--proto', 'samples/proto/asset.proto', '--dictionary', '.proto-docs/dictionary/word-dictionary.json', '--docs', 'docs/generated']);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /"ok": true/);
});

test('CLI lint exits 1 for invalid sample', () => {
  const dir = tmpDir();
  const proto = write(path.join(dir, 'bad.proto'), fs.readFileSync(validProto, 'utf8').replace('Internal key that identifies the asset owner.', 'Wallet address for asset owner.'));
  const result = run(['lint-comments', '--proto', proto, '--dictionary', '.proto-docs/dictionary/word-dictionary.json']);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /Forbidden Alias/);
});

test('Buf generator invokes buf generate and returns generated files', () => {
  const dir = tmpDir();
  const fakeBuf = path.join(dir, 'fake-buf.js');
  const out = path.join(dir, 'out');
  const log = path.join(dir, 'buf-args.txt');
  write(fakeBuf, `import fs from 'node:fs';\nfs.mkdirSync(${JSON.stringify(out)}, { recursive: true });\nfs.writeFileSync(${JSON.stringify(log)}, process.argv.slice(2).join(' '));\nfs.writeFileSync(${JSON.stringify(path.join(out, 'buf-doc.md'))}, 'generated\\n');\n`);
  const originalCommand = process.env.PROTO_DOCS_BUF_COMMAND;
  const originalArgs = process.env.PROTO_DOCS_BUF_COMMAND_ARGS;
  process.env.PROTO_DOCS_BUF_COMMAND = process.execPath;
  process.env.PROTO_DOCS_BUF_COMMAND_ARGS = JSON.stringify([fakeBuf]);
  try {
    const written = new BufDocGenerator().generate(validProto, out);
    assert.ok(written.some((file) => file.endsWith('buf-doc.md')));
    assert.match(fs.readFileSync(log, 'utf8'), /generate/);
    assert.match(fs.readFileSync(log, 'utf8'), /--output/);
  } finally {
    if (originalCommand === undefined) delete process.env.PROTO_DOCS_BUF_COMMAND;
    else process.env.PROTO_DOCS_BUF_COMMAND = originalCommand;
    if (originalArgs === undefined) delete process.env.PROTO_DOCS_BUF_COMMAND_ARGS;
    else process.env.PROTO_DOCS_BUF_COMMAND_ARGS = originalArgs;
  }
});
