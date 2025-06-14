# API Documentation

Cloud Transcripts uses [tRPC](https://trpc.io) for type-safe API communication between the frontend and backend.

## Overview

The API is organized into three main routers:

- **upload**: Handles file upload operations
- **job**: Manages transcription jobs
- **transcript**: Handles transcript retrieval and updates

All API endpoints are available at `/api/trpc`.

## Authentication

The API supports both authenticated and anonymous usage:

- **Public procedures**: Available to all users
- **Protected procedures**: Require Supabase authentication

## Endpoints

### Upload Router

#### `upload.createPresignedUrl`

Generate a presigned URL for uploading files to S3.

**Type**: Public procedure  
**Method**: Mutation

**Input Schema**:
```typescript
{
  filename: string      // Original filename
  contentType: string   // MIME type (e.g., 'video/mp4')
  contentLength: number // File size in bytes
}
```

**Output**:
```typescript
{
  uploadUrl: string // Presigned S3 URL for PUT request
  fileKey: string   // S3 object key for the file
}
```

**Example**:
```typescript
const { uploadUrl, fileKey } = await trpc.upload.createPresignedUrl.mutate({
  filename: "interview.mp4",
  contentType: "video/mp4",
  contentLength: 104857600 // 100MB
})
```

**Validations**:
- Content type must be in allowed list
- File size must not exceed 25GB
- Filename must not be empty

### Job Router

#### `job.create`

Create a new transcription job.

**Type**: Public procedure  
**Method**: Mutation

**Input Schema**:
```typescript
{
  fileKey?: string           // S3 key from upload (required if no youtubeUrl)
  youtubeUrl?: string        // YouTube URL (required if no fileKey)
  mediaType: "audio" | "video"
  language?: string          // ISO language code (default: "en")
  modelSize?: "tiny" | "base" | "small" | "medium" | "large" | "large-v2"
  doDiarize?: boolean        // Enable speaker diarization (default: true)
  minSpeakers?: number       // Minimum speakers (1-10, default: 2)
  maxSpeakers?: number       // Maximum speakers (1-10, default: 6)
}
```

**Output**:
```typescript
{
  jobId: string // UUID of created job
}
```

**Example**:
```typescript
const { jobId } = await trpc.job.create.mutate({
  fileKey: "uploads/2024/01/15/user123/1705337424-interview.mp4",
  mediaType: "video",
  language: "en",
  modelSize: "large-v2",
  doDiarize: true,
  minSpeakers: 2,
  maxSpeakers: 4
})
```

**Business Logic**:
1. Creates video record in database
2. Enqueues job to Modal worker
3. Returns job ID for status tracking

#### `job.get`

Get job details and status.

**Type**: Public procedure  
**Method**: Query

**Input Schema**:
```typescript
{
  id: string // Job UUID
}
```

**Output**:
```typescript
{
  id: string
  owner_id: string | null
  source_type: "upload" | "youtube"
  source_url: string | null
  duration_sec: number | null
  size_bytes: number | null
  status: "queued" | "processing" | "done" | "error"
  created_at: string
  updated_at: string
  transcripts: Array<{
    id: string
    video_id: string
    markdown_key: string | null
    json_key: string | null
    created_at: string
  }>
}
```

**Example**:
```typescript
const job = await trpc.job.get.query({
  id: "123e4567-e89b-12d3-a456-426614174000"
})
```

**Authorization**:
- Anonymous users can only access their own jobs
- Authenticated users can access jobs they own

#### `job.list`

List user's transcription jobs.

**Type**: Protected procedure  
**Method**: Query

**Output**:
```typescript
Array<{
  id: string
  owner_id: string
  source_type: "upload" | "youtube"
  source_url: string | null
  status: "queued" | "processing" | "done" | "error"
  created_at: string
  updated_at: string
}>
```

**Example**:
```typescript
const jobs = await trpc.job.list.query()
```

**Notes**:
- Returns up to 50 most recent jobs
- Ordered by creation date (newest first)
- Only returns jobs owned by authenticated user

### Transcript Router

#### `transcript.getDownloadUrl`

Get a presigned URL to download transcript.

**Type**: Public procedure  
**Method**: Query

**Input Schema**:
```typescript
{
  id: string                          // Transcript UUID
  format: "markdown" | "json"         // Output format (default: "markdown")
}
```

**Output**:
```typescript
{
  url: string // Presigned S3 URL (expires in 15 minutes)
}
```

**Example**:
```typescript
const { url } = await trpc.transcript.getDownloadUrl.query({
  id: "456e7890-e89b-12d3-a456-426614174000",
  format: "markdown"
})
```

**Authorization**:
- Same as job authorization (owner or anonymous creator only)

#### `transcript.updateSpeakers`

Update speaker labels for a transcript.

**Type**: Protected procedure  
**Method**: Mutation

**Input Schema**:
```typescript
{
  id: string                    // Transcript UUID
  speakerLabels: {              // Map of speaker IDs to display names
    [speakerId: string]: string
  }
}
```

**Output**:
```typescript
{
  success: boolean
}
```

**Example**:
```typescript
await trpc.transcript.updateSpeakers.mutate({
  id: "456e7890-e89b-12d3-a456-426614174000",
  speakerLabels: {
    "SPEAKER_00": "John Smith",
    "SPEAKER_01": "Jane Doe",
    "SPEAKER_02": "Interviewer"
  }
})
```

**Authorization**:
- Only transcript owner can update speaker labels

## Error Handling

All procedures follow consistent error handling:

### Error Response Format

```typescript
{
  code: "BAD_REQUEST" | "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "INTERNAL_SERVER_ERROR"
  message: string
  data?: {
    zodError?: ZodError  // Validation errors
  }
}
```

### Common Error Codes

- `BAD_REQUEST`: Invalid input or validation failure
- `UNAUTHORIZED`: Authentication required
- `FORBIDDEN`: Insufficient permissions
- `NOT_FOUND`: Resource not found
- `INTERNAL_SERVER_ERROR`: Server error

### Example Error Handling

```typescript
try {
  const job = await trpc.job.get.query({ id: jobId })
} catch (error) {
  if (error.code === 'NOT_FOUND') {
    console.error('Job not found')
  } else if (error.code === 'FORBIDDEN') {
    console.error('Access denied')
  }
}
```

## Rate Limiting

Public endpoints have rate limiting:

- **Upload**: 10 requests per minute per IP
- **Job creation**: 5 requests per minute per IP
- **Other queries**: 60 requests per minute per IP

## WebSocket Support

Real-time updates use Supabase Realtime, not tRPC subscriptions.

To subscribe to job updates:

```typescript
const supabase = createClient()

const channel = supabase
  .channel(`job-${jobId}`)
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'videos',
      filter: `id=eq.${jobId}`,
    },
    (payload) => {
      console.log('Job updated:', payload.new)
    }
  )
  .subscribe()
```

## Webhook Endpoint

### `POST /api/webhook/modal`

Receives transcription results from Modal worker.

**Headers**:
- `X-Modal-Signature`: HMAC-SHA256 signature
- `Content-Type`: application/json

**Body Schema**:
```typescript
{
  job_id: string
  status: "done" | "error"
  md_key?: string    // S3 key for markdown file
  json_key?: string  // S3 key for JSON file
  error?: string     // Error message if status is "error"
}
```

**Response**: 204 No Content

**Security**:
- Validates HMAC signature using `WEBHOOK_SECRET`
- Uses service role for database updates

## TypeScript Types

All API types are automatically generated from the tRPC router definitions. Import them from:

```typescript
import type { AppRouter } from '@/server/routers'
import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server'

type RouterInputs = inferRouterInputs<AppRouter>
type RouterOutputs = inferRouterOutputs<AppRouter>

// Example usage
type CreateJobInput = RouterInputs['job']['create']
type JobDetails = RouterOutputs['job']['get']
``` 