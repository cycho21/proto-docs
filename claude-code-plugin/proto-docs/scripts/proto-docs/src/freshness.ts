import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SampleMarkdownDocGenerator, createDocGenerator } from './docGenerator.ts';

function readFilesRecursive(dir, base = dir) {
  if (!fs.existsSync(dir)) return new Map();
  const result = new Map();
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      for (const [k, v] of readFilesRecursive(full, base)) result.set(k, v);
    } else {
      result.set(path.relative(base, full).replaceAll('\\', '/'), fs.readFileSync(full, 'utf8'));
    }
  }
  return result;
}

export function checkFreshness(protoPath, docsDir, { generator = 'markdown-sample' } = {}) {
  const uninitialised = !fs.existsSync(docsDir);
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'proto-docs-'));
  const gen = generator === 'markdown-sample' ? new SampleMarkdownDocGenerator() : createDocGenerator(generator);
  gen.generate(protoPath, temp);
  const expected = readFilesRecursive(docsDir);
  const actual = readFilesRecursive(temp);
  const diffs = [];
  for (const key of new Set([...expected.keys(), ...actual.keys()])) {
    if (expected.get(key) !== actual.get(key)) diffs.push(key);
  }
  fs.rmSync(temp, { recursive: true, force: true });
  return {
    ok: diffs.length === 0,
    diffs,
    ...(uninitialised && { hint: `Docs not yet initialised. Run: generate-docs --proto <path> --docs ${docsDir}` })
  };
}
