# MD Image Uploader — VS Code 扩展开发规格书

## 1. 项目目标

开发一个 VS Code 桌面端扩展：

```text
MD Image Uploader
```

建议扩展 ID：

```text
md-image-uploader
```

配置 namespace：

```text
mdImageUploader
```

核心目标：

> 在 VS Code 编辑 Markdown 文件时，直接 `Ctrl+V` 粘贴图片，扩展自动将图片转换为 WebP、计算最终 WebP 的 SHA-256、按照“目录日期优先、文件名日期其次、当前本地日期 fallback”的规则决定 S3 Object Key、上传到 S3/S3-compatible 对象存储，并自动插入 CDN Markdown 图片链接。

最终体验：

```text
截图 / 浏览器复制图片 / 复制本地图片
                ↓
            Ctrl + V
                ↓
        MD Image Uploader
                ↓
         转换最终 WebP
                ↓
      SHA256(finalWebpBytes)
                ↓
          生成 Object Key
                ↓
              S3
                ↓
            CDN URL
                ↓
![](https://cdn.example.com/xxx.webp)
```

普通文字、代码、URL 的 `Ctrl+V` 必须保持 VS Code 原有行为。

---

# 2. 技术栈

使用：

```text
TypeScript
VS Code Extension API
sharp
Node.js crypto
@aws-sdk/client-s3
```

V1 仅目标：

```text
VS Code Desktop
```

不要求支持：

```text
vscode.dev
VS Code Web Extension
```

建议：

```json
{
  "engines": {
    "vscode": "^1.97.0"
  }
}
```

VS Code 已提供稳定的 `DocumentPasteEditProvider`，可以根据 MIME 类型参与粘贴，并让扩展返回自己的 Markdown 粘贴结果。Paste Provider 可以声明处理 `image/*` 和外部文件。citeturn366068view0turn597888search2

---

# 3. Ctrl+V 行为

## 3.1 图片

在 Markdown 编辑器：

```text
Ctrl+V 图片
```

触发：

```text
MD Image Uploader
```

完成：

```text
图片读取
→ WebP
→ SHA256
→ Object Key
→ S3
→ CDN
→ Markdown
```

## 3.2 普通文本

例如剪贴板：

```text
hello world
```

执行：

```text
Ctrl+V
```

结果必须仍然是：

```text
hello world
```

扩展不得截获普通文本。

## 3.3 代码

同样保持正常：

```cpp
int main() {}
```

不得触发上传逻辑。

---

# 4. Paste Provider

注册：

```ts
vscode.languages.registerDocumentPasteEditProvider(...)
```

目标语言：

```text
markdown
```

metadata 至少声明：

```text
image/*
files
```

VS Code 官方 API 支持在 `pasteMimeTypes` 中使用 `image/*`，也支持 `files` 处理从系统文件管理器复制进来的文件。citeturn366068view0

自定义 Paste Kind：

```text
markdown.image.mdImageUploader
```

例如：

```ts
const pasteKind =
    new vscode.DocumentDropOrPasteEditKind(
        'markdown.image.mdImageUploader'
    );
```

这样用户可以设置：

```json
{
  "editor.pasteAs.preferences": [
    "markdown.image.mdImageUploader"
  ]
}
```

VS Code 会按照 `editor.pasteAs.preferences` 中的顺序优先选择匹配的 Paste Edit Kind。citeturn597888search1

因此：

```text
图片 Ctrl+V
→ MD Image Uploader

文本 Ctrl+V
→ 普通粘贴
```

不要直接覆盖 `Ctrl+V` keybinding。

---

# 5. 图片输入格式

V1 必须支持：

```text
PNG
JPG
JPEG
GIF
WebP
AVIF
TIF
TIFF
```

对应常见 MIME：

```text
image/png
image/jpeg
image/gif
image/webp
image/avif
image/tiff
```

Sharp 官方支持 JPEG、PNG、WebP、AVIF、GIF、SVG、TIFF 等输入格式。citeturn959854search14

如果遇到：

```text
image/svg+xml
```

可以顺便支持 SVG → WebP，但 SVG 不作为 V1 强制验收项目。

不支持的图片格式：

```text
显示错误
不上传
不插入 Markdown
```

---

