import fs from 'node:fs';
import path from 'node:path';
import { resolveField } from './dictionary.ts';
import { scanProtoPath } from './protoScanner.ts';

export function findMissingMappings(protoPath, dictionary, scannedFiles = null) {
  const misses = [];
  for (const file of (scannedFiles ?? scanProtoPath(protoPath))) {
    for (const message of file.messages) {
      for (const field of message.fields) {
        if (!resolveField(dictionary, message.name, field.name)) {
          misses.push({
            file: file.file,
            message: message.name,
            field: field.name,
            field_type: field.type,
            repeated: field.repeated,
            number: field.number,
            scope: `${message.name}.${field.name}`
          });
        }
      }
    }
  }
  return misses;
}

function words(value) {
  return String(value ?? '').split('_').filter(Boolean);
}

function titleWords(value) {
  return words(value).map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function singular(value) {
  if (value.endsWith('ies')) return `${value.slice(0, -3)}y`;
  if (value.endsWith('ses')) return value.slice(0, -2);
  if (value.endsWith('s') && !value.endsWith('ss')) return value.slice(0, -1);
  return value;
}

function generalDescriptionFor(miss) {
  const field = miss.field;
  const fieldLabel = titleWords(field).toLowerCase();

  if (field.endsWith('_key')) return `Key that identifies the ${fieldLabel.replace(/ key$/, '')}.`;
  if (field.endsWith('_keys')) return `Keys that identify the ${singular(fieldLabel.replace(/ keys$/, ''))} values.`;
  if (field.endsWith('_status')) return `Status value for ${fieldLabel.replace(/ status$/, '')}.`;
  if (field.endsWith('_reason')) return `Reason associated with ${fieldLabel.replace(/ reason$/, '')}.`;
  if (field.endsWith('_comment') || field.endsWith('_note')) return `Free-form note for ${fieldLabel.replace(/ (comment|note)$/, '')}.`;
  if (field.endsWith('_at')) {
    const base = fieldLabel.replace(/ at$/, '');
    return base.endsWith('event') ? `Timestamp when the ${base} occurs.` : `Timestamp for the ${base} event.`;
  }
  if (field.endsWith('_quantity')) return `Quantity value for ${fieldLabel.replace(/ quantity$/, '')}.`;
  if (field.endsWith('_amount')) return `Amount value for ${fieldLabel.replace(/ amount$/, '')}.`;
  if (field.endsWith('_code')) return `Code value for ${fieldLabel.replace(/ code$/, '')}.`;
  if (field.endsWith('_url')) return `URL for ${fieldLabel.replace(/ url$/, '')}.`;
  if (field.startsWith('next_')) return `Next ${fieldLabel.replace(/^next /, '')} for pagination or state progression.`;
  if (miss.field_type !== 'string' && miss.field_type !== 'bytes') return `${titleWords(field)} value.`;
  return `${titleWords(field)} value.`;
}

function messageDescriptionFor(miss) {
  const field = miss.field;
  const fieldLabel = titleWords(field).toLowerCase();
  const messageLabel = String(miss.message).replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();

  if (field.endsWith('_key')) return `Key that identifies the ${fieldLabel.replace(/ key$/, '')} in the ${messageLabel}.`;
  if (field.endsWith('_keys')) return `Keys that identify the ${singular(fieldLabel.replace(/ keys$/, ''))} values used by the ${messageLabel}.`;
  if (field.startsWith('total_')) return `Total ${fieldLabel.replace(/^total /, '')} for the ${messageLabel}.`;
  if (field.endsWith('_status')) return `Status value for the ${messageLabel}.`;
  if (field.endsWith('_reason')) return `Reason associated with the ${messageLabel}.`;
  if (field.endsWith('_comment') || field.endsWith('_note')) return `Free-form note for the ${messageLabel}.`;
  if (field.endsWith('_at')) {
    const base = fieldLabel.replace(/ at$/, '');
    return base.endsWith('event') ? `Timestamp when the ${base} occurs in the ${messageLabel}.` : `Timestamp for the ${base} event in the ${messageLabel}.`;
  }
  if (field.endsWith('_quantity')) return `Quantity value for the ${fieldLabel.replace(/ quantity$/, '')} in the ${messageLabel}.`;
  if (field.endsWith('_amount')) return `Amount value for the ${fieldLabel.replace(/ amount$/, '')} in the ${messageLabel}.`;
  if (field.endsWith('_code')) return `Code value for the ${fieldLabel.replace(/ code$/, '')} in the ${messageLabel}.`;
  if (field.endsWith('_url')) return `URL for the ${fieldLabel.replace(/ url$/, '')} in the ${messageLabel}.`;
  if (field.startsWith('next_')) return `Next ${fieldLabel.replace(/^next /, '')} for the ${messageLabel}.`;
  if (miss.field_type !== 'string' && miss.field_type !== 'bytes') return `${titleWords(field)} value for the ${messageLabel}.`;
  return `${titleWords(field)} for the ${messageLabel}.`;
}

function candidateFileName(messageName) {
  return `${String(messageName).replace(/[^A-Za-z0-9_.-]/g, '_')}.json`;
}

function aliasFor(fieldName) {
  const alias = String(fieldName).replace(/_([a-z0-9])/g, (_, ch) => ch.toUpperCase());
  return alias === fieldName ? [] : [alias];
}

function dictionaryEntry({ fieldName, scope, description, detectedAt, source }) {
  return {
    field_name: fieldName,
    scope,
    canonical_description: description,
    aliases: aliasFor(fieldName),
    forbidden_aliases: [],
    allowed_contexts: [...new Set(words(fieldName))],
    approved_examples: [description],
    status: 'draft_for_human_review',
    version: 1,
    owner: '@domain-owner',
    last_reviewed_at: detectedAt,
    visibility: 'public',
    source
  };
}

function buildWordDictionary(misses, detectedAt) {
  const dictionary = {};
  for (const miss of misses) {
    // NOTE: 같은 field_name이 여러 타입으로 쓰이는 경우 첫 번째 miss 기준으로 description이 결정됩니다.
    // 타입이 다른 동명 필드는 promote 단계에서 message_dictionary_override로 재정의하세요.
    if (dictionary[miss.field]) continue;
    dictionary[miss.field] = dictionaryEntry({
      fieldName: miss.field,
      scope: miss.field,
      description: generalDescriptionFor(miss),
      detectedAt,
      source: 'field_name'
    });
  }
  return dictionary;
}

function buildMessageCandidate(messageName, messageMisses, wordDictionary, detectedAt) {
  const [first] = messageMisses;
  return {
    candidate_type: 'message_dictionary',
    message_name: messageName,
    file: first?.file,
    status: 'pending_human_review',
    detected_at: detectedAt,
    review_notes: [
      'Use the global word_dictionary entry by default for each field.',
      'Only populate message_dictionary_override when LLM/domain review determines the message changes the field meaning.'
    ],
    fields: messageMisses.map((miss) => {
      const fieldEntry = wordDictionary[miss.field];
      return {
        field_name: miss.field,
        field_type: miss.field_type,
        repeated: Boolean(miss.repeated),
        number: miss.number,
        word_dictionary_scope: miss.field,
        word_dictionary_entry: fieldEntry,
        message_field_scope: miss.scope,
        effective_dictionary_scope: miss.field,
        message_dictionary_override: null,
        inference: {
          has_message_specific_meaning: false,
          candidate_override: dictionaryEntry({
            fieldName: miss.field,
            scope: miss.scope,
            description: messageDescriptionFor(miss),
            detectedAt,
            source: 'message_context_inference'
          }),
          reason: 'Default uses the global word_dictionary. Move candidate_override into message_dictionary_override only if LLM/domain review confirms a different message-specific meaning.'
        },
        evidence: {
          file: miss.file,
          message: miss.message,
          field: miss.field,
          field_type: miss.field_type,
          repeated: Boolean(miss.repeated),
          number: miss.number
        }
      };
    })
  };
}

function assertNonEmptyString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`${label} must be a non-empty string`);
}

