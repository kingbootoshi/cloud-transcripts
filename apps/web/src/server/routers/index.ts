import { router } from '../trpc'
import { uploadRouter } from './upload'
import { jobRouter } from './job'
import { transcriptRouter } from './transcript'

export const appRouter = router({
  upload: uploadRouter,
  job: jobRouter,
  transcript: transcriptRouter,
})

export type AppRouter = typeof appRouter