# 6. GIF 与动画图片

动态 GIF **必须尽量保留动画**。

不要：

```text
Animated GIF
→ 只取第一帧 WebP
```

应该：

```text
Animated GIF
→ Animated WebP
```

Sharp 支持：

```ts
sharp(input, {
    animated: true
})
```

读取所有动画帧，并支持输出 animated WebP。citeturn603758view0turn603758view1turn603758view2

建议处理：

```ts
const finalWebpBuffer = await sharp(inputBuffer, {
    animated: true
})
    .rotate()
    .webp({
        quality: config.webp.quality
    })
    .toBuffer();
```

实际实现可根据 Sharp 当前 API 调整。

验收要求：

```text
动态 GIF 上传后仍然可以播放动画。
```

---

# 7. WebP 规则

所有输入最终统一输出：

```text
.webp
```

配置：

```json
{
  "mdImageUploader.webp.quality": 85
}
```

默认：

```text
85
```

允许：

```text
1 ~ 100
```

转换完成后必须首先得到：

```ts
Buffer finalWebpBuffer
```

后续：

```text
SHA256
S3 PutObject
```

都必须基于这个 Buffer。

---

# 8. SHA-256 规则

这是强约束。

必须：

```text
原图
 ↓
Sharp 转换
 ↓
finalWebpBuffer
 ↓
SHA256(finalWebpBuffer)
 ↓
hex lowercase
 ↓
取前 8 位
```

实现：

```ts
const fullHash = crypto
    .createHash('sha256')
    .update(finalWebpBuffer)
    .digest('hex');

const hash8 = fullHash.slice(0, 8);
```

例如：

```text
SHA256:

a3f91c2e891234567890abcdef...
```

得到：

```text
hash8:

a3f91c2e
```

禁止：

```text
SHA256(originalPng)
SHA256(originalJpeg)
SHA256(originalGif)
SHA256(original filename)
```

S3 上传的 Body 必须就是参与 SHA-256 的：

```ts
finalWebpBuffer
```

即：

```text
SHA256 输入字节
      ║
      ║ 完全相同
      ▼
S3 PutObject Body
```

---

# 9. 文件名规则

统一：

```text
<Unix毫秒>-<hash8>.webp
```

例如：

```text
1787039123456-a3f91c2e.webp
```

Unix 毫秒：

```ts
Date.now()
```

建议一次 Paste 操作开始时只生成一次：

```ts
const now = new Date();
const timestamp = now.getTime();
```

后续 fallback 日期也使用同一个 `now`，避免跨午夜时当前本地日期目录和 timestamp 所属日期不一致。

原始文件名：

```text
C++变量示意图[最终版].png
```

不得进入 Object Key。

---

# 10. Markdown 日期识别

日期提取基于当前 Markdown 文件的：

```text
当前 Markdown 文件的 workspace-relative path
```

但不得把整个 path 当作一个字符串直接搜索。必须先分离：

```text
directory path
Markdown basename
```

并严格按照以下优先级处理：

```text
directory date
    ↓ 没找到
filename date
    ↓ 没找到
current local date + undatedUploadPath
```

## 10.1 第一优先级：Directory Date

只检查 Markdown 文件名之前的目录部分。

从距离当前 Markdown 文件最近的父级目录开始，逐级向上检查各级目录名称中的合法：

```text
YYYY-MM-DD
```

一旦某级目录中找到合法日期，就立即返回该日期，并将来源标记为：

```text
directory
```

后续 routing 必须使用 `datedUploadPath`。此时不得再用 Markdown 文件名中的日期覆盖它。

例如：

```text
wiki/2023-10-05-Cplusplus教学/0200-C++基础初识.md
```

识别：

```text
2023-10-05
```

如果多个不同层级的目录都包含合法日期，必须选择距离 Markdown 文件最近的那个目录日期。

例如：

```text
archive/2024-01-01/foo/2026-03-15-project/article.md
```

应识别：

```text
2026-03-15
```

而不是：

```text
2024-01-01
```

## 10.2 第二优先级：Filename Date

只有所有父级目录名称中都没有找到合法日期时，才允许检查当前 Markdown basename。

例如：

```text
docs/drivers/2026-01-14-W311MI_AX300驱动.md
```

