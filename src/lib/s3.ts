let s3Client: any = null;
let PutObjectCommand: any = null;
let GetObjectCommand: any = null;
let HeadBucketCommand: any = null;
let CreateBucketCommand: any = null;
let getSignedUrl: any = null;
let sdkAvailable = false;

async function dynamicImport(module: string): Promise<any> {
  // Use Function constructor to prevent webpack static analysis
  return new Function('m', 'return import(m)')(module);
}

async function loadSdk() {
  if (sdkAvailable) return true;
  try {
    const s3Module = await dynamicImport('@aws-sdk/client-s3');
    const presignerModule = await dynamicImport('@aws-sdk/s3-request-presigner');
    const endpoint = process.env.S3_ENDPOINT || '';
    const forcePathStyle = !!endpoint; // MinIO requires path-style

    s3Client = new s3Module.S3Client({
      region: process.env.S3_REGION || 'us-east-1',
      endpoint: endpoint || undefined,
      forcePathStyle,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY || '',
        secretAccessKey: process.env.S3_SECRET_KEY || '',
      },
    });
    PutObjectCommand = s3Module.PutObjectCommand;
    GetObjectCommand = s3Module.GetObjectCommand;
    HeadBucketCommand = s3Module.HeadBucketCommand;
    CreateBucketCommand = s3Module.CreateBucketCommand;
    getSignedUrl = presignerModule.getSignedUrl;
    sdkAvailable = true;
    return true;
  } catch {
    return false;
  }
}

export function getS3Config() {
  return {
    bucket: process.env.S3_BUCKET || '',
    region: process.env.S3_REGION || 'us-east-1',
    endpoint: process.env.S3_ENDPOINT || '',
    accessKey: process.env.S3_ACCESS_KEY || '',
    secretKey: process.env.S3_SECRET_KEY || '',
    publicUrl: process.env.S3_PUBLIC_URL || '',
  };
}

export function isS3Configured(): boolean {
  return !!(process.env.S3_BUCKET && process.env.S3_ACCESS_KEY && process.env.S3_SECRET_KEY);
}

export async function ensureBucket(): Promise<void> {
  if (!(await loadSdk())) return;
  const config = getS3Config();
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: config.bucket }));
  } catch {
    await s3Client.send(new CreateBucketCommand({ Bucket: config.bucket }));
  }
}

function getPublicUrl(key: string): string {
  const config = getS3Config();
  if (config.publicUrl) return `${config.publicUrl}/${key}`;
  if (config.endpoint) return `${config.endpoint}/${config.bucket}/${key}`;
  return `https://${config.bucket}.s3.${config.region}.amazonaws.com/${key}`;
}

export async function uploadToS3(key: string, body: Buffer, contentType: string): Promise<string> {
  if (!(await loadSdk())) throw new Error('S3/MinIO not configured');
  const config = getS3Config();
  await s3Client.send(new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
  }));
  return getPublicUrl(key);
}

export async function downloadFromS3(key: string): Promise<Buffer> {
  if (!(await loadSdk())) throw new Error('S3/MinIO not configured');
  const config = getS3Config();
  const response = await s3Client.send(new GetObjectCommand({
    Bucket: config.bucket,
    Key: key,
  }));
  const chunks: Uint8Array[] = [];
  const stream = response.Body;
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function getSignedDownloadUrl(key: string, expiresInSeconds = 900): Promise<string> {
  if (!(await loadSdk())) throw new Error('S3/MinIO not configured');
  const command = new GetObjectCommand({
    Bucket: getS3Config().bucket,
    Key: key,
  });
  return getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });
}

export async function deleteFromS3(key: string): Promise<void> {
  if (!(await loadSdk())) return;
  const s3Module = await dynamicImport('@aws-sdk/client-s3');
  await s3Client.send(new s3Module.DeleteObjectCommand({
    Bucket: getS3Config().bucket,
    Key: key,
  }));
}

export async function copyInS3(sourceKey: string, destKey: string): Promise<string> {
  if (!(await loadSdk())) throw new Error('S3/MinIO not configured');
  const s3Module = await dynamicImport('@aws-sdk/client-s3');
  const config = getS3Config();
  await s3Client.send(new s3Module.CopyObjectCommand({
    Bucket: config.bucket,
    CopySource: `${config.bucket}/${sourceKey}`,
    Key: destKey,
  }));
  return getPublicUrl(destKey);
}

export async function readPdfStorage(key: string): Promise<Buffer> {
  if (isS3Configured()) {
    return downloadFromS3(key);
  }
  const { readFile } = await import('fs/promises');
  const filePath = require('path').join(process.cwd(), 'uploads', key);
  return readFile(filePath);
}

export async function writePdfStorage(key: string, data: Buffer): Promise<void> {
  if (isS3Configured()) {
    await uploadToS3(key, data, 'application/pdf');
  } else {
    const { writeFile, mkdir } = await import('fs/promises');
    const uploadDir = require('path').join(process.cwd(), 'uploads');
    await mkdir(uploadDir, { recursive: true });
    await writeFile(require('path').join(uploadDir, key), data);
  }
}

export async function deletePdfStorage(key: string): Promise<void> {
  if (isS3Configured()) {
    await deleteFromS3(key);
  } else {
    const { unlink } = await import('fs/promises');
    const filePath = require('path').join(process.cwd(), 'uploads', key);
    await unlink(filePath).catch(() => {});
  }
}

export async function copyPdfStorage(sourceKey: string, destKey: string): Promise<string> {
  if (isS3Configured()) {
    return copyInS3(sourceKey, destKey);
  }
  const { copyFile } = await import('fs/promises');
  const uploadsDir = require('path').join(process.cwd(), 'uploads');
  await copyFile(require('path').join(uploadsDir, sourceKey), require('path').join(uploadsDir, destKey));
  return destKey;
}
