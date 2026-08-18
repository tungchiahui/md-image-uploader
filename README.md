# MD Image Uploader

MD Image Uploader is a desktop VS Code extension that uploads images pasted into Markdown documents to S3-compatible object storage. It converts supported images to WebP, hashes the final WebP bytes, routes the object by the Markdown page date, uploads it, and inserts a CDN Markdown link.

## Features

- Handles image `Ctrl+V` in Markdown without overriding the normal paste keybinding.
- Supports PNG, JPG/JPEG, GIF, WebP, AVIF, and TIFF input.
- Preserves animated GIF frames when converting to animated WebP.
- Uses the SHA-256 of the exact uploaded WebP bytes in the object name.
- Routes uploads by directory date, filename date, or the current local date.
- Supports AWS S3 and S3-compatible endpoints.
- Reads settings for the current document, including Workspace Folder overrides in multi-root workspaces.
- Leaves ordinary text, code, URLs, and unsupported files to VS Code's default paste behavior.

V1 handles the first supported image in each paste and targets desktop VS Code.

## Installation

### Run from source

Requirements:

- Node.js 22
- VS Code 1.97 or later

Install dependencies and compile:

```bash
npm install
npm run compile
```

Open this repository in VS Code and press `F5`. The included launch configuration starts an Extension Development Host and watches the TypeScript sources.

## Configuration

Settings use the `mdImageUploader` namespace. A complete example is:

```json
{
  "mdImageUploader.enabled": true,
  "mdImageUploader.s3.endpoint": "https://s3.example.com",
  "mdImageUploader.s3.region": "ap-northeast-1",
  "mdImageUploader.s3.bucket": "images",
  "mdImageUploader.s3.accessKeyId": "ACCESS_KEY",
  "mdImageUploader.s3.secretAccessKey": "SECRET_KEY",
  "mdImageUploader.s3.forcePathStyle": false,
  "mdImageUploader.datedUploadPath": "markdown",
  "mdImageUploader.undatedUploadPath": "misc",
  "mdImageUploader.cdnUrl": "https://cdn.example.com",
  "mdImageUploader.webp.quality": 85
}
```

| Setting | Required | Default | Purpose |
| --- | --- | --- | --- |
| `mdImageUploader.enabled` | No | `true` | Enables image paste handling for the current resource. |
| `mdImageUploader.s3.endpoint` | No | empty | Custom S3-compatible HTTP(S) endpoint. Leave empty for the AWS endpoint selected by the region. |
| `mdImageUploader.s3.region` | Yes | empty | AWS or S3-compatible service region. |
| `mdImageUploader.s3.bucket` | Yes | empty | Destination bucket. |
| `mdImageUploader.s3.accessKeyId` | Yes | empty | S3 access key ID. |
| `mdImageUploader.s3.secretAccessKey` | Yes | empty | S3 secret access key. |
| `mdImageUploader.s3.forcePathStyle` | No | `false` | Enables path-style S3 requests when required by a compatible service. |
| `mdImageUploader.datedUploadPath` | Yes | `markdown` | Object-key prefix for a Markdown page with a valid directory or filename date. |
| `mdImageUploader.undatedUploadPath` | Yes | `misc` | Object-key prefix when neither directories nor the filename contain a valid date. |
| `mdImageUploader.cdnUrl` | Yes | empty | Public HTTP(S) base URL used in inserted Markdown. It is independent from the S3 endpoint. |
| `mdImageUploader.webp.quality` | No | `85` | Integer WebP quality from 1 to 100. |

Credentials are plain VS Code settings in V1. Keep them in User Settings and never commit them to a shared `.vscode/settings.json`.

## Paste an image

1. Open a Markdown document.
2. Copy a supported image, image file, or screenshot.
3. Press `Ctrl+V` (`Cmd+V` on macOS).
4. Wait for S3 `PutObject` to succeed.

The extension then inserts:

```md
![](https://cdn.example.com/path/image.webp)
```

No Markdown is inserted if conversion or upload fails. Ordinary text paste remains unchanged.

If another extension also provides image paste edits, prefer this extension's paste kind in VS Code settings:

```json
{
  "editor.pasteAs.preferences": [
    "markdown.image.mdImageUploader"
  ]
}
```

