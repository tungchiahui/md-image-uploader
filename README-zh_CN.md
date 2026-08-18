中文 | [English](README.md)

# MD Image Uploader

MD Image Uploader 是一款桌面版 VS Code 扩展，用于将粘贴到 Markdown 文档中的图片上传至 S3 或 S3 兼容对象存储。扩展会把支持的图片转换为 WebP，对最终 WebP 字节计算哈希，根据 Markdown 页面日期生成对象路径，完成上传后插入 CDN Markdown 图片链接。

## 功能特性

- 在 Markdown 中处理图片 `Ctrl+V`，不覆盖 VS Code 原有粘贴快捷键。
- 支持 PNG、JPG/JPEG、GIF、WebP、AVIF 和 TIFF 输入。
- 动态 GIF 转换为 WebP 后仍保留动画帧。
- 使用实际上传的最终 WebP 字节计算 SHA-256，并将其用于对象名称。
- 根据目录日期、文件名日期或当前本地日期路由上传路径。
- 支持 AWS S3 和 S3 兼容服务。
- 按当前文档读取配置，支持多根工作区中的 Workspace Folder 覆盖。
- 普通文本、代码、URL 和不支持的文件仍由 VS Code 默认粘贴行为处理。

V1 每次粘贴只处理第一张受支持的图片，并以桌面版 VS Code 为目标。

## 安装

### 从源码运行

环境要求：

- Node.js 22
- VS Code 1.97 或更高版本

安装依赖并编译：

```bash
npm install
npm run compile
```

使用 VS Code 打开本仓库并按 `F5`。仓库内置的启动配置会打开 Extension Development Host，并监视 TypeScript 源码变化。

人工检查 Extension Development Host 时，请在 Host 中打开 Markdown 文件，确认命令面板中存在 **MD Image Uploader: Test Upload**，并通过 **Paste As...** 确认已注册 **Upload image with MD Image Uploader**。完整的真实粘贴测试还需要有效的 S3 和 CDN 配置。

### 构建并安装 Linux x64 VSIX

Marketplace 扩展 ID 为 `tungchiahui.md-image-uploader`。

本仓库已验证的打包目标是 Linux x64 桌面版 VS Code。执行以下命令构建 VSIX，并验证其中打包的 Sharp 运行时：

```bash
npm run test:vsix
```

命令会生成 `md-image-uploader-linux-x64.vsix`。在 VS Code 扩展视图中选择 **Install from VSIX...**，然后选择该文件。Sharp 包含平台相关的原生代码，因此其他桌面平台必须针对对应平台重新打包并验证后才能分发。

如果系统中可以使用 `code` 命令，还可以通过隔离的扩展目录验证生成的安装包：

```bash
npm run verify:installed-vsix
```

## 配置

所有设置都使用 `mdImageUploader` 命名空间。完整配置示例：

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

| 设置 | 必填 | 默认值 | 用途 |
| --- | --- | --- | --- |
| `mdImageUploader.enabled` | 否 | `true` | 是否为当前资源启用图片粘贴处理。 |
| `mdImageUploader.s3.endpoint` | 否 | 空 | 自定义 S3 兼容 HTTP(S) endpoint。留空时使用由 region 决定的 AWS endpoint。 |
| `mdImageUploader.s3.region` | 是 | 空 | AWS 或 S3 兼容服务的 region。 |
| `mdImageUploader.s3.bucket` | 是 | 空 | 目标 Bucket。 |
| `mdImageUploader.s3.accessKeyId` | 是 | 空 | S3 Access Key ID。 |
| `mdImageUploader.s3.secretAccessKey` | 是 | 空 | S3 Secret Access Key。 |
| `mdImageUploader.s3.forcePathStyle` | 否 | `false` | S3 兼容服务要求时启用 path-style 请求。 |
| `mdImageUploader.datedUploadPath` | 是 | `markdown` | Markdown 目录或文件名包含合法日期时使用的 Object Key 前缀。 |
| `mdImageUploader.undatedUploadPath` | 是 | `misc` | 目录和文件名均无合法日期时使用的 Object Key 前缀。 |
| `mdImageUploader.cdnUrl` | 是 | 空 | 插入 Markdown 时使用的公开 HTTP(S) 基础 URL，与 S3 endpoint 相互独立。 |
| `mdImageUploader.webp.quality` | 否 | `85` | WebP 质量，必须是 1–100 的整数。 |

V1 会将凭据作为普通 VS Code 设置保存。请把凭据放在 User Settings 中，切勿提交到共享的 `.vscode/settings.json`。

## 粘贴图片

1. 打开 Markdown 文档。
2. 复制受支持的图片、图片文件或截图。
3. 按 `Ctrl+V`（macOS 使用 `Cmd+V`）。
4. 等待 S3 `PutObject` 成功。

上传成功后，扩展会插入：

```md
![](https://cdn.example.com/path/image.webp)
```

图片转换或上传失败时不会插入 Markdown。普通文本粘贴不受影响。

如果其他扩展也提供图片粘贴操作，可以在 VS Code 设置中优先选择本扩展的 Paste Kind：

```json
{
  "editor.pasteAs.preferences": [
    "markdown.image.mdImageUploader"
  ]
}
```

也可以使用 **Paste As...**，然后选择 **Upload image with MD Image Uploader**。

