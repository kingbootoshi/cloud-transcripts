export const MAX_FILE_SIZE = 25 * 1024 * 1024 * 1024 // 25 GB

// MIME types for server-side validation
export const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/x-matroska']
export const ALLOWED_AUDIO_TYPES = ['audio/wav', 'audio/mpeg', 'audio/mp3']

// File extensions for client-side dropzone
export const ALLOWED_VIDEO_EXTENSIONS = ['.mp4', '.mov', '.mkv']
export const ALLOWED_AUDIO_EXTENSIONS = ['.wav', '.mp3']

// MIME type to extension mapping
export const MIME_TO_EXTENSION = {
  'video/mp4': '.mp4',
  'video/quicktime': '.mov',
  'video/x-matroska': '.mkv',
  'audio/wav': '.wav',
  'audio/mpeg': '.mp3',
  'audio/mp3': '.mp3',
} as const

export const MULTIPART_CHUNK_SIZE = 16 * 1024 * 1024 // 16 MB

export const ERROR_CODES = {
  VALIDATION: 'E_VALIDATION',
  NOT_FOUND: 'E_NOT_FOUND',
  MODAL: 'E_MODAL',
  S3: 'E_S3',
  DB: 'E_DB',
  INTERNAL: 'E_INTERNAL',
  UNAUTHORIZED: 'E_UNAUTHORIZED',
  RATE_LIMIT: 'E_RATE_LIMIT',
} as const

export const JOB_STATUS = {
  QUEUED: 'queued',
  PROCESSING: 'processing',
  DONE: 'done',
  ERROR: 'error',
} as const