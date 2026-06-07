import fs from 'node:fs';
import path from 'node:path';

export function listProtoFiles(inputPath: string): string[] {
  const stat = fs.statSync(inputPath);
  if (stat.isFile()) return [inputPath];
  const results: string[] = [];
  for (const name of fs.readdirSync(inputPath).sort()) {
    const full = path.join(inputPath, name);
    if (fs.statSync(full).isDirectory()) {
      results.push(...listProtoFiles(full));
    } else if (name.endsWith('.proto')) {
      results.push(full);
    }
  }
  return results;
}

export function scanProtoFile(file) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split(/\r?\n/);
  const messages = [];
  const services = [];
  let currentMessage = null;
  let currentService = null;
  let pendingComments = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      pendingComments = [];
      continue;
    }
    if (trimmed.startsWith('//')) {
      pendingComments.push(trimmed.replace(/^\/\/\s?/, '').trim());
      continue;
    }
    const messageMatch = trimmed.match(/^message\s+(\w+)\s*\{/);
    if (messageMatch) {
      currentMessage = { name: messageMatch[1], fields: [] };
      messages.push(currentMessage);
      pendingComments = [];
      continue;
    }
    const serviceMatch = trimmed.match(/^service\s+(\w+)\s*\{/);
    if (serviceMatch) {
      currentService = { name: serviceMatch[1], rpcs: [] };
      services.push(currentService);
      pendingComments = [];
      continue;
    }
    if (trimmed === '}') {
      currentMessage = null;
      currentService = null;
      pendingComments = [];
      continue;
    }
    const rpcMatch = trimmed.match(/^rpc\s+(\w+)\s*\(([^)]+)\)\s*returns\s*\(([^)]+)\)\s*;/);
    if (rpcMatch && currentService) {
      currentService.rpcs.push({ name: rpcMatch[1], request: rpcMatch[2].trim(), response: rpcMatch[3].trim(), comment: pendingComments.join(' ') });
      pendingComments = [];
      continue;
    }
    const fieldMatch = trimmed.match(/^(repeated\s+)?([A-Za-z_][\w.]*)\s+(\w+)\s*=\s*(\d+)\s*(?:\[[^\]]+\])?\s*;(?:\s*\/\/\s*(.*))?/);
    if (fieldMatch && currentMessage) {
      const inlineComment = fieldMatch[5]?.trim() ?? '';
      currentMessage.fields.push({
        repeated: Boolean(fieldMatch[1]),
        type: fieldMatch[2],
        name: fieldMatch[3],
        number: Number(fieldMatch[4]),
        comment: pendingComments.length > 0 ? pendingComments.join(' ') : inlineComment,
        file,
        message: currentMessage.name
      });
      pendingComments = [];
    } else if (trimmed && !trimmed.startsWith('option') && !trimmed.startsWith('syntax') && !trimmed.startsWith('package') && !trimmed.startsWith('import')) {
      pendingComments = [];
    }
  }
  return { file, messages, services };
}

export function scanProtoPath(inputPath) {
  return listProtoFiles(inputPath).map(scanProtoFile);
}

export function normalizedProtoStructure(inputPath) {
  return scanProtoPath(inputPath).map((file) => ({
    messages: file.messages.map((m) => ({
      name: m.name,
      fields: m.fields.map((f) => ({ repeated: f.repeated, type: f.type, name: f.name, number: f.number }))
    })),
    services: file.services
  }));
}
