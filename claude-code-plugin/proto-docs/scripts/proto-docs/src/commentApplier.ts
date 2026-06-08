import fs from 'node:fs';
import { resolveField } from './dictionary.ts';

function fieldComment(dictionary, messageName, fieldName) {
  const entry = resolveField(dictionary, messageName, fieldName);
  return entry?.canonical_description ?? null;
}

function removeTrailingLineComments(lines) {
  while (lines.length > 0 && /^\s*\/\//.test(lines[lines.length - 1])) lines.pop();
}

export function applyDictionaryCommentsToText(protoText, dictionary) {
  const raw = String(protoText);
  const crlf = raw.includes('\r\n');
  const lines = raw.split(/\r?\n/);
  const output = [];
  let currentMessage = null;

  for (const line of lines) {
    const trimmed = line.trim();
    const messageMatch = trimmed.match(/^message\s+(\w+)\s*\{/);
    if (messageMatch) {
      currentMessage = messageMatch[1];
      output.push(line);
      continue;
    }

    if (trimmed === '}') {
      currentMessage = null;
      output.push(line);
      continue;
    }

    const fieldMatch = trimmed.match(/^(repeated\s+)?([A-Za-z_][\w.]*)\s+(\w+)\s*=\s*(\d+)\s*(?:\[[^\]]+\])?\s*;/);
    if (fieldMatch && currentMessage) {
      const description = fieldComment(dictionary, currentMessage, fieldMatch[3]);
      if (description) {
        const indent = line.match(/^\s*/)?.[0] ?? '';
        removeTrailingLineComments(output);
        output.push(`${indent}// ${description}`);
      }
      output.push(line);
      continue;
    }

    output.push(line);
  }

  return output.join(crlf ? '\r\n' : '\n');
}

export function applyDictionaryComments(protoPath, dictionary, { outputPath = protoPath } = {}) {
  const before = fs.readFileSync(protoPath, 'utf8');
  const after = applyDictionaryCommentsToText(before, dictionary);
  fs.writeFileSync(outputPath, after);
  return { outputPath, changed: before !== after };
}
