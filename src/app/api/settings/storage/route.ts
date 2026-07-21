import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/permissions';
import { getStorageConfig, isS3Configured, getStorageProvider } from '@/lib/s3';

// GET /api/settings/storage - Get storage configuration
export async function GET(req: NextRequest) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Check admin role
    const membership = await db.organizationMember.findFirst({
      where: { userId: payload.userId, role: { in: ['owner', 'admin'] } },
    });
    if (!membership) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const config = getStorageConfig();
    return NextResponse.json({
      provider: config.provider,
      configured: isS3Configured() || config.provider === 'local',
      bucket: config.bucket,
      region: config.region,
      endpoint: config.endpoint,
      publicUrl: config.publicUrl,
      forcePathStyle: config.forcePathStyle,
      acl: config.acl,
      maxFileSize: config.maxFileSize,
      localUploadDir: config.localUploadDir,
      // Mask sensitive fields
      accessKey: config.accessKey ? '***' + config.accessKey.slice(-4) : '',
      secretKey: config.secretKey ? '***' : '',
    });
  } catch (error) {
    console.error('Get storage config error:', error);
    return NextResponse.json({ error: 'Failed to get storage config' }, { status: 500 });
  }
}

// PUT /api/settings/storage - Update storage configuration (env-based, returns instructions)
export async function PUT(req: NextRequest) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const membership = await db.organizationMember.findFirst({
      where: { userId: payload.userId, role: { in: ['owner', 'admin'] } },
    });
    if (!membership) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { provider } = body;

    // Storage config is set via environment variables, so we return instructions
    const envMap: Record<string, string[]> = {
      local: ['LOCAL_UPLOAD_DIR'],
      s3: ['S3_BUCKET', 'S3_REGION', 'S3_ENDPOINT', 'S3_ACCESS_KEY', 'S3_SECRET_KEY', 'S3_PUBLIC_URL', 'S3_ACL', 'S3_MAX_FILE_SIZE'],
      minio: ['S3_BUCKET', 'S3_REGION', 'S3_ENDPOINT', 'S3_ACCESS_KEY', 'S3_SECRET_KEY', 'S3_PUBLIC_URL', 'S3_FORCE_PATH_STYLE', 'S3_ACL'],
      gcs: ['GCS_BUCKET', 'GCS_PROJECT_ID', 'GCS_KEY_FILE', 'S3_PUBLIC_URL'],
    };

    const requiredVars = envMap[provider] || envMap.local;

    return NextResponse.json({
      message: `To configure ${provider} storage, set the following environment variables:`,
      provider,
      requiredVars,
      instructions: getStorageInstructions(provider),
    });
  } catch (error) {
    console.error('Update storage config error:', error);
    return NextResponse.json({ error: 'Failed to update storage config' }, { status: 500 });
  }
}

function getStorageInstructions(provider: string): string {
  switch (provider) {
    case 'minio':
      return `MinIO Setup:
1. Install MinIO: docker run -d -p 9000:9000 -p 9001:9001 minio/minio server /data --console-address ":9001"
2. Create a bucket in the MinIO console
3. Set env vars:
   STORAGE_PROVIDER=minio
   S3_BUCKET=your-bucket
   S3_ENDPOINT=http://minio-host:9000
   S3_ACCESS_KEY=your-access-key
   S3_SECRET_KEY=your-secret-key
   S3_FORCE_PATH_STYLE=true`;

    case 's3':
      return `AWS S3 Setup:
1. Create an S3 bucket in AWS console
2. Create an IAM user with S3 access
3. Set env vars:
   STORAGE_PROVIDER=s3
   S3_BUCKET=your-bucket
   S3_REGION=us-east-1
   S3_ACCESS_KEY=your-access-key
   S3_SECRET_KEY=your-secret-key
   S3_PUBLIC_URL=https://your-bucket.s3.amazonaws.com (optional CDN)`;

    case 'gcs':
      return `Google Cloud Storage Setup:
1. Create a GCS bucket in GCP console
2. Create a service account with Storage Admin role
3. Download the JSON key file
4. Set env vars:
   STORAGE_PROVIDER=gcs
   GCS_BUCKET=your-bucket
   GCS_PROJECT_ID=your-project-id
   GCS_KEY_FILE=/path/to/service-account.json`;

    case 'local':
    default:
      return `Local Storage:
Files are stored in the ./uploads directory.
Set LOCAL_UPLOAD_DIR to change the directory.
No additional configuration needed.`;
  }
}