function assertArray(value, label) {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
}

function validateDraftDictionaryEntry(entry, label) {
  const required = ['field_name', 'scope', 'canonical_description', 'aliases', 'forbidden_aliases', 'allowed_contexts', 'approved_examples', 'status', 'version', 'owner', 'last_reviewed_at', 'visibility', 'source'];
  const allowed = new Set(required);
  for (const field of required) if (!(field in entry)) throw new Error(`${label} missing ${field}`);
  for (const field of Object.keys(entry ?? {})) if (!allowed.has(field)) throw new Error(`${label} unknown field ${field}`);
  assertNonEmptyString(entry.field_name, `${label}.field_name`);
  assertNonEmptyString(entry.scope, `${label}.scope`);
  assertNonEmptyString(entry.canonical_description, `${label}.canonical_description`);
  assertArray(entry.aliases, `${label}.aliases`);
  assertArray(entry.forbidden_aliases, `${label}.forbidden_aliases`);
  assertArray(entry.allowed_contexts, `${label}.allowed_contexts`);
  assertArray(entry.approved_examples, `${label}.approved_examples`);
  if (entry.approved_examples.length < 1) throw new Error(`${label}.approved_examples must not be empty`);
  if (entry.status !== 'draft_for_human_review') throw new Error(`${label}.status must be draft_for_human_review`);
  if (!Number.isInteger(entry.version) || entry.version < 1) throw new Error(`${label}.version must be a positive integer`);
  assertNonEmptyString(entry.owner, `${label}.owner`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.last_reviewed_at)) throw new Error(`${label}.last_reviewed_at must be YYYY-MM-DD`);
  if (!['public', 'internal', 'restricted'].includes(entry.visibility)) throw new Error(`${label}.visibility is invalid`);
}

