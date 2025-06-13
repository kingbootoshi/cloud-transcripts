import { S3Client } from '@aws-sdk/client-s3'

/**
 * Create a reusable S3 client.
 *
 * – In production we generally rely on the `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`
 *   environment variables being provided at build-time/runtime. If they are not supplied
 *   (e.g. in local development when the user might be using an AWS profile or automatic
 *   credentials via `aws-vault` / `aws sso login`) we fall back to the default credential
 *   provider chain used by the AWS SDK v3 by **omitting** the explicit `credentials` field.
 *   This prevents us from accidentally passing `undefined` values which causes signature
 *   generation to throw and results in a 500 from the `upload.createPresignedUrl` endpoint.
 */

export const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  // Only supply explicit static credentials when both values are available.
  ...(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
    ? {
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
      }
    : {}),
})