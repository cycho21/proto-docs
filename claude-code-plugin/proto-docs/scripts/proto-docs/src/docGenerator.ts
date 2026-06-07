import fs from 'node:fs';
import path from 'node:path';
import childProcess from 'node:child_process';
import { scanProtoPath } from './protoScanner.ts';

export class DocGenerator {
  generate(_protoPath, _outDir) { throw new Error('DocGenerator.generate must be implemented'); }
}

export class BufDocGenerator extends DocGenerator {
  generate(protoPath, outDir) {
    fs.mkdirSync(outDir, { recursive: true });
    const bufCommand = process.env.PROTO_DOCS_BUF_COMMAND || 'buf';
    const prefixArgs = process.env.PROTO_DOCS_BUF_COMMAND_ARGS ? JSON.parse(process.env.PROTO_DOCS_BUF_COMMAND_ARGS) : [];
    const result = childProcess.spawnSync(bufCommand, [...prefixArgs, 'generate', protoPath, '--output', outDir], { encoding: 'utf8' });
    if (result.error) {
      throw new Error('buf command is required for BufDocGenerator but was not found. Install buf or use --generator markdown-sample.');
    }
    if (result.status !== 0) {
      const detail = result.stderr || result.stdout || 'buf generate failed';
      throw new Error(`buf generate failed: ${detail.trim()}`);
    }
    return listGeneratedFiles(outDir);
  }
}

export class SampleMarkdownDocGenerator extends DocGenerator {
  generate(protoPath, outDir) { return generateMarkdownFromProto(protoPath, outDir, 'markdown-sample'); }
}

export function createDocGenerator(name = 'buf') {
  if (name === 'buf') return new BufDocGenerator();
  if (name === 'markdown-sample') return new SampleMarkdownDocGenerator();
  throw new Error(`Unknown document generator '${name}'`);
}

export function renderMarkdownForFile(fileResult) {
  const lines = [`## ${path.basename(fileResult.file)}`, ''];
  for (const service of fileResult.services) {
    lines.push(`### Service ${service.name}`, '');
    for (const rpc of service.rpcs) lines.push(`- RPC \`${rpc.name}\`: ${rpc.comment}`);
    lines.push('');
  }
  for (const message of fileResult.messages) {
    lines.push(`### Message ${message.name}`, '', '| Field | Type | Number | Description |', '|---|---|---:|---|');
    for (const field of message.fields) lines.push(`| \`${field.name}\` | \`${field.repeated ? 'repeated ' : ''}${field.type}\` | ${field.number} | ${field.comment} |`);
    lines.push('');
  }
  return lines.join('\n');
}

export function renderMarkdown(protoPath) {
  const files = scanProtoPath(protoPath);
  const parts = ['# Proto API Documentation', '', 'Generated deterministically from Proto comments.', '', ...files.map(renderMarkdownForFile)];
  return `${parts.join('\n').trim()}\n`;
}

function listGeneratedFiles(outDir) {
  if (!fs.existsSync(outDir)) return [];
  return fs.readdirSync(outDir).map((name) => path.join(outDir, name));
}

function generateMarkdownFromProto(protoPath, outDir, generatorName) {
  fs.mkdirSync(outDir, { recursive: true });
  const files = scanProtoPath(protoPath);
  const written = [];
  for (const file of files) {
    const baseName = path.basename(file.file, '.proto');
    const target = path.join(outDir, `${baseName}.md`);
    fs.writeFileSync(target, `<!-- generator: ${generatorName} -->\n${renderMarkdownForFile(file)}`);
    written.push(target);
  }
  return written;
}