应识别：

```text
2026-01-14
```

并将来源标记为：

```text
filename
```

后续 routing 必须使用 `datedUploadPath`。

如果目录和文件名同时包含合法日期，目录日期拥有绝对优先级。

例如：

```text
docs/2025-05-20-project/2026-01-14-W311MI_AX300驱动.md
```

必须识别：

```text
2025-05-20
source = directory
```

不得被文件名中的：

```text
2026-01-14
```

覆盖。

## 10.3 第三优先级：Current Local Date

如果目录部分和 Markdown basename 中都没有合法日期，则页面日期提取结果返回：

```text
undefined
```

该文档属于 undated document。后续 routing 必须使用：

```text
undatedUploadPath
+ 图片粘贴时的当前本地日期
```

当前本地日期不是页面日期提取结果，不得将其标记为 `directory` 或 `filename` 来源。

## 10.4 日期合法性

任何候选 `YYYY-MM-DD` 都必须进行真实日历日期校验，不能只依赖正则格式匹配。

例如：

```text
2024-02-29    合法
2023-02-29    非法
2026-13-01    非法
2026-04-31    非法
```

非法日期必须视为“未找到日期”，然后继续当前优先级内的查找或进入下一优先级。

例如：

```text
docs/2023-02-29-project/2026-01-14-test.md
```

目录日期非法，因此继续检查 filename，最终得到：

```text
2026-01-14
source = filename
```

## 10.5 日期提取结果

`dateRouter.ts` 应返回日期及其来源，建议结构：

```ts
type PageDateSource = 'directory' | 'filename';

interface PageDateMatch {
    date: {
        year: number;
        month: number;
        day: number;
    };
    source: PageDateSource;
}
```

如果目录和文件名均未找到合法日期：

```ts
undefined
```

---

# 11. 有日期 Markdown 的 Object Key

配置：

```text
mdImageUploader.datedUploadPath
```

例如：

```json
{
  "mdImageUploader.datedUploadPath": "wiki"
}
```

Markdown：

```text
wiki/2023-10-05-Cplusplus教学/0200-C++基础初识.md
```

页面日期可以来自 directory 或 filename。只要日期提取结果存在，就必须使用：

```text
mdImageUploader.datedUploadPath
```

如果两处都有合法日期，必须使用 directory date；filename date 不得覆盖它。

timestamp：

```text
1787039123456
```

hash：

```text
a3f91c2e
```

最终：

```text
wiki/2023/10/05/1787039123456-a3f91c2e.webp
```

公式：

```text
<datedUploadPath>
/
<pageYYYY>/<pageMM>/<pageDD>
/
<timestamp>-<hash8>.webp
```

---

# 12. 无日期 Markdown

例如：

```text
README.md
```

或者：

```text
docs/C++/变量.md
```

只有同时满足以下条件时，才属于无日期 Markdown：

```text
所有父级目录名称中没有合法 YYYY-MM-DD
当前 Markdown basename 中也没有合法 YYYY-MM-DD
```

此时 `dateRouter.ts` 返回 `undefined`，routing 走另一套路径：

```text
mdImageUploader.undatedUploadPath
```

日期使用：

```text
图片粘贴当天的本地日期
```

例如今天：

```text
2026-08-18
```

配置：

```json
{
  "mdImageUploader.undatedUploadPath": "misc"
}
```

结果：

```text
misc/2026/08/18/1787039123456-a3f91c2e.webp
```

公式：

```text
<undatedUploadPath>
/
<todayYYYY>/<todayMM>/<todayDD>
/
<timestamp>-<hash8>.webp
```

这里必须使用：

```text
本地日期
```

不要使用：

```text
UTC YYYY-MM-DD
```

否则 UTC 跨日时可能进入错误目录。

---

# 13. Upload Path 规范化

用户可能设置：

```text
/wiki/images/
```

扩展自动规范化为：

```text
wiki/images
```

用户可能设置：

```text
wiki//images/
```

也规范化。

最终 Object Key：

```text
禁止以 /
开头
```

禁止：

```text
/wiki//images//2026/08/18/xxx.webp
```

应该：

```text
wiki/images/2026/08/18/xxx.webp
```

建议实现一个独立函数：

