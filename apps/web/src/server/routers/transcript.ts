import { z } from 'zod'
import { router, protectedProcedure, publicProcedure } from '../trpc'
import { TRPCError } from '@trpc/server'
import { createPresignedDownloadUrl } from '@/lib/s3/presigned'
import { speakerLabelsSchema } from '@cloud-transcripts/db'

export const transcriptRouter = router({
  updateSpeakers: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      speakerLabels: speakerLabelsSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      const { supabase, user, logger } = ctx

      // Check ownership through video
      const { data: transcript, error: fetchError } = await supabase
        .from('transcripts')
        .select('*, videos!inner(*)')
        .eq('id', input.id)
        .single()

      if (fetchError || !transcript) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Transcript not found',
        })
      }

      if (transcript.videos.owner_id !== user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have permission to edit this transcript',
        })
      }

      // Update speaker labels
      const { error: updateError } = await supabase
        .from('transcripts')
        .update({ speaker_labels: input.speakerLabels })
        .eq('id', input.id)

      if (updateError) {
        logger.error('Failed to update speaker labels', {
          error: updateError.message,
          transcript_id: input.id,
          user_id: user.id,
        })
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update speaker labels',
        })
      }

      logger.info('Updated speaker labels', {
        transcript_id: input.id,
        user_id: user.id,
      })

      return { success: true }
    }),

  getDownloadUrl: publicProcedure
    .input(z.object({
      id: z.string().uuid(),
      format: z.enum(['markdown', 'json']).default('markdown'),
    }))
    .query(async ({ ctx, input }) => {
      const { supabase, user } = ctx

      // Fetch transcript with video info
      const { data: transcript, error } = await supabase
        .from('transcripts')
        .select('*, videos!inner(*)')
        .eq('id', input.id)
        .single()

      if (error || !transcript) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Transcript not found',
        })
      }

      // Check permissions
      if (transcript.videos.owner_id && transcript.videos.owner_id !== user?.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have access to this transcript',
        })
      }

      // Get appropriate key
      const key = input.format === 'json' ? transcript.json_key : transcript.markdown_key
      if (!key) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `${input.format} file not available`,
        })
      }

      try {
        const url = await createPresignedDownloadUrl(key)
        return { url }
      } catch (error) {
        ctx.logger.error('Failed to create download URL', {
          error: error instanceof Error ? error.message : 'Unknown error',
          transcript_id: input.id,
          format: input.format,
        })
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create download URL',
        })
      }
    }),
})