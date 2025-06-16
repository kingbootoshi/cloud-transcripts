import { z } from 'zod'
import { router, publicProcedure, protectedProcedure } from '../trpc'
import { TRPCError } from '@trpc/server'
import { createJobSchema, modalJobPayloadSchema } from '@cloud-transcripts/db'
import { JOB_STATUS } from '@cloud-transcripts/shared'

export const jobRouter = router({
  create: publicProcedure
    .input(createJobSchema)
    .mutation(async ({ ctx, input }) => {
      const { supabase, user, logger } = ctx

      try {
        // Create video record
        const { data: video, error: videoError } = await supabase
          .from('videos')
          .insert({
            owner_id: user?.id || null,
            source_type: input.youtubeUrl ? 'youtube' : 'upload',
            source_url: input.fileKey || input.youtubeUrl,
            status: JOB_STATUS.QUEUED,
          })
          .select()
          .single()

        if (videoError) {
          logger.error('Failed to create video record', {
            error: videoError.message,
            input,
          })
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to create job',
          })
        }

        // Create Modal job payload
        const modalPayload: z.infer<typeof modalJobPayloadSchema> = {
          job_id: video.id,
          s3_bucket: process.env.S3_BUCKET!,
          object_key: input.fileKey || '',
          media_type: input.mediaType,
          language: input.language,
          model_size: input.modelSize,
          do_diarize: input.doDiarize,
          min_speakers: input.minSpeakers,
          max_speakers: input.maxSpeakers,
        }

        // Fire-and-forget call to Modal queue
        try {
          const modalResponse = await fetch(process.env.MODAL_QUEUE_URL!, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(modalPayload),
          })

          if (!modalResponse.ok) {
            logger.error('Failed to enqueue Modal job', {
              status: modalResponse.status,
              statusText: modalResponse.statusText,
              job_id: video.id,
            })
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: 'Failed to start transcription job',
            })
          }

          logger.info('Modal job enqueued successfully', {
            job_id: video.id,
            status: modalResponse.status,
          })
        } catch (error) {
          if (error instanceof TRPCError) throw error
          
          logger.error('Unexpected error calling Modal', {
            error: error instanceof Error ? error.message : 'Unknown error',
            job_id: video.id,
          })
          
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to start transcription job',
          })
        }

        logger.info('Job created', {
          job_id: video.id,
          user_id: user?.id,
          source_type: video.source_type,
        })

        return { jobId: video.id }
      } catch (error) {
        if (error instanceof TRPCError) throw error
        
        logger.error('Unexpected error creating job', {
          error: error instanceof Error ? error.message : 'Unknown error',
          input,
        })
        
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create job',
        })
      }
    }),

  get: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { supabase, user } = ctx

      const { data: video, error } = await supabase
        .from('videos')
        .select('*, transcripts(*)')
        .eq('id', input.id)
        .single()

      if (error || !video) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Job not found',
        })
      }

      // Check permissions
      if (video.owner_id && video.owner_id !== user?.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have access to this job',
        })
      }

      return video
    }),

  list: protectedProcedure
    .query(async ({ ctx }) => {
      const { supabase, user } = ctx

      const { data: videos, error } = await supabase
        .from('videos')
        .select('*')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch jobs',
        })
      }

      return videos
    }),
})