export function validateCandidateDictionary(dictionary) {
  if (!dictionary || typeof dictionary !== 'object' || Array.isArray(dictionary)) throw new Error('candidate word_dictionary must be an object');
  for (const [scope, entry] of Object.entries(dictionary)) {
    validateDraftDictionaryEntry(entry, `word_dictionary.${scope}`);
    if (entry.scope !== scope) throw new Error(`word_dictionary.${scope}.scope must match its key`);
  }
}

export function validateMessageCandidate(candidate, wordDictionary) {
  if (candidate?.candidate_type !== 'message_dictionary') throw new Error('message candidate_type must be message_dictionary');
  assertNonEmptyString(candidate.message_name, 'message_name');
  assertArray(candidate.fields, 'fields');
  for (const field of candidate.fields) {
    assertNonEmptyString(field.field_name, 'fields[].field_name');
    assertNonEmptyString(field.word_dictionary_scope, `${field.field_name}.word_dictionary_scope`);
    assertNonEmptyString(field.message_field_scope, `${field.field_name}.message_field_scope`);
    validateDraftDictionaryEntry(field.word_dictionary_entry, `${field.field_name}.word_dictionary_entry`);
    if (field.word_dictionary_scope !== field.field_name) throw new Error(`${field.field_name}.word_dictionary_scope must equal field_name`);
    if (!wordDictionary[field.word_dictionary_scope]) throw new Error(`${field.field_name} references missing word_dictionary scope ${field.word_dictionary_scope}`);
    if (field.effective_dictionary_scope !== field.word_dictionary_scope && !field.message_dictionary_override) {
      throw new Error(`${field.field_name}.effective_dictionary_scope can differ only when message_dictionary_override exists`);
    }
    if (field.message_dictionary_override) validateDraftDictionaryEntry(field.message_dictionary_override, `${field.field_name}.message_dictionary_override`);
    validateDraftDictionaryEntry(field.inference?.candidate_override, `${field.field_name}.inference.candidate_override`);
  }
}

