# Dictionary Approval Policy

## Protected file

```text
.proto-docs/dictionary/word-dictionary.json
```

AI agents must not directly modify this file during normal comment generation. They may create candidate files under:

```text
.proto-docs/dictionary/candidates/*.json
```

## Local approval manifest

Because this implementation must run with 0 network calls, dictionary approval is checked with a local manifest provider.

Example:

```json
{
  "dictionaryChanges": [
    {
      "path": ".proto-docs/dictionary/word-dictionary.json",
      "approvedBy": "@domain-owner",
      "reason": "Approved canonical description for sample term",
      "approvedAt": "2026-06-06"
    }
  ]
}
```

Each approved Dictionary change requires at least:

- 1 approver
- 1 reason
- 1 approval timestamp

## Baseline hash

The guard detects Dictionary changes by comparing the current file hash with:

```text
.proto-docs/dictionary/word-dictionary.sha256
```

The file stores the approved SHA-256 hash of `.proto-docs/dictionary/word-dictionary.json`.
If the current Dictionary hash differs from the baseline hash, approval evidence is required.

## Check commands

Detect changes from the baseline hash:

```bash
npm run proto-docs -- guard-dictionary
```

Force a changed-state check explicitly:

```bash
npm run proto-docs -- guard-dictionary --changed --approval-manifest path/to/approval.json
```

Use a custom baseline hash file:

```bash
npm run proto-docs -- guard-dictionary --dictionary-baseline-hash path/to/word-dictionary.sha256
```

Without valid approval evidence, changed Dictionary validation exits with code 1.

## Extension point

The code separates approval validation behind a provider interface. A GitHub PR/CODEOWNERS provider can be added later, but it is intentionally not implemented in this pass.
