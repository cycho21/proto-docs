import fs from 'node:fs';
import path from 'node:path';
import { resolveTerm } from './dictionary.ts';
import { scanProtoPath } from './protoScanner.ts';

export function findMissingMappings(protoPath, dictionary) {
  const misses = [];
  for (const file of scanProtoPath(protoPath)) {
    for (const message of file.messages) {
      for (const field of message.fields) {
        if (!resolveTerm(dictionary, message.name, field.name)) {
          misses.push({ file: file.file, message: message.name, field: field.name, field_type: field.type, scope: `${message.name}.${field.name}` });
        }
      }
    }
  }
  return misses;
}

export function candidateFor(miss, detectedAt = new Date().toISOString().slice(0, 10)) {
  return {
    term: miss.field,
    scope: miss.scope,
    status: 'pending_human_review',
    suggested_description: 'TODO: Human review required',
    evidence: { file: miss.file, message: miss.message, field: miss.field, field_type: miss.field_type },
    detected_at: detectedAt
  };
}

export function writeCandidates(misses, outputDir, detectedAt) {
  fs.mkdirSync(outputDir, { recursive: true });
  const written = [];
  for (const miss of misses) {
    const target = path.join(outputDir, `${miss.field}.json`);
    fs.writeFileSync(target, `${JSON.stringify(candidateFor(miss, detectedAt), null, 2)}\n`);
    written.push(target);
  }
  return written;
}