export function validateCandidateOutput(outputDir) {
  const dictionaryPath = path.join(outputDir, 'word-dictionary.json');
  const dictionary = JSON.parse(fs.readFileSync(dictionaryPath, 'utf8'));
  validateCandidateDictionary(dictionary);
  const messagesDir = path.join(outputDir, 'messages');
  for (const name of fs.readdirSync(messagesDir)) {
    if (!name.endsWith('.json')) continue;
    validateMessageCandidate(JSON.parse(fs.readFileSync(path.join(messagesDir, name), 'utf8')), dictionary);
  }
  return { ok: true, dictionaryPath, messagesDir };
}

export function promoteCandidateOverride(outputDir, messageName, fieldName) {
  assertNonEmptyString(messageName, 'messageName');
  assertNonEmptyString(fieldName, 'fieldName');
  const dictionaryPath = path.join(outputDir, 'word-dictionary.json');
  const dictionary = JSON.parse(fs.readFileSync(dictionaryPath, 'utf8'));
  const messagePath = path.join(outputDir, 'messages', candidateFileName(messageName));
  const candidate = JSON.parse(fs.readFileSync(messagePath, 'utf8'));
  const field = candidate.fields.find((item) => item.field_name === fieldName);
  if (!field) throw new Error(`${messageName}.${fieldName} candidate field not found`);
  if (!field.inference?.candidate_override) throw new Error(`${messageName}.${fieldName} has no inference.candidate_override`);
  field.message_dictionary_override = field.inference.candidate_override;
  field.effective_dictionary_scope = field.message_dictionary_override.scope;
  field.inference.has_message_specific_meaning = true;
  field.inference.reason = 'LLM/domain review promoted candidate_override to message_dictionary_override.';
  validateMessageCandidate(candidate, dictionary);
  fs.writeFileSync(messagePath, `${JSON.stringify(candidate, null, 2)}\n`);
  return { messagePath, scope: field.message_dictionary_override.scope };
}

function sampleList(items, limit = 10) {
  return {
    count: items.length,
    sample: items.slice(0, limit),
    omitted: Math.max(0, items.length - limit)
  };
}

export function reviewCandidates(outputDir) {
  validateCandidateOutput(outputDir);
  const dictionaryPath = path.join(outputDir, 'word-dictionary.json');
  const wordDictionary = JSON.parse(fs.readFileSync(dictionaryPath, 'utf8'));
  const messagesDir = path.join(outputDir, 'messages');
  const fieldScopes = Object.keys(wordDictionary).sort();
  const pendingByField = new Map();
  const promoted = [];
  let messageFiles = 0;
  let messageFieldUsages = 0;

  for (const fileName of fs.readdirSync(messagesDir).sort()) {
    if (!fileName.endsWith('.json')) continue;
    messageFiles += 1;
    const candidate = JSON.parse(fs.readFileSync(path.join(messagesDir, fileName), 'utf8'));
    for (const field of candidate.fields ?? []) {
      messageFieldUsages += 1;
      if (field.message_dictionary_override) {
        promoted.push({
          scope: field.message_dictionary_override.scope,
          field: field.field_name,
          message: candidate.message_name,
          description: field.message_dictionary_override.canonical_description
        });
        continue;
      }
      const item = pendingByField.get(field.field_name) ?? {
        field: field.field_name,
        defaultScope: field.word_dictionary_scope,
        defaultDescription: field.word_dictionary_entry?.canonical_description,
        count: 0,
        messageScopes: [],
        sampleMessages: [],
        recommendation: 'Use the field-level Dictionary entry by default. Promote a Message.field override only when domain review confirms a different meaning.'
      };
      item.count += 1;
      item.messageScopes.push(field.message_field_scope);
      if (item.sampleMessages.length < 5) item.sampleMessages.push(candidate.message_name);
      pendingByField.set(field.field_name, item);
    }
  }

  const pending = [...pendingByField.values()].sort((a, b) => a.field.localeCompare(b.field));
  promoted.sort((a, b) => a.scope.localeCompare(b.scope));

  return {
    ok: true,
    summary: {
      fieldLevelCandidates: fieldScopes.length,
      messageFiles,
      messageFieldUsages,
      promotedMessageOverrides: promoted.length,
      pendingMessageOverrideReview: pending.reduce((sum, item) => sum + item.count, 0)
    },
    recommendedApprovalBatches: [
      {
        id: 'field-level-defaults',
        title: 'Approve field-level defaults first when their common meaning is acceptable.',
        scopes: fieldScopes
      }
    ],
    messageOverrideReview: {
      promoted,
      pendingByField: pending
    },
    nextPrompts: [
      'Approve the field-level-defaults batch, or list field scopes to hold back.',
      'For message-specific meanings, name only the Message.field scopes that should become overrides.',
      'Leave all other message candidates pending; they do not need to be merged.'
    ]
  };
}