粘贴进行时，扩展会在粘贴位置旁实时显示当前阶段：准备图片、转换
WebP、生成路径、上传和完成。文字会根据 VS Code 显示语言自动使用
English、简体中文或繁體中文。

如需查看详细诊断信息，打开 **查看 > 输出**，然后选择
**MD Image Uploader**。日志会记录阶段、Object Key、耗时和错误，但不会
记录 S3 凭据。

## 日期路由与 Object Key

每个 `YYYY-MM-DD` 候选值都会经过真实日历日期校验。优先级如下：

1. 从距离 Markdown 文件最近的父目录开始检查目录名。合法的目录日期使用 `datedUploadPath`，并且始终优先于文件名日期。
2. 所有父目录均无合法日期时，检查 Markdown basename。合法的文件名日期同样使用 `datedUploadPath`。
3. 目录和文件名均无合法日期时，使用 `undatedUploadPath` 和粘贴图片时的当前本地日期。

示例：

| Markdown 路径 | 路由与日期 |
| --- | --- |
| `wiki/2023-10-05-Cplusplus/article.md` | `datedUploadPath`，目录日期 `2023/10/05` |
| `docs/2025-05-20-project/2026-01-14-article.md` | `datedUploadPath`，使用目录日期 `2025/05/20` |
| `docs/2026-01-14-article.md` | `datedUploadPath`，文件名日期 `2026/01/14` |
| `docs/article.md` 于 2026-08-18 粘贴 | `undatedUploadPath`，日期 `2026/08/18` |

最终 Object Key 格式：

```text
<uploadPath>/<YYYY>/<MM>/<DD>/<timestamp>-<hash8>.webp
```

公开 URL 为 `<cdnUrl>/<objectKey>`。生成 URL 时会分别编码 Object Key 的每个 path segment，同时保留 `/` 分隔符。

## 多仓库与多根工作区

扩展使用当前 Markdown 文档的 URI 读取配置，因此遵循 VS Code 的正常优先级：User Settings、Workspace Settings、Workspace Folder Settings。

建议配置方式：

- 将凭据放在 User Settings 中。
- 将 Bucket、CDN URL 和上传路径放在各仓库的 Workspace Settings 中。
- 多根工作区中的不同仓库需要不同目标时，使用 Workspace Folder Settings。

例如，一个仓库可以将 `datedUploadPath` 设置为 `wiki`，另一个仓库设置为 `blog`，无需修改扩展或 Object Key 逻辑。

## 测试 S3 连接

打开 Markdown 文档，在命令面板中运行 **MD Image Uploader: Test Upload**。该命令会读取当前文档作用域内的 S3 设置，并上传一个内置的小型 WebP：

```text
md-image-uploader-test/<timestamp>.webp
```

该命令会执行真实的 S3 写入，但不会插入 Markdown，也不会测试 CDN 是否可以访问。

## 故障排查

### 没有选中图片粘贴操作

- 确认当前编辑器打开的是 Markdown 文档。
- 确认该文档作用域内的 `mdImageUploader.enabled` 为 `true`。
- 确认剪贴板中包含受支持的图片或图片文件。
- 将 `markdown.image.mdImageUploader` 添加到 `editor.pasteAs.preferences`，或通过 **Paste As...** 选择本扩展。

不支持的剪贴板内容会有意交给 VS Code 默认粘贴行为处理。

### `Missing setting "..."` 或 `Invalid setting "..."`

打开受影响 Markdown 文件对应作用域的设置，并补充错误中指出的配置项。`cdnUrl` 和自定义 `s3.endpoint` 必须是合法的 HTTP(S) URL，WebP 质量必须是 1–100 的整数。

### `Image conversion failed: Unsupported image format`

请使用 PNG、JPG/JPEG、GIF、WebP、AVIF 或 TIFF。SVG 和其他格式不属于 V1 支持范围。

### 其他 `Image conversion failed` 错误

剪贴板或文件中的图片字节可能损坏或不完整。请先用图片查看器打开源文件，重新导出为受支持格式，然后再次粘贴。

### `Upload failed: Network error`

检查 endpoint、DNS、网络或 VPN、Firewall、Proxy，以及 S3 兼容服务是否可访问。使用 AWS S3 时，除非确实需要自定义 endpoint，否则应将其留空。

### `Upload failed: Authentication or authorization error`

检查 Access Key、Secret Key、region、Bucket Policy，以及账号是否拥有对应 Object Key 前缀的 `s3:PutObject` 权限。同时检查凭据是否已过期或被禁用。

### 其他 `Upload failed` 错误

请根据界面显示的服务端原因排查。常见原因包括 Bucket 不存在、region 错误、`forcePathStyle` 设置不兼容、存储空间不足或服务端故障。上传失败后扩展不会插入不完整的 Markdown。

### 上传成功但 CDN URL 无法访问

`mdImageUploader.cdnUrl` 不会从 S3 endpoint 推导。请确认 CDN 已正确映射到所配置的 Bucket 和 Object Key 前缀，并且上传对象可以通过该 CDN 对外访问。

## 开发

运行项目的全部检查：

```bash
npm run lint
npm run check
npm test
```

`npm test` 会编译 TypeScript 源码并运行单元测试和集成测试，不会发起真实 S3 请求。
