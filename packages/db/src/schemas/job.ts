import { z } from 'zod'

export const createJobSchema = z.object({
  fileKey: z.string().optional(),
  youtubeUrl: z.string().url().optional(),
  mediaType: z.enum(['audio', 'video']),
  fastMode: z.boolean().optional(),
  language: z.string().default('en'),
  modelSize: z.enum(['tiny', 'base', 'small', 'medium', 'large', 'large-v2']).default('large-v2'),
  doDiarize: z.boolean().default(true),
  minSpeakers: z.number().int().min(1).max(10).default(2),
  maxSpeakers: z.number().int().min(1).max(10).default(6),
}).refine(
  (data) => data.fileKey || data.youtubeUrl,
  { message: 'Either fileKey or youtubeUrl must be provided' }
)

export const modalJobPayloadSchema = z.object({
  job_id: z.string().uuid(),
  s3_bucket: z.string(),
  object_key: z.string(),
  media_type: z.enum(['video', 'audio']),
  language: z.string(),
  model_size: z.string(),
  do_diarize: z.boolean(),
  min_speakers: z.number(),
  max_speakers: z.number(),
})

export const webhookPayloadSchema = z.object({
  job_id: z.string().uuid(),
  status: z.enum(['done', 'error']),
  md_key: z.string().optional(),
  json_key: z.string().optional(),
  error: z.string().optional(),
})

export type CreateJob = z.infer<typeof createJobSchema>
export type ModalJobPayload = z.infer<typeof modalJobPayloadSchema>
export type WebhookPayload = z.infer<typeof webhookPayloadSchema>