export function compactCandidateReview(review) {
  const fieldBatch = review.recommendedApprovalBatches.find((batch) => batch.id === 'field-level-defaults');
  const topPending = [...review.messageOverrideReview.pendingByField]
    .sort((a, b) => b.count - a.count || a.field.localeCompare(b.field))
    .slice(0, 10)
    .map((item) => ({
      field: item.field,
      usageCount: item.count,
      sampleMessages: item.sampleMessages,
      recommendation: item.recommendation
    }));

  return {
    ok: review.ok,
    summary: review.summary,
    approvalBatches: [
      {
        id: fieldBatch.id,
        title: fieldBatch.title,
        scopeCount: fieldBatch.scopes.length,
        sampleScopes: sampleList(fieldBatch.scopes, 15).sample,
        omittedScopes: sampleList(fieldBatch.scopes, 15).omitted,
        approvalPrompt: 'Approve this whole batch if the shared field-level meanings are acceptable; otherwise list scopes to hold back.'
      }
    ],
    messageOverrideReview: {
      promotedCount: review.messageOverrideReview.promoted.length,
      promotedSamples: sampleList(review.messageOverrideReview.promoted.map((item) => item.scope), 10).sample,
      pendingFieldGroupCount: review.messageOverrideReview.pendingByField.length,
      topPendingFieldGroups: topPending,
      reviewPrompt: 'Only name Message.field scopes that truly need message-specific meaning. Leave the rest pending/default.'
    },
    nextPrompts: review.nextPrompts,
    detailedOutput: 'Run review-candidates --detailed to inspect every pending field group and Message.field scope.'
  };
}

export function writeCandidates(misses, outputDir, detectedAt = new Date().toISOString().slice(0, 10)) {
  fs.mkdirSync(outputDir, { recursive: true });
  const messagesDir = path.join(outputDir, 'messages');
  fs.mkdirSync(messagesDir, { recursive: true });

  const wordDictionary = buildWordDictionary(misses, detectedAt);
  const dictionaryPath = path.join(outputDir, 'word-dictionary.json');
  fs.writeFileSync(dictionaryPath, `${JSON.stringify(wordDictionary, null, 2)}\n`);

  const byMessage = new Map();
  for (const miss of misses) {
    const messageMisses = byMessage.get(miss.message) ?? [];
    messageMisses.push(miss);
    byMessage.set(miss.message, messageMisses);
  }

  const messageFiles = [];
  for (const [messageName, messageMisses] of byMessage) {
    const target = path.join(messagesDir, candidateFileName(messageName));
    fs.writeFileSync(target, `${JSON.stringify(buildMessageCandidate(messageName, messageMisses, wordDictionary, detectedAt), null, 2)}\n`);
    messageFiles.push(target);
  }

  validateCandidateOutput(outputDir);
  return { wordDictionary: dictionaryPath, messages: messageFiles };
}
