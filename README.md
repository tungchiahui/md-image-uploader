# MD Image Uploader

MD Image Uploader is a desktop VS Code extension for uploading images pasted into Markdown documents.

The project is currently at the initial extension-scaffolding stage. Image conversion, storage configuration, uploads, and paste handling will be added in later tasks from the project specification.

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
```
