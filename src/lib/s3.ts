/**
 * Storage abstraction layer — supports local filesystem, S3, MinIO, and GCS.
 *
 * Configuration via environment variables:
 *   STORAGE_PROVIDER: "local" | "s3" | "minio" | "gcs" (default: "local")
 *   S3_BUCKET, S3_REGION, S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY
 *   S3_PUBLIC_URL — CDN or public-facing base URL
 *   S3_FORCE_PATH_STYLE — force path-style URLs (required for MinIO)
 *   S3_MAX_FILE_SIZE — max upload size in bytes (default: 50MB)
 *   S3_ACL — object ACL (private, public-read, etc.)
 *   GCS_BUCKET, GCS_PROJECT_ID, GCS_KEY_FILE — Google Cloud Storage
 *   LOCAL_UPLOAD_DIR — local upload directory (default: "./uploads")
 */

export type StorageProvider = 'local' | 's3' | 'minio' | 'gcs';

let s3Client: any = null;
let PutObjectCommand: any = null;
let GetObjectCommand: any = null;
let HeadBucketCommand: any = null;
let CreateBucketCommand: any = null;
let getSignedUrl: any = null;
let sdkAvailable = false;

async function dynamicImport(module: string): Promise<any> {
  return new Function('m', 'return import(m)')(module);
}

export function getStorageProvider(): StorageProvider {
  const provider = (process.env.STORAGE_PROVIDER || '').toLowerCase();
  if (provider === 's3' || provider === 'minio' || provider === 'gcs') return provider;
  // Auto-detect from env vars
  if (process.env.S3_ENDPOINT?.includes('minio') || process.env.S3_FORCE_PATH_STYLE === 'true') return 'minio';
  if (process.env.GCS_BUCKET) return 'gcs';
  if (process.env.S3_BUCKET && process.env.S3_ACCESS_KEY) return 's3';
  return 'local';
}

export function getStorageConfig() {
  const provider = getStorageProvider();
  return {
    provider,
    bucket: process.env.S3_BUCKET || process.env.GCS_BUCKET || '',
    region: process.env.S3_REGION || 'us-east-1',
    endpoint: process.env.S3_ENDPOINT || '',
    accessKey: process.env.S3_ACCESS_KEY || '',
    secretKey: process.env.S3_SECRET_KEY || '',
    publicUrl: process.env.S3_PUBLIC_URL || '',
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true' || provider === 'minio',
    acl: process.env.S3_ACL || 'private',
    maxFileSize: parseInt(process.env.S3_MAX_FILE_SIZE || String(50 * 1024 * 1024)), // 50MB default
    localUploadDir: process.env.LOCAL_UPLOAD_DIR || './uploads',
    gcsProjectId: process.env.GCS_PROJECT_ID || '',
    gcsKeyFile: process.env.GCS_KEY_FILE || '',
  };
}

async function loadSdk(): Promise<boolean> {
  if (sdkAvailable) return true;
  const provider = getStorageProvider();

  if (provider === 'local') return false; // no SDK needed

  try {
    if (provider === 'gcs') {
      const gcsModule = await dynamicImport('@google-cloud/storage');
      const config = getStorageConfig();
      const gcs = new gcsModule.Storage({
        projectId: config.gcsProjectId,
        keyFilename: config.gcsKeyFile || undefined,
      });
      s3Client = gcs.bucket(config.bucket);
      sdkAvailable = true;
      return true;
    }

    // S3 / MinIO (AWS SDK)
    const s3Module = await dynamicImport('@aws-sdk/client-s3');
    const presignerModule = await dynamicImport('@aws-sdk/s3-request-presigner');
    const config = getStorageConfig();

    s3Client = new s3Module.S3Client({
      region: config.region,
      endpoint: config.endpoint || undefined,
      forcePathStyle: config.forcePathStyle,
      credentials: {
        accessKeyId: config.accessKey,
        secretAccessKey: config.secretKey,
      },
    });
    PutObjectCommand = s3Module.PutObjectCommand;
    GetObjectCommand = s3Module.GetObjectCommand;
    HeadBucketCommand = s3Module.HeadBucketCommand;
    CreateBucketCommand = s3Module.CreateCommand;
    getSignedUrl = presignerModule.getSignedUrl;
    sdkAvailable = true;
    return true;
  } catch (err) {
    console.error('[Storage] SDK load failed:', err);
    return false;
  }
}

export function isS3Configured(): boolean {
  const provider = getStorageProvider();
  if (provider === 'local') return false;
  if (provider === 'gcs') return !!(process.env.GCS_BUCKET);
  return !!(process.env.S3_BUCKET && process.env.S3_ACCESS_KEY && process.env.S3_SECRET_KEY);
}

export function isStorageConfigured(): boolean {
  return getStorageProvider() !== 'local' || true; // local is always "configured"
}

export async function ensureBucket(): Promise<void> {
  const provider = getStorageProvider();
  if (provider === 'local') return;

  if (!(await loadSdk())) return;
  const config = getStorageConfig();

  try {
    if (provider === 'gcs') {
      const [exists] = await s3Client.exists();
      if (!exists) await s3Client.create();
      return;
    }
    await s3Client.send(new HeadBucketCommand({ Bucket: config.bucket }));
  } catch {
    try {
      if (provider !== 'gcs') {
        await s3Client.send(new CreateBucketCommand({ Bucket: config.bucket }));
      }
    } catch (err) {
      console.error('[Storage] Failed to create bucket:', err);
    }
  }
}

