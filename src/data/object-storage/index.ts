/**
 * Neon Object Storage, for the photo wall images.
 *
 * Neon gives each branch an S3-compatible bucket and writes AWS-standard
 * settings into the environment (`neon deploy` / `neon env pull`):
 * AWS_ENDPOINT_URL_S3, AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY.
 * The AWS SDK reads them by itself. The bucket is declared in neon.ts.
 *
 * Following Neon's guidance, the database row keeps the object's key and
 * the bytes live in the bucket, so the row and the file branch together.
 *
 * Two settings Neon needs: path-style addressing (forcePathStyle), and the
 * fetch-based HTTP handler, which works anywhere Node's fetch does,
 * including behind an HTTPS proxy.
 */
import {
  DeleteObjectCommand,
  GetObjectCommand,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { FetchHttpHandler } from '@smithy/fetch-http-handler';

export type ObjectStore = {
  bucket: string;
  put(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  /** The bytes, or null when there is no such object. */
  get(key: string): Promise<Uint8Array | null>;
  remove(key: string): Promise<void>;
};

/** The bucket in neon.ts the photos go to. */
export const DEFAULT_PHOTO_BUCKET = 'assets';

export function createObjectStore(bucket: string): ObjectStore {
  const client = new S3Client({ forcePathStyle: true, requestHandler: new FetchHttpHandler() });
  return {
    bucket,
    async put(key, bytes, contentType) {
      await client.send(
        new PutObjectCommand({ Bucket: bucket, Key: key, Body: bytes, ContentType: contentType }),
      );
    },
    async get(key) {
      try {
        const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        return result.Body ? await result.Body.transformToByteArray() : null;
      } catch (error) {
        if (error instanceof NoSuchKey) return null;
        throw error;
      }
    },
    async remove(key) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },
  };
}

/**
 * The store from the environment, or null when there is no bucket set up.
 * PHOTO_STORAGE=database keeps photos in the database even when there is.
 */
export function objectStoreFromEnv(): ObjectStore | null {
  if ((process.env.PHOTO_STORAGE ?? '').trim().toLowerCase() === 'database') return null;
  if (!process.env.AWS_ENDPOINT_URL_S3?.trim()) return null;
  const bucket = process.env.PHOTO_BUCKET?.trim() || DEFAULT_PHOTO_BUCKET;
  return createObjectStore(bucket);
}
