import { z } from 'zod'

export const videoSourceType = z.enum(['upload', 'youtube'])
export const videoStatus = z.enum(['queued', 'processing', 'done', 'error'])

export const videoSchema = z.object({
  id: z.string().uuid(),
  owner_id: z.string().uuid().nullable(),
  source_type: videoSourceType,
  source_url: z.string().nullable(),
  duration_sec: z.number().int().nullable(),
  size_bytes: z.number().int().nullable(),
  status: videoStatus,
  created_at: z.date(),
  updated_at: z.date(),
})

export type Video = z.infer<typeof videoSchema>
export type VideoSourceType = z.infer<typeof videoSourceType>
export type VideoStatus = z.infer<typeof videoStatus>