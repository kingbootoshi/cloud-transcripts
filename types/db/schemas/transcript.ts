import { z } from 'zod'

export const wordSchema = z.object({
  text: z.string(),
  start: z.number(),
  end: z.number(),
  speaker: z.string().optional(),
})

export const speakerLabelsSchema = z.record(z.string())

export const transcriptSchema = z.object({
  id: z.string().uuid(),
  video_id: z.string().uuid(),
  markdown_key: z.string().nullable(),
  json_key: z.string().nullable(),
  words_jsonb: z.array(wordSchema).nullable(),
  speaker_labels: speakerLabelsSchema.nullable(),
  created_at: z.date(),
})

export type Transcript = z.infer<typeof transcriptSchema>
export type Word = z.infer<typeof wordSchema>
export type SpeakerLabels = z.infer<typeof speakerLabelsSchema>