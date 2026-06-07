# Proto Docs CLI Usage

## Commands

Run from the repository root.

```bash
npm run proto-docs -- verify
npm run proto-docs -- scan --proto samples/proto/asset.proto
npm run proto-docs -- generate-candidates --proto samples/proto/unmapped.proto
npm run proto-docs -- lint-comments
npm run proto-docs -- guard-ast --before samples/proto/asset.proto --after samples/proto/asset.proto
npm run proto-docs -- guard-dictionary
npm run proto-docs -- guard-dictionary --changed --approval-manifest .proto-docs/dictionary/approval-manifest.sample.json
npm run proto-docs -- generate-docs --generator buf
npm run proto-docs -- check-freshness
```

## Default sample verification

```bash
npm test
npm run proto-docs -- verify
```

`verify` performs comment linting, AST guard, dictionary guard, and generated docs freshness checks against the valid sample. Dictionary guard compares `.proto-docs/dictionary/word-dictionary.json` with `.proto-docs/dictionary/word-dictionary.sha256` and requires approval evidence when the hash differs.

## Network policy

The CLI does not call LLM APIs or network services. Approval validation uses a local manifest provider only.

## Buf generator

`generate-docs` defaults to the Buf adapter. If `buf` is not installed, it exits with code 1 and an error mentioning the missing `buf` command. For deterministic sample verification without requiring Buf, use:

```bash
npm run proto-docs -- generate-docs -- --generator markdown-sample
```