You can also use **Paste As...** and select **Upload image with MD Image Uploader**.

## Date routing and object keys

Every `YYYY-MM-DD` candidate is checked as a real calendar date. The priority is:

1. Search parent directory names, starting with the directory nearest the Markdown file. A valid directory date uses `datedUploadPath` and always wins over a filename date.
2. If no directory date exists, search the Markdown basename. A valid filename date also uses `datedUploadPath`.
3. If neither exists, use `undatedUploadPath` and the local date when the image is pasted.

Examples:

| Markdown path | Route and date |
| --- | --- |
| `wiki/2023-10-05-Cplusplus/article.md` | `datedUploadPath`, `2023/10/05` from the directory |
| `docs/2025-05-20-project/2026-01-14-article.md` | `datedUploadPath`, `2025/05/20`; directory wins |
| `docs/2026-01-14-article.md` | `datedUploadPath`, `2026/01/14` from the filename |
| `docs/article.md` pasted on 2026-08-18 | `undatedUploadPath`, `2026/08/18` |

The final key format is:

```text
<uploadPath>/<YYYY>/<MM>/<DD>/<timestamp>-<hash8>.webp
```

The public URL is `<cdnUrl>/<objectKey>`. Each object-key segment is URL encoded while `/` separators are preserved.

## Multiple repositories and workspaces

Configuration is read with the active Markdown document URI. VS Code therefore applies its normal precedence: User Settings, then Workspace Settings, then Workspace Folder Settings.

A practical setup is:

- Put credentials in User Settings.
- Put bucket, CDN URL, and upload paths in each repository's Workspace Settings.
- In a multi-root workspace, use Workspace Folder Settings when repositories need different destinations.

For example, one repository can set `datedUploadPath` to `wiki`, while another uses `blog`, without changing the extension or object-key logic.

## Test the S3 connection

Open a Markdown document and run **MD Image Uploader: Test Upload** from the Command Palette. It reads the S3 settings scoped to that document and uploads a small built-in WebP to:

```text
md-image-uploader-test/<timestamp>.webp
```

This command performs a real S3 write. It does not insert Markdown or test CDN delivery.

## Troubleshooting

### Image paste is not selected

- Confirm the active editor is a Markdown document.
- Confirm `mdImageUploader.enabled` is `true` for that document.
- Check that the clipboard contains a supported image or image file.
- Add `markdown.image.mdImageUploader` to `editor.pasteAs.preferences`, or choose the provider through **Paste As...**.

Unsupported content is intentionally left to VS Code's default paste behavior.

### `Missing setting "..."` or `Invalid setting "..."`

Open the settings scope for the affected Markdown file and supply the named value. `cdnUrl` and a custom `s3.endpoint` must be valid HTTP(S) URLs, and WebP quality must be an integer from 1 to 100.

### `Image conversion failed: Unsupported image format`

Use PNG, JPG/JPEG, GIF, WebP, AVIF, or TIFF. SVG and other formats are not part of V1.

### Other `Image conversion failed` errors

The clipboard or file may contain damaged or incomplete image bytes. Open the source image in an image viewer, export it to a supported format, and paste it again.

### `Upload failed: Network error`

Check the endpoint, DNS, internet or VPN connectivity, firewall, proxy, and whether the S3-compatible service is reachable. For AWS S3, leave the custom endpoint empty unless one is required.

### `Upload failed: Authentication or authorization error`

Check the access key, secret key, region, bucket policy, and permission to call `s3:PutObject` for the configured object-key prefixes. Also check for expired or disabled credentials.

### Other `Upload failed` errors

Review the displayed service reason. Common causes include a nonexistent bucket, incorrect region, incompatible `forcePathStyle` setting, storage quota, or a service-side failure. The extension does not insert partial Markdown after a failed upload.

### Upload succeeds but the CDN URL fails

`mdImageUploader.cdnUrl` is not inferred from the S3 endpoint. Confirm that the CDN maps to the configured bucket and object-key prefix and that uploaded objects are publicly deliverable through that CDN.

## Development

Run all project checks with:

```bash
npm run lint
npm run check
npm test
```

`npm test` compiles the TypeScript sources and runs the unit and integration tests without making a real S3 request.
