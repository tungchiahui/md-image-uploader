# MD Image Uploader

MD Image Uploader is a desktop VS Code extension for uploading images pasted into Markdown documents.

The project currently contains the extension scaffold, resource-scoped configuration, date routing, object key generation, WebP conversion, final-WebP hashing, S3 uploads, and the Markdown image paste-provider foundation. The complete paste-to-upload flow will be connected in a later task from the project specification.

## Development

Requirements:

- Node.js 22
- VS Code 1.97 or later

Install dependencies and compile the extension:

```bash
npm install
npm run compile
```

To run the extension locally, open this repository in VS Code and press `F5`. The included launch configuration starts an Extension Development Host and watches the TypeScript sources. Open a Markdown file in the development host to activate the extension.

Additional checks:

```bash
npm run lint
npm run check
npm test
```

## Settings

Settings use the `mdImageUploader` namespace and are read for the active Markdown document. User Settings can therefore be overridden by Workspace or Workspace Folder Settings in multi-root workspaces.

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

Credentials are stored as plain VS Code settings in V1. Keep them in User Settings and never commit them to a shared `.vscode/settings.json`.

## Test upload command

Open a Markdown document and run **MD Image Uploader: Test Upload** from the Command Palette. The command reads S3 settings for that document and uploads a small built-in WebP to `md-image-uploader-test/<timestamp>.webp`.

This command performs a real S3 write. It does not insert Markdown or handle `Ctrl+V`.
