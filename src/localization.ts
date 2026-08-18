import type { PasteProgressStage } from './progress';

const englishMessages = {
  progressPreparing: 'MD Image Uploader: Preparing pasted image…',
  progressConverting: 'MD Image Uploader: Converting image to WebP…',
  progressRouting: 'MD Image Uploader: Building upload path…',
  progressUploading: 'MD Image Uploader: Uploading to object storage…',
  progressComplete: 'MD Image Uploader: Upload complete',
  progressFailed: 'MD Image Uploader: Upload failed',
  logActivated: 'Extension activated. Output logging is ready.',
  logPasteStarted:
    'Paste started: document={0}, mimeType={1}, inputBytes={2}.',
  logPasteStage: 'Paste stage: {0}.',
  logPasteUploading: 'Paste stage: {0}; objectKey={1}.',
  logPasteSucceeded: 'Paste succeeded in {0} ms: objectKey={1}.',
  logPasteFailed: 'Paste failed in {0} ms: {1}',
  logTestStarted: 'Test upload started: bucket={0}, objectKey={1}.',
  logTestSucceeded: 'Test upload succeeded in {0} ms.',
  logTestFailed: 'Test upload failed in {0} ms: {1}',
} as const;

export type MessageKey = keyof typeof englishMessages;
export type Translate = (
  key: MessageKey,
  ...values: readonly (string | number)[]
) => string;

const simplifiedChineseMessages: Record<MessageKey, string> = {
  progressPreparing: 'MD Image Uploader：正在准备粘贴的图片…',
  progressConverting: 'MD Image Uploader：正在将图片转换为 WebP…',
  progressRouting: 'MD Image Uploader：正在生成上传路径…',
  progressUploading: 'MD Image Uploader：正在上传到对象存储…',
  progressComplete: 'MD Image Uploader：上传完成',
  progressFailed: 'MD Image Uploader：上传失败',
  logActivated: '扩展已激活，Output 日志已就绪。',
  logPasteStarted: '开始粘贴：文档={0}，MIME 类型={1}，输入字节数={2}。',
  logPasteStage: '粘贴阶段：{0}。',
  logPasteUploading: '粘贴阶段：{0}；对象路径={1}。',
  logPasteSucceeded: '粘贴成功，耗时 {0} 毫秒：对象路径={1}。',
  logPasteFailed: '粘贴失败，耗时 {0} 毫秒：{1}',
  logTestStarted: '开始测试上传：存储桶={0}，对象路径={1}。',
  logTestSucceeded: '测试上传成功，耗时 {0} 毫秒。',
  logTestFailed: '测试上传失败，耗时 {0} 毫秒：{1}',
};

const traditionalChineseMessages: Record<MessageKey, string> = {
  progressPreparing: 'MD Image Uploader：正在準備貼上的圖片…',
  progressConverting: 'MD Image Uploader：正在將圖片轉換為 WebP…',
  progressRouting: 'MD Image Uploader：正在產生上傳路徑…',
  progressUploading: 'MD Image Uploader：正在上傳至物件儲存空間…',
  progressComplete: 'MD Image Uploader：上傳完成',
  progressFailed: 'MD Image Uploader：上傳失敗',
  logActivated: '擴充功能已啟用，Output 日誌已就緒。',
  logPasteStarted: '開始貼上：文件={0}，MIME 類型={1}，輸入位元組數={2}。',
  logPasteStage: '貼上階段：{0}。',
  logPasteUploading: '貼上階段：{0}；物件路徑={1}。',
  logPasteSucceeded: '貼上成功，耗時 {0} 毫秒：物件路徑={1}。',
  logPasteFailed: '貼上失敗，耗時 {0} 毫秒：{1}',
  logTestStarted: '開始測試上傳：儲存貯體={0}，物件路徑={1}。',
  logTestSucceeded: '測試上傳成功，耗時 {0} 毫秒。',
  logTestFailed: '測試上傳失敗，耗時 {0} 毫秒：{1}',
};

export function createTranslator(language: string): Translate {
  const normalizedLanguage = language.trim().toLowerCase();
  const messages = isTraditionalChinese(normalizedLanguage)
    ? traditionalChineseMessages
    : normalizedLanguage.startsWith('zh')
      ? simplifiedChineseMessages
      : englishMessages;

  return (key, ...values) => formatMessage(messages[key], values);
}

export function translateProgressStage(
  translate: Translate,
  stage: PasteProgressStage,
): string {
  switch (stage) {
    case 'preparing':
      return translate('progressPreparing');
    case 'converting':
      return translate('progressConverting');
    case 'routing':
      return translate('progressRouting');
    case 'uploading':
      return translate('progressUploading');
  }
}

function isTraditionalChinese(language: string): boolean {
  return (
    language.startsWith('zh-tw') ||
    language.startsWith('zh-hk') ||
    language.startsWith('zh-mo') ||
    language.includes('hant')
  );
}

function formatMessage(
  template: string,
  values: readonly (string | number)[],
): string {
  return template.replaceAll(/\{(\d+)\}/g, (placeholder, indexText) => {
    const value = values[Number(indexText)];
    return value === undefined ? placeholder : String(value);
  });
}
