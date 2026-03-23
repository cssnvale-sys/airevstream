import * as Minio from 'minio';
import { Readable } from 'node:stream';

export interface StorageConfig {
  endPoint: string;
  port: number;
  accessKey: string;
  secretKey: string;
  useSSL?: boolean;
}

let client: Minio.Client | null = null;

export function getStorageClient(config?: StorageConfig): Minio.Client {
  if (!client) {
    const cfg = config ?? {
      endPoint: process.env.MINIO_ENDPOINT ?? 'localhost',
      port: parseInt(process.env.MINIO_PORT ?? '9000', 10),
      accessKey: process.env.MINIO_ACCESS_KEY ?? 'airevstream',
      secretKey: process.env.MINIO_SECRET_KEY ?? 'airevstream_dev_secret_key_change_me',
      useSSL: process.env.MINIO_USE_SSL === 'true',
    };
    client = new Minio.Client({ ...cfg, useSSL: cfg.useSSL ?? false });
  }
  return client;
}

export function resetStorageClient(): void {
  client = null;
}

/** Ensure a bucket exists, creating it if needed */
export async function ensureBucket(bucketName: string): Promise<void> {
  const mc = getStorageClient();
  const exists = await mc.bucketExists(bucketName);
  if (!exists) {
    await mc.makeBucket(bucketName);
  }
}

/** Upload a file from a Buffer */
export async function uploadBuffer(
  bucket: string,
  key: string,
  data: Buffer,
  contentType?: string,
): Promise<{ bucket: string; key: string; etag: string }> {
  const mc = getStorageClient();
  const metadata: Record<string, string> = {};
  if (contentType) metadata['Content-Type'] = contentType;

  const result = await mc.putObject(bucket, key, data, data.length, metadata);
  return { bucket, key, etag: result.etag };
}

/** Upload a file from a stream */
export async function uploadStream(
  bucket: string,
  key: string,
  stream: Readable,
  size: number,
  contentType?: string,
): Promise<{ bucket: string; key: string; etag: string }> {
  const mc = getStorageClient();
  const metadata: Record<string, string> = {};
  if (contentType) metadata['Content-Type'] = contentType;

  const result = await mc.putObject(bucket, key, stream, size, metadata);
  return { bucket, key, etag: result.etag };
}

/** Download a file as a stream */
export async function downloadStream(bucket: string, key: string): Promise<Readable> {
  const mc = getStorageClient();
  return mc.getObject(bucket, key);
}

/** Download a file as a Buffer */
export async function downloadBuffer(bucket: string, key: string): Promise<Buffer> {
  const stream = await downloadStream(bucket, key);
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

/** Generate a presigned URL for downloading */
export async function getPresignedUrl(
  bucket: string,
  key: string,
  expirySeconds = 3600,
): Promise<string> {
  const mc = getStorageClient();
  return mc.presignedGetObject(bucket, key, expirySeconds);
}

/** Generate a presigned URL for uploading */
export async function getPresignedPutUrl(
  bucket: string,
  key: string,
  expirySeconds = 3600,
): Promise<string> {
  const mc = getStorageClient();
  return mc.presignedPutObject(bucket, key, expirySeconds);
}

/** Delete a file */
export async function deleteObject(bucket: string, key: string): Promise<void> {
  const mc = getStorageClient();
  await mc.removeObject(bucket, key);
}

/** List objects in a bucket with optional prefix */
export async function listObjects(
  bucket: string,
  prefix?: string,
  timeoutMs = 60_000,
): Promise<Array<{ name: string; size: number; lastModified: Date }>> {
  const mc = getStorageClient();
  return new Promise((resolve, reject) => {
    const results: Array<{ name: string; size: number; lastModified: Date }> = [];
    const stream = mc.listObjects(bucket, prefix ?? '', true);
    const timer = setTimeout(() => {
      stream.destroy();
      reject(new Error(`listObjects timed out after ${timeoutMs}ms for bucket=${bucket} prefix=${prefix ?? ''}`));
    }, timeoutMs);
    stream.on('data', (obj) => {
      if (obj.name) {
        results.push({
          name: obj.name,
          size: obj.size ?? 0,
          lastModified: obj.lastModified ?? new Date(),
        });
      }
    });
    stream.on('end', () => { clearTimeout(timer); resolve(results); });
    stream.on('error', (err) => { clearTimeout(timer); reject(err); });
  });
}

/** Get object metadata/stats */
export async function getObjectStat(
  bucket: string,
  key: string,
): Promise<{ size: number; lastModified: Date; metaData: Record<string, string> }> {
  const mc = getStorageClient();
  const stat = await mc.statObject(bucket, key);
  return {
    size: stat.size,
    lastModified: stat.lastModified,
    metaData: stat.metaData as Record<string, string>,
  };
}
