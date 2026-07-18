let s3Client: any = null;
let PutObjectCommand: any = null;
let getSignedUrl: any = null;
let sdkAvailable = false;

async function loadSdk() {
  if (sdkAvailable) return true;
  try {
    const s3Module = await import('@aws-sdk/client-s3');
    const presignerModule = await import('@aws-sdk/s3-request-presigner');
    s3Client = new s3Module.S3Client({
      region: process.env.AWS_S3_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    });
    PutObjectCommand = s3Module.PutObjectCommand;
    getSignedUrl = presignerModule.getSignedUrl;
    sdkAvailable = true;
    return true;
  } catch {
    return false;
  }
}

export function getS3Config() {
  return {
    bucket: process.env.AWS_S3_BUCKET || '',
    region: process.env.AWS_S3_REGION || 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  };
}

export function isS3Configured(): boolean {
  return !!(process.env.AWS_S3_BUCKET && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
}

export async function uploadToS3(key: string, body: Buffer, contentType: string): Promise<string> {
  if (!(await loadSdk())) throw new Error('S3 not configured');
  const config = getS3Config();
  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
  });
  await s3Client.send(command);
  return `https://${config.bucket}.s3.${config.region}.amazonaws.com/${key}`;
}

export async function getSignedDownloadUrl(key: string, expiresInSeconds = 900): Promise<string> {
  if (!(await loadSdk())) throw new Error('S3 not configured');
  const command = new PutObjectCommand({
    Bucket: getS3Config().bucket,
    Key: key,
  });
  return getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });
}
