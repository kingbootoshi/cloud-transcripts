'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { FileVideo, FileAudio, Loader2 } from 'lucide-react'
import { trpc } from '@/lib/trpc/client'
import { 
  formatBytes, 
  ALLOWED_VIDEO_EXTENSIONS, 
  ALLOWED_AUDIO_EXTENSIONS, 
  MAX_FILE_SIZE 
} from '@cloud-transcripts/shared'
import { cn } from '@/lib/utils'

interface FileUploadProps {
  onUploadComplete: (fileKey: string, mediaType: 'audio' | 'video') => void
}

export function FileUpload({ onUploadComplete }: FileUploadProps) {
  const [uploadProgress, setUploadProgress] = useState<number>(0)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createPresignedUrl = trpc.upload.createPresignedUrl.useMutation()

  const uploadFile = useCallback(async (file: File) => {
    setIsUploading(true)
    setError(null)
    setUploadProgress(0)

    try {
      // Get presigned URL
      const { uploadUrl, fileKey } = await createPresignedUrl.mutateAsync({
        filename: file.name,
        contentType: file.type,
        contentLength: file.size,
      })

      // Upload to S3
      const xhr = new XMLHttpRequest()

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100)
          setUploadProgress(progress)
        }
      })

      xhr.addEventListener('load', () => {
        if (xhr.status === 200 || xhr.status === 204) {
          const mediaType = file.type.startsWith('video/') ? 'video' : 'audio'
          onUploadComplete(fileKey, mediaType)
        } else {
          throw new Error('Upload failed')
        }
      })

      xhr.addEventListener('error', () => {
        throw new Error('Upload failed')
      })

      xhr.open('PUT', uploadUrl)
      xhr.setRequestHeader('Content-Type', file.type)
      xhr.send(file)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
      setIsUploading(false)
    }
  }, [createPresignedUrl, onUploadComplete])

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      uploadFile(acceptedFiles[0])
    }
  }, [uploadFile])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'video/*': ALLOWED_VIDEO_EXTENSIONS,
      'audio/*': ALLOWED_AUDIO_EXTENSIONS,
    },
    maxSize: MAX_FILE_SIZE,
    multiple: false,
    disabled: isUploading,
  })

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div
        {...getRootProps()}
        className={cn(
          "relative border-2 border-dashed rounded-lg p-8 transition-all cursor-pointer",
          isDragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50",
          isUploading && "cursor-not-allowed opacity-50"
        )}
      >
        <input {...getInputProps()} />
        
        <div className="flex flex-col items-center justify-center space-y-4">
          {isUploading ? (
            <>
              <Loader2 className="w-12 h-12 text-primary animate-spin" />
              <p className="text-lg font-medium">Uploading... {uploadProgress}%</p>
              <div className="w-full max-w-xs bg-secondary rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center space-x-2">
                <FileVideo className="w-8 h-8 text-muted-foreground" />
                <FileAudio className="w-8 h-8 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="text-lg font-medium">
                  {isDragActive ? 'Drop the file here' : 'Drag & drop or click to upload'}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  MP4, MOV, MKV, WAV, MP3 (max {formatBytes(MAX_FILE_SIZE)})
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}
    </div>
  )
}