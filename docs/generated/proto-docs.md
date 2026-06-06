<!-- generator: markdown-sample -->
# Proto API Documentation

Generated deterministically from Proto comments.

## asset.proto

### Service AssetService

- RPC `GetAsset`: Gets an asset by key.

### Message GetAssetRequest

| Field | Type | Number | Description |
|---|---|---:|---|
| `asset_key` | `string` | 1 | Internal key that identifies the asset. |

### Message Asset

| Field | Type | Number | Description |
|---|---|---:|---|
| `asset_key` | `string` | 1 | Internal key that identifies the asset. |
| `owner_key` | `string` | 2 | Internal key that identifies the asset owner. |