```ts
joinObjectKey(...segments: string[]): string
```

不要直接到处拼字符串。

---

# 14. CDN URL

配置：

```text
mdImageUploader.cdnUrl
```

例如：

```text
https://cdn.sdutvincirobot.top
```

Object Key：

```text
wiki/2023/10/05/1787039123456-a3f91c2e.webp
```

得到：

```text
https://cdn.sdutvincirobot.top/wiki/2023/10/05/1787039123456-a3f91c2e.webp
```

公式：

```text
<cdnUrl>/<objectKey>
```

`cdnUrl` 自动去掉尾部 `/`。

Object Key 生成 URL 时：

- `/` 保留；
- 每个 path segment 单独进行 URL encoding；
- 中文、空格、`#`、`?` 等必须正确编码。

例如 Object Key：

```text
wiki images/中文/xxx.webp
```

URL 应合法编码。

---

# 15. Markdown 输出

V1 固定：

```md
![](https://cdn.example.com/path/image.webp)
```

默认不自动使用原始文件名作为 alt。

原因：

```text
原文件名可能很乱；
截图可能没有有效文件名；
保持输出稳定。
```

后续版本再考虑：

```text
自定义 alt
自动 alt
```

---

# 16. S3 配置

所有配置统一放 VS Code Settings。

建议：

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

  "mdImageUploader.webp.quality": 85,

  "editor.pasteAs.preferences": [
    "markdown.image.mdImageUploader"
  ]
}
```

V1 不使用：

```text
.env
SecretStorage
额外配置文件
```

配置统一由 VS Code Settings 管理。

注意：

```text
Access Key / Secret Key 为明文配置。
```

README 中明确提醒：

> 凭据推荐只放 User Settings，不要提交到共享仓库的 `.vscode/settings.json`。

---

# 17. 多仓库配置

这是必须支持的功能。

读取配置时必须根据：

```text
当前 Markdown document.uri
```

读取资源作用域配置：

```ts
vscode.workspace.getConfiguration(
    'mdImageUploader',
    document.uri
);
```

VS Code 的 `getConfiguration` 支持传入 resource scope，因此 Workspace / Workspace Folder 设置可以覆盖 User Settings。citeturn425554view0

例如 User Settings：

```json
{
  "mdImageUploader.s3.endpoint": "...",
  "mdImageUploader.s3.region": "...",
  "mdImageUploader.s3.bucket": "images",
  "mdImageUploader.s3.accessKeyId": "...",
  "mdImageUploader.s3.secretAccessKey": "...",

  "mdImageUploader.cdnUrl": "https://cdn.example.com",
  "mdImageUploader.webp.quality": 85
}
```

仓库 A：

```text
VinciWiki/.vscode/settings.json
```

```json
{
  "mdImageUploader.datedUploadPath": "vinci/wiki",
  "mdImageUploader.undatedUploadPath": "vinci/misc"
}
```

仓库 B：

```text
PersonalNotes/.vscode/settings.json
```

```json
{
  "mdImageUploader.datedUploadPath": "notes",
  "mdImageUploader.undatedUploadPath": "notes/misc"
}
```

结果：

```text
VinciWiki Ctrl+V
→ vinci/wiki/...

PersonalNotes Ctrl+V
→ notes/...
```

无需：

```text
切换 Profile
修改 .env
重新启动扩展
```

---

# 18. S3 上传

使用：

```ts
@aws-sdk/client-s3
```

大致：

```ts
const client = new S3Client({
    region,
    endpoint: endpoint || undefined,
    forcePathStyle,
    credentials: {
        accessKeyId,
        secretAccessKey
    }
});
```

上传：

```ts
await client.send(
    new PutObjectCommand({
        Bucket: bucket,
        Key: objectKey,
        Body: finalWebpBuffer,
        ContentType: 'image/webp'
    })
);
```

不要根据 S3 Endpoint 推导 CDN URL。

必须完全独立：

```text
endpoint
→ 负责 API 上传

bucket
→ 负责 Bucket

Object Key
→ 负责对象路径

cdnUrl
→ 负责 Markdown URL
```

---

# 19. Paste Provider 的推荐两阶段设计

不要在 Paste Provider 一开始就立刻上传 S3。

推荐：

```text
provideDocumentPasteEdits()
        ↓
