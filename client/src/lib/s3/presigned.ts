import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { s3Client } from './client'
import { logger } from '../logger'
import { generateVideoKey } from '@cloud-transcripts/shared'

export interface PresignedUploadResponse {
  uploadUrl: string
  fileKey: string
}

export async function createPresignedUploadUrl(
  userId: string | null,
  filename: string,
  contentType: string,
  contentLength: number
): Promise<PresignedUploadResponse> {
  // Validate required configuration before continuing. This gives the caller a meaningful error
  // instead of an opaque 500 coming from the AWS SDK when the bucket name is undefined.
  if (!process.env.S3_BUCKET) {
    throw new Error('S3_BUCKET environment variable is not defined')
  }

  const fileKey = generateVideoKey(userId, filename)
  
  const command = new PutObjectCommand({
    Bucket: process.env.S3_BUCKET!,
    Key: fileKey,
    ContentType: contentType,
    ContentLength: contentLength,
  })

  try {
    const uploadUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 24 * 60 * 60, // 24 hours
    })

    logger.info('Created presigned upload URL', {
      user_id: userId,
      file_key: fileKey,
      content_type: contentType,
      size_bytes: contentLength,
    })

    return { uploadUrl, fileKey }
  } catch (error) {
    logger.error('Failed to create presigned upload URL', {
      error: error instanceof Error ? error.message : 'Unknown error',
      user_id: userId,
      filename,
    })
    throw error
  }
}

export async function createPresignedDownloadUrl(
  key: string,
  expiresIn: number = 15 * 60 // 15 minutes default
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: process.env.S3_BUCKET!,
    Key: key,
  })

  try {
    const url = await getSignedUrl(s3Client, command, { expiresIn })
    
    logger.info('Created presigned download URL', {
      key,
      expires_in: expiresIn,
    })

    return url
  } catch (error) {
    logger.error('Failed to create presigned download URL', {
      error: error instanceof Error ? error.message : 'Unknown error',
      key,
    })
    throw error
  }
}