function getPublicUrl(key: string): string {
  const config = getStorageConfig();
  if (config.publicUrl) return `${config.publicUrl}/${key}`;
  if (config.endpoint) return `${config.endpoint}/${config.bucket}/${key}`;
  return `https://${config.bucket}.s3.${config.region}.amazonaws.com/${key}`;
}

// ─── Upload ─────────────────────────────────────────────────────────────────

export async function uploadToS3(key: string, body: Buffer, contentType: string): Promise<string> {
  const provider = getStorageProvider();

  if (provider === 'local') {
    const { writeFile, mkdir } = await import('fs/promises');
    const path = await import('path');
    const config = getStorageConfig();
    const filePath = path.join(config.localUploadDir, key);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, body);
    return `/uploads/${key}`;
  }

  if (provider === 'gcs') {
    if (!(await loadSdk())) throw new Error('GCS not configured');
    const config = getStorageConfig();
    const file = s3Client.file(key);
    await file.save(body, {
      contentType,
      metadata: { 'cache-control': 'public, max-age=31536000' },
    });
    return getPublicUrl(key);
  }

  // S3 / MinIO
  if (!(await loadSdk())) throw new Error('S3/MinIO not configured');
  const config = getStorageConfig();
  const putOpts: any = {
    Bucket: config.bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
  };
  if (config.acl) putOpts.ACL = config.acl;
  await s3Client.send(new PutObjectCommand(putOpts));
  return getPublicUrl(key);
}

// ─── Download ───────────────────────────────────────────────────────────────

export async function downloadFromS3(key: string): Promise<Buffer> {
  const provider = getStorageProvider();

  if (provider === 'local') {
    const { readFile } = await import('fs/promises');
    const path = await import('path');
    const config = getStorageConfig();
    return readFile(path.join(config.localUploadDir, key));
  }

  if (provider === 'gcs') {
    if (!(await loadSdk())) throw new Error('GCS not configured');
    const file = s3Client.file(key);
    const [buffer] = await file.download();
    return Buffer.from(buffer);
  }

  if (!(await loadSdk())) throw new Error('S3/MinIO not configured');
  const config = getStorageConfig();
  const response = await s3Client.send(new GetObjectCommand({
    Bucket: config.bucket,
    Key: key,
  }));
  const chunks: Uint8Array[] = [];
  for await (const chunk of response.Body) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

// ─── Delete ─────────────────────────────────────────────────────────────────

export async function deleteFromS3(key: string): Promise<void> {
  const provider = getStorageProvider();

  if (provider === 'local') {
    const { unlink } = await import('fs/promises');
    const path = await import('path');
    const config = getStorageConfig();
    await unlink(path.join(config.localUploadDir, key)).catch(() => {});
    return;
  }

  if (provider === 'gcs') {
    if (!(await loadSdk())) return;
    const file = s3Client.file(key);
    await file.delete().catch(() => {});
    return;
  }

  if (!(await loadSdk())) return;
  const s3Module = await dynamicImport('@aws-sdk/client-s3');
  const config = getStorageConfig();
  await s3Client.send(new s3Module.DeleteObjectCommand({
    Bucket: config.bucket,
    Key: key,
  }));
}

// ─── Copy ───────────────────────────────────────────────────────────────────

export async function copyInS3(sourceKey: string, destKey: string): Promise<string> {
  const provider = getStorageProvider();

  if (provider === 'local') {
    const { copyFile } = await import('fs/promises');
    const path = await import('path');
    const config = getStorageConfig();
    await copyFile(
      path.join(config.localUploadDir, sourceKey),
      path.join(config.localUploadDir, destKey)
    );
    return `/uploads/${destKey}`;
  }

  if (provider === 'gcs') {
    if (!(await loadSdk())) throw new Error('GCS not configured');
    const sourceFile = s3Client.file(sourceKey);
    const destFile = s3Client.file(destKey);
    await sourceFile.copy(destFile);
    return getPublicUrl(destKey);
  }

  if (!(await loadSdk())) throw new Error('S3/MinIO not configured');
  const s3Module = await dynamicImport('@aws-sdk/client-s3');
  const config = getStorageConfig();
  await s3Client.send(new s3Module.CopyObjectCommand({
    Bucket: config.bucket,
    CopySource: `${config.bucket}/${sourceKey}`,
    Key: destKey,
  }));
  return getPublicUrl(destKey);
}

// ─── Signed URL ─────────────────────────────────────────────────────────────

export async function getSignedDownloadUrl(key: string, expiresInSeconds = 900): Promise<string> {
  const provider = getStorageProvider();

  if (provider === 'local') return `/uploads/${key}`;

  if (provider === 'gcs') {
    if (!(await loadSdk())) throw new Error('GCS not configured');
    const file = s3Client.file(key);
    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + expiresInSeconds * 1000,
    });
    return url;
  }

  if (!(await loadSdk())) throw new Error('S3/MinIO not configured');
  const command = new GetObjectCommand({
    Bucket: getStorageConfig().bucket,
    Key: key,
  });
  return getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });
}

// ─── High-level helpers (used by the rest of the app) ───────────────────────

export async function readPdfStorage(key: string): Promise<Buffer> {
  return downloadFromS3(key);
}

export async function writePdfStorage(key: string, data: Buffer): Promise<void> {
  await uploadToS3(key, data, 'application/pdf');
}

export async function deletePdfStorage(key: string): Promise<void> {
  await deleteFromS3(key);
}

export async function copyPdfStorage(sourceKey: string, destKey: string): Promise<string> {
  return copyInS3(sourceKey, destKey);
}

// Legacy exports for backward compatibility
export const getS3Config = getStorageConfig;