读取 DataTransfer 图片字节到 Buffer
        ↓
返回 MD Image Uploader PasteEdit
        ↓
resolveDocumentPasteEdit()
        ↓
WebP 转换
        ↓
Hash
        ↓
S3
        ↓
生成最终 insertText
```

原因：

VS Code 官方说明 `DataTransfer` 只保证在 paste provider 调用期间有效，因此需要先把图片数据复制出来；而 `resolveDocumentPasteEdit` 适合处理较慢的完整 Paste Edit，并允许修改最终 `insertText`。citeturn366068view0

可以自定义：

```ts
class ImagePasteEdit extends vscode.DocumentPasteEdit {
    inputBuffer: Buffer;
    mimeType: string;
}
```

具体实现方式可以由 Codex根据 TypeScript 类型系统调整。

---

# 20. 上传成功与失败

只有：

```text
S3 PutObject 成功
```

以后才允许返回：

```md
![](https://...)
```

上传失败：

```text
不插入错误 URL
不插入半成品 Markdown
```

显示：

```text
MD Image Uploader: Upload failed: <reason>
```

转换失败：

```text
MD Image Uploader: Image conversion failed: <reason>
```

配置缺失：

例如：

```text
bucket 为空
cdnUrl 为空
secretAccessKey 为空
```

显示明确错误：

```text
MD Image Uploader: Missing setting "s3.bucket"
```

不要吞异常。

---

# 21. 不支持图片时

如果剪贴板不是支持的图片：

```text
return undefined / []
```

让 VS Code 继续默认 Ctrl+V。

这是关键原则：

> MD Image Uploader 只在确认自己能处理图片时参与粘贴。

---

# 22. 多图片

V1 可以只处理：

```text
一次 Paste 中的第一张有效图片
```

避免第一版复杂化。

但代码结构不要写死，未来应能扩展：

```text
一次复制 5 张图片
→ 上传 5 张
→ 插入 5 行 Markdown
```

多图属于 V2，不作为 V1 验收要求。

---

# 23. 建议代码结构

```text
md-image-uploader/
├── package.json
├── tsconfig.json
├── README.md
├── src/
│   ├── extension.ts
│   ├── pasteProvider.ts
│   ├── config.ts
│   ├── imageConverter.ts
│   ├── hash.ts
│   ├── dateRouter.ts
│   ├── objectKey.ts
│   ├── s3Uploader.ts
│   └── url.ts
│
└── test/
    ├── dateRouter.test.ts
    ├── objectKey.test.ts
    ├── hash.test.ts
    ├── url.test.ts
    ├── imageConverter.test.ts
    └── integration/
```

不要把所有代码写进：

```text
extension.ts
```

---

# 24. 模块职责

## `config.ts`

负责：

```text
读取 VS Code Settings
校验必填配置
根据 document.uri 读取 Workspace Override
```

---

## `imageConverter.ts`

负责：

```text
输入任意受支持图片 Buffer
→ finalWebpBuffer
```

不得：

```text
负责 S3
负责命名
负责 Markdown
```

---

## `hash.ts`

负责：

```text
SHA256(Buffer)
hash8
```

---

## `dateRouter.ts`

负责：

```text
当前 Markdown workspace-relative path
→ 先从 directory path 中提取距离文件最近的合法日期
→ directory 未找到时，再从 Markdown basename 中提取合法日期
→ 返回 PageDateMatch { date, source: 'directory' | 'filename' }
→ directory / filename 均未找到时返回 undefined
```

`dateRouter.ts` 必须执行真实日历日期校验。当前本地日期 fallback 属于后续 routing，不得伪装成页面日期匹配结果。

---

## `objectKey.ts`

负责：

```text
datedUploadPath / undatedUploadPath
日期
timestamp
hash8
→ Object Key
```

---

## `s3Uploader.ts`

负责：

```text
S3Client
PutObject
```

---

## `url.ts`

负责：

```text
cdnUrl + objectKey
→ 合法 CDN URL
```

---

## `pasteProvider.ts`

负责整个 orchestration：

```text
Clipboard
→ converter
→ hash
→ routing
→ uploader
→ Markdown PasteEdit
```

---

# 25. 开发任务拆分

不要让 Codex 一次完成整个项目。

建议按照以下阶段开发。

## Task 1 — 初始化扩展

完成：

```text
TypeScript VS Code Extension
package.json
tsconfig
activation
基本 README
```

要求：

```text
F5 可以启动 Extension Development Host
```

此阶段不要写 S3。

---

## Task 2 — 配置系统

实现所有：

```text
mdImageUploader.*
```

配置。

完成：

```text
User Settings
Workspace Settings
Workspace Folder Override
document.uri scoped config
配置验证
```

写单元测试。

---

## Task 3 — 日期与 Object Key

实现：

```text
从 directory path 提取距离 Markdown 最近的合法日期
directory 未找到时从 Markdown basename 提取合法日期
返回 date + source(directory | filename)
真实日历日期合法性校验
未找到页面日期时返回 undefined
undefined 时使用当前本地日期与 undatedUploadPath
dated / undated routing
path normalization
timestamp
Object Key
```

必须大量写单测，并明确验证：

```text
directory date 优先于 filename date
多个 directory date 选择距离 Markdown 最近的目录
非法 directory date 不阻止合法 filename date fallback
directory / filename 均无日期时使用本地日期和 undatedUploadPath
```

---

## Task 4 — WebP 与 SHA256

实现：

```text
PNG → WebP
JPEG → WebP
WebP → WebP
GIF → Animated WebP
AVIF → WebP
TIFF → WebP

SHA256(finalWebpBuffer)
hash8
```

确保：

```text
hash 输入 === 实际上传 Buffer
```

---

## Task 5 — S3

实现：

```text
S3Client
custom endpoint
region
bucket
credentials
forcePathStyle
PutObject
Content-Type
错误处理
```

暂时用单独命令：

```text
MD Image Uploader: Test Upload
```

测试上传，不接 Ctrl+V。

---

## Task 6 — Paste Provider

实现：

```text
Markdown Ctrl+V 图片
```

要求：

```text
image/*
files
```

文本粘贴完全正常。

Paste Kind：

```text
markdown.image.mdImageUploader
```

---

## Task 7 — 完整串联

```text
Ctrl+V
→ WebP
→ Hash
→ Routing
→ Object Key
→ S3
→ CDN
→ Markdown
```

完成最终流程。

---

## Task 8 — 错误处理与 README

完善：

```text
配置缺失
图片格式错误
WebP 转换错误
S3 网络错误
鉴权错误
上传失败
```

补完整 README。

---

## Task 9 — VSIX 打包

确保：

```text
sharp
```

在实际打包后的扩展中仍然正常工作。

必须测试：

```text
Extension Development Host 正常
VSIX 安装后也正常
```

V1 优先保证桌面版正常，不要求 Web Extension。

---

# 26. 单元测试

## 日期测试

### Case 1 — Directory Date

输入：

```text
wiki/2023-10-05-Cplusplus教学/0200-C++基础初识.md
```

预期：

```text
2023-10-05
source = directory
```

### Case 2 — Filename Date

输入：

```text
docs/drivers/2026-01-14-W311MI_AX300驱动.md
```

预期：

```text
2026-01-14
source = filename
```

### Case 3 — Directory 优先于 Filename

输入：

```text
docs/2025-05-20-project/2026-01-14-W311MI_AX300驱动.md
```

预期：

```text
2025-05-20
source = directory
```

说明：directory date 优先于 filename date。

### Case 4 — 最近的 Directory Date

输入：

```text
archive/2024-01-01/foo/2026-03-15-project/article.md
```

预期：

```text
2026-03-15
source = directory
```

说明：多个 directory date 时，选择距离 Markdown 文件最近的目录。

### Case 5 — Undated Document

输入：

```text
docs/drivers/W311MI_AX300驱动.md
```

预期：

```text
undefined
```

后续 routing 必须使用：

```text
undatedUploadPath + 图片粘贴时的当前本地日期
```

### Case 6 — 非法 Directory Date 后检查 Filename

输入：

```text
docs/2023-02-29-project/2026-01-14-test.md
```

其中：

```text
2023-02-29 非法
```

预期：

```text
2026-01-14
source = filename
```

### Case 7 — 合法闰日 Directory Date

输入：

```text
docs/2024-02-29-project/test.md
```

预期：

```text
2024-02-29
source = directory
```

另外必须覆盖以下非法日期：

```text
2026-13-01
2026-04-31
```

它们必须视为未找到，并继续下一优先级。

---

# 27. Object Key 测试

Object Key routing 必须使用 `dateRouter.ts` 已经按优先级选定的页面日期。Object Key 层不得重新扫描整个 path，也不得让 filename date 覆盖 directory date。

输入：

```text
datedUploadPath = wiki
pageDate = 2023-10-05
timestamp = 1787039123456
hash8 = a3f91c2e
```

必须严格得到：

```text
wiki/2023/10/05/1787039123456-a3f91c2e.webp
```

---

输入：

```text
datedUploadPath = /wiki/images/
```

必须得到：

```text
wiki/images/2023/10/05/1787039123456-a3f91c2e.webp
```

不能：

```text
/wiki/images//2023/...
```

---

Filename date routing：

```text
Markdown = docs/drivers/2026-01-14-W311MI_AX300驱动.md
datedUploadPath = wiki
timestamp = 1787039123456
hash8 = a3f91c2e
```

必须得到：

```text
wiki/2026/01/14/1787039123456-a3f91c2e.webp
```

---

Undated routing：

```text
Markdown = docs/drivers/W311MI_AX300驱动.md
pageDate = undefined
undatedUploadPath = misc
current local date = 2026-08-18
timestamp = 1787039123456
hash8 = a3f91c2e
```

必须得到：

```text
misc/2026/08/18/1787039123456-a3f91c2e.webp
```

---

# 28. SHA 测试

测试图片：

```text
test.png
```

执行：

```text
finalWebpBuffer = convert(test.png)
hash = SHA256(finalWebpBuffer)
```

再把 Buffer 保存：

```text
test-output.webp
```

命令行：

```bash
sha256sum test-output.webp
```

必须和程序计算出的完整 SHA-256：

```text
100% 一致
```

然后检查文件名：

```text
<timestamp>-<SHA256前8位>.webp
```

---

# 29. GIF 测试

准备：

```text
animated.gif
```

至少：

```text
3 帧
```

Ctrl+V 后：

```text
animated.gif
→ S3 xxx.webp
```

浏览器打开 CDN URL。

必须确认：

```text
仍然有动画
不是第一帧静态图
```

---

# 30. Ctrl+V 测试

## Case A

复制文字：

```text
hello
```

Ctrl+V：

```text
hello
```

不得上传任何 S3 Object。

---

## Case B

复制：

```text
test.png
```

Ctrl+V：

```md
![](https://cdn.example.com/...)
```

---

## Case C

截图工具截图：

```text
截图
Ctrl+V
```

必须上传。

---

## Case D

浏览器：

```text
右键图片
复制图片
Ctrl+V
```

必须上传。

---

## Case E

本地文件管理器：

```text
复制 xxx.jpg
Ctrl+V
```

必须上传。

---

# 31. Workspace Override 测试

User：

```json
{
  "mdImageUploader.datedUploadPath": "default"
}
```

仓库 A：

```json
{
  "mdImageUploader.datedUploadPath": "repo-a"
}
```

仓库 B：

```json
{
  "mdImageUploader.datedUploadPath": "repo-b"
}
```

在 A：

```text
Ctrl+V
```

必须：

```text
repo-a/...
```

在 B：

```text
Ctrl+V
```

必须：

```text
repo-b/...
```

---

# 32. S3 实际测试

准备一个测试 Bucket。

执行上传后确认：

### Object Key

完全符合：

```text
<uploadPath>/<YYYY>/<MM>/<DD>/<timestamp>-<hash8>.webp
```

### Content-Type

必须：

```text
image/webp
```

### 文件内容

下载 S3 对象：

```bash
sha256sum downloaded.webp
```

必须等于上传前：

```text
SHA256(finalWebpBuffer)
```

这一步非常重要。

它证明：

```text
哈希计算的 WebP
=
实际上传的 WebP
```

---

# 33. CDN 测试

访问：

```text
<cdnUrl>/<objectKey>
```

确认：

```text
HTTP 200
Content-Type image/webp
浏览器正常显示
```

GIF 转 WebP：

```text
浏览器正常播放动画
```

---

# 34. 最终人工验收流程

准备：

```text
repo-a/
└── docs/
    └── 2023-10-05-Cplusplus教学/
        └── 0200-C++基础初识.md
```

Workspace：

```json
{
  "mdImageUploader.datedUploadPath": "wiki",
  "mdImageUploader.undatedUploadPath": "misc"
}
```

打开：

```text
0200-C++基础初识.md
```

复制：

```text
C++变量示意图[最终版].png
```

Ctrl+V。

假设：

```text
timestamp:
1787039123456

finalWebp SHA256:
a3f91c2e891234567890abcdef...
```

S3 必须出现：

```text
wiki/2023/10/05/1787039123456-a3f91c2e.webp
```

Markdown 必须出现：

```md
![](https://cdn.example.com/wiki/2023/10/05/1787039123456-a3f91c2e.webp)
```

然后打开：

```text
README.md
```

当天：

```text
2026-08-18
```

再次 Ctrl+V 图片。

必须：

```text
misc/2026/08/18/<timestamp>-<hash8>.webp
```

还必须人工检查 filename fallback。打开：

```text
docs/drivers/2026-01-14-W311MI_AX300驱动.md
```

在所有父级目录均无日期时，必须生成：

```text
wiki/2026/01/14/<timestamp>-<hash8>.webp
```

再检查 directory 优先级。打开：

```text
docs/2025-05-20-project/2026-01-14-W311MI_AX300驱动.md
```

必须使用 directory date：

```text
wiki/2025/05/20/<timestamp>-<hash8>.webp
```

不得使用 filename date 生成：

```text
wiki/2026/01/14/<timestamp>-<hash8>.webp
```

最后检查普通文本：

```text
Ctrl+C "hello"
Ctrl+V
```

必须只得到：

```text
hello
```

---

# 35. V1 完成标准

只有以下全部满足才认为 V1 完成：

- Markdown 中直接 `Ctrl+V` 图片可以上传。
- 普通文字 `Ctrl+V` 完全不受影响。
- PNG/JPG/JPEG/GIF/WebP/AVIF/TIFF 可处理。
- 动态 GIF 转换后仍保持动画。
- 最终输出统一 `.webp`。
- SHA-256 基于最终 WebP 字节。
- SHA-256 使用小写 hex。
- 文件名使用 hash 前 8 位。
- 原文件名不进入 Object Key。
- 页面日期按 directory date 优先、filename date 其次的顺序提取。
- 多个 directory date 使用距离 Markdown 文件最近的目录日期。
- directory date 存在时不得被 filename date 覆盖。
- 所有 `YYYY-MM-DD` 候选都经过真实日历日期校验。
- directory / filename 均无合法日期时使用 undatedUploadPath 与当前本地日期。
- datedUploadPath 与 undatedUploadPath 独立配置。
- User Settings 可以被 Workspace Settings 覆盖。
- 不同仓库可以拥有不同 Upload Path。
- S3 Endpoint / Region / Bucket / Credentials 可配置。
- CDN URL 独立配置。
- CDN URL 不从 S3 Endpoint 推导。
- S3 上传 Body 与 SHA-256 输入 Buffer 完全一致。
- 上传失败时不插入 Markdown。
- VSIX 安装后 Sharp 仍正常工作。
- README 包含安装、配置、Ctrl+V、多仓库和故障排查说明。

---

# 36. 给 Codex 的执行要求

请不要一次性实现整个项目。

严格按照：

```text
Task 1
→ 测试
→ Task 2
→ 测试
→ Task 3
→ 测试
...
```

逐步开发。

每个 Task 完成后：

1. 说明修改了哪些文件；
2. 说明核心实现；
3. 运行 lint / TypeScript compile / unit tests；
4. 报告测试结果；
5. 不要在已有测试失败的情况下继续下一阶段。

优先：

```text
正确性
可测试性
模块化
```

而不是：

```text
把所有逻辑快速塞进 extension.ts
```

特别禁止：

```text
先 hash 原图片再转 WebP
```

必须始终保证：

```text
finalWebpBuffer
      ├── SHA256
      └── S3 PutObject Body
```

两处使用完全相同的字节。
