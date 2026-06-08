#!/usr/bin/env node
import fs from 'node:fs';
import { loadDictionary } from './dictionary.ts';
import { scanProtoPath } from './protoScanner.ts';
import { compactCandidateReview, findMissingMappings, promoteCandidateOverride, reviewCandidates, validateCandidateOutput, writeCandidates } from './candidates.ts';
import { lintComments } from './linter.ts';
import { compareProtoStructure } from './astGuard.ts';
import { guardDictionaryChange } from './dictionaryGuard.ts';
import { createDocGenerator } from './docGenerator.ts';
import { checkFreshness } from './freshness.ts';
import { applyDictionaryComments } from './commentApplier.ts';

function arg(name, fallback) {
  const ix = process.argv.indexOf(`--${name}`);
  if (ix < 0) return fallback;
  const next = process.argv[ix + 1];
  if (next === undefined || next.startsWith('--')) return fallback;
  return next;
}
function flag(name) { return process.argv.includes(`--${name}`); }
function print(obj) { console.log(typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2)); }
function fail(message, details) { console.error(message); if (details) console.error(JSON.stringify(details, null, 2)); process.exitCode = 1; }

const cmd = process.argv[2] ?? 'help';
const protoPath = arg('proto', undefined);
const dictPath = arg('dictionary', '.proto-docs/dictionary/word-dictionary.json');
const candidatesDir = arg('candidates', '.proto-docs/dictionary/candidates');
const docsDir = arg('docs', 'docs/generated');
const baselineHashPath = arg('dictionary-baseline-hash', '.proto-docs/dictionary/word-dictionary.sha256');
const outPath = arg('out', protoPath);
const messageName = arg('message', undefined);
const fieldName = arg('field', undefined);

try {
  if (cmd === 'scan') {
    print(scanProtoPath(protoPath));
  } else if (cmd === 'generate-candidates') {
    const dictExists = fs.existsSync(dictPath);
    const dict = dictExists ? loadDictionary(dictPath) : {};
    const misses = findMissingMappings(protoPath, dict);
    const written = writeCandidates(misses, candidatesDir, arg('detected-at', undefined));
    print({ missing: misses.length, written, ...(!dictExists && { note: `Dictionary not found at '${dictPath}'; all fields treated as missing. Run dictionary-manager init to create it.` }) });
    if (misses.length > 0 && flag('fail-on-missing')) process.exitCode = 1;
  } else if (cmd === 'validate-candidates') {
    const result = validateCandidateOutput(candidatesDir);
    print(result);
  } else if (cmd === 'review-candidates') {
    const result = reviewCandidates(candidatesDir);
    print(flag('detailed') ? result : compactCandidateReview(result));
  } else if (cmd === 'promote-candidate-override') {
    const result = promoteCandidateOverride(candidatesDir, messageName, fieldName);
    print(result);
  } else if (cmd === 'apply-comments') {
    const result = applyDictionaryComments(protoPath, loadDictionary(dictPath), { outputPath: outPath });
    print(result);
  } else if (cmd === 'lint-comments') {
    const issues = lintComments(protoPath, loadDictionary(dictPath));
    print({ issues });
    if (issues.length) process.exitCode = 1;
  } else if (cmd === 'guard-ast') {
    const before = arg('before', undefined);
    const after = arg('after', undefined);
    if (!before || !after) throw new Error('guard-ast requires --before and --after');
    const result = compareProtoStructure(before, after);
    print(result);
    if (!result.equal) process.exitCode = 1;
  } else if (cmd === 'guard-dictionary') {
    const result = guardDictionaryChange({ changed: flag('changed'), dictionaryPath: dictPath, baselineHashPath, manifestPath: arg('approval-manifest', undefined) });
    print(result);
    if (!result.ok) process.exitCode = 1;
  } else if (cmd === 'generate-docs') {
    const generator = createDocGenerator(arg('generator', 'markdown-sample'));
    print({ written: generator.generate(protoPath, docsDir) });
  } else if (cmd === 'check-freshness') {
    const result = checkFreshness(protoPath, docsDir, { generator: arg('generator', 'markdown-sample') });
    print(result);
    if (!result.ok) process.exitCode = 1;
  } else if (cmd === 'verify') {
    const dict = loadDictionary(dictPath);
    const lint = lintComments(protoPath, dict);
    const dictionary = guardDictionaryChange({ changed: flag('dictionary-changed'), dictionaryPath: dictPath, baselineHashPath, manifestPath: arg('approval-manifest', undefined) });
    const fresh = checkFreshness(protoPath, docsDir, { generator: arg('generator', 'markdown-sample') });
    const ok = lint.length === 0 && dictionary.ok && fresh.ok;
    // AST 체크는 before/after 컨텍스트가 필요하므로 guard-ast 커맨드를 별도 실행하세요.
    print({ ok, lintIssues: lint, dictionaryGuard: dictionary, freshness: fresh });
    if (!ok) process.exitCode = 1;
  } else {
    print('Usage: proto-docs <scan|generate-candidates|validate-candidates|review-candidates|promote-candidate-override|apply-comments|lint-comments|guard-ast|guard-dictionary|generate-docs|check-freshness|verify> [--proto path] [--dictionary path]');
  }
} catch (error) {
  fail(error.message);
}
