import { z } from 'zod'
import { router, publicProcedure } from '../trpc'
import { createPresignedUploadUrl } from '@/lib/s3/presigned'
import { TRPCError } from '@trpc/server'
import { MAX_FILE_SIZE, ALLOWED_VIDEO_TYPES, ALLOWED_AUDIO_TYPES } from '@cloud-transcripts/shared'

const createPresignedUrlSchema = z.object({
  filename: z.string().min(1),
  contentType: z.string(),
  contentLength: z.number().int().positive().max(MAX_FILE_SIZE),
})

export const uploadRouter = router({
  createPresignedUrl: publicProcedure
    .input(createPresignedUrlSchema)
    .mutation(async ({ ctx, input }) => {
      const { filename, contentType, contentLength } = input

      // Validate content type
      const allowedTypes = [...ALLOWED_VIDEO_TYPES, ...ALLOWED_AUDIO_TYPES]
      if (!allowedTypes.includes(contentType)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Invalid file type. Allowed types: ${allowedTypes.join(', ')}`,
        })
      }

      try {
        const { uploadUrl, fileKey } = await createPresignedUploadUrl(
          ctx.user?.id || null,
          filename,
          contentType,
          contentLength
        )

        return { uploadUrl, fileKey }
      } catch (error) {
        ctx.logger.error('Failed to create presigned URL', {
          error: error instanceof Error ? error.message : 'Unknown error',
          filename,
          content_type: contentType,
          user_id: ctx.user?.id,
        })

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create upload URL',
        })
      }
    }),
})