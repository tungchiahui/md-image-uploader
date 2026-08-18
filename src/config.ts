import type * as vscode from 'vscode';

export const CONFIG_NAMESPACE = 'mdImageUploader';

export interface S3Config {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
}

export interface WebpConfig {
  quality: number;
}

export interface MdImageUploaderConfig {
  enabled: boolean;
  s3: S3Config;
  datedUploadPath: string;
  undatedUploadPath: string;
  cdnUrl: string;
  webp: WebpConfig;
}

export type WorkspaceConfigurationSource = Pick<
  typeof vscode.workspace,
  'getConfiguration'
>;

export class ConfigValidationError extends Error {
  public readonly setting: string;

  public constructor(setting: string, reason?: string) {
    super(
      reason === undefined
        ? `Missing setting "${setting}"`
        : `Invalid setting "${setting}": ${reason}`,
    );
    this.name = 'ConfigValidationError';
    this.setting = setting;
  }
}

export function readConfig(
  documentUri: vscode.Uri,
  workspace: WorkspaceConfigurationSource,
): MdImageUploaderConfig {
  const configuration = workspace.getConfiguration(
    CONFIG_NAMESPACE,
    documentUri,
  );

  return {
    enabled: configuration.get<boolean>('enabled', true),
    s3: {
      endpoint: configuration.get<string>('s3.endpoint', ''),
      region: configuration.get<string>('s3.region', ''),
      bucket: configuration.get<string>('s3.bucket', ''),
      accessKeyId: configuration.get<string>('s3.accessKeyId', ''),
      secretAccessKey: configuration.get<string>('s3.secretAccessKey', ''),
      forcePathStyle: configuration.get<boolean>('s3.forcePathStyle', false),
    },
    datedUploadPath: configuration.get<string>(
      'datedUploadPath',
      'markdown',
    ),
    undatedUploadPath: configuration.get<string>(
      'undatedUploadPath',
      'misc',
    ),
    cdnUrl: configuration.get<string>('cdnUrl', ''),
    webp: {
      quality: configuration.get<number>('webp.quality', 85),
    },
  };
}

export function validateConfig(
  config: MdImageUploaderConfig,
): MdImageUploaderConfig {
  if (!config.enabled) {
    return config;
  }

  validateS3Config(config.s3);
  requireNonEmptyString('datedUploadPath', config.datedUploadPath);
  requireNonEmptyString('undatedUploadPath', config.undatedUploadPath);
  requireNonEmptyString('cdnUrl', config.cdnUrl);

  requireHttpUrl('cdnUrl', config.cdnUrl);

  if (
    !Number.isInteger(config.webp.quality) ||
    config.webp.quality < 1 ||
    config.webp.quality > 100
  ) {
    throw new ConfigValidationError(
      'webp.quality',
      'expected an integer from 1 to 100',
    );
  }

  return config;
}

export function validateS3Config(config: S3Config): S3Config {
  requireNonEmptyString('s3.region', config.region);
  requireNonEmptyString('s3.bucket', config.bucket);
  requireNonEmptyString('s3.accessKeyId', config.accessKeyId);
  requireNonEmptyString('s3.secretAccessKey', config.secretAccessKey);

  if (config.endpoint.trim().length > 0) {
    requireHttpUrl('s3.endpoint', config.endpoint);
  }

  return config;
}

export function getValidatedConfig(
  documentUri: vscode.Uri,
  workspace: WorkspaceConfigurationSource,
): MdImageUploaderConfig {
  return validateConfig(readConfig(documentUri, workspace));
}

function requireNonEmptyString(setting: string, value: unknown): void {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ConfigValidationError(setting);
  }
}

function requireHttpUrl(setting: string, value: string): void {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new ConfigValidationError(setting, 'expected a valid HTTP or HTTPS URL');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new ConfigValidationError(setting, 'expected a valid HTTP or HTTPS URL');
  }
}
