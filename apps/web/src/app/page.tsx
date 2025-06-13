'use client'

import { useState } from 'react'
import { FileUpload } from '@/components/upload/file-upload'
import { trpc } from '@/lib/trpc/client'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export default function Home() {
  const [isCreatingJob, setIsCreatingJob] = useState(false)
  const router = useRouter()
  
  const createJob = trpc.job.create.useMutation({
    onSuccess: (data) => {
      router.push(`/job/${data.jobId}`)
    },
    onError: (error) => {
      console.error('Failed to create job:', error)
      setIsCreatingJob(false)
    },
  })

  const handleUploadComplete = async (fileKey: string, mediaType: 'audio' | 'video') => {
    setIsCreatingJob(true)
    
    await createJob.mutateAsync({
      fileKey,
      mediaType,
    })
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Cloud Transcripts</h1>
          <p className="text-xl text-muted-foreground">
            Upload your video or audio files and get AI-powered transcripts with speaker diarization
          </p>
        </div>

        {isCreatingJob ? (
          <div className="flex flex-col items-center justify-center space-y-4 py-16">
            <Loader2 className="w-12 h-12 animate-spin text-primary" />
            <p className="text-lg font-medium">Creating transcription job...</p>
          </div>
        ) : (
          <FileUpload onUploadComplete={handleUploadComplete} />
        )}

        <div className="mt-16 text-center">
          <h2 className="text-2xl font-semibold mb-4">How it works</h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="space-y-2">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-xl font-bold text-primary">1</span>
              </div>
              <h3 className="font-semibold">Upload</h3>
              <p className="text-sm text-muted-foreground">
                Upload your video or audio file (up to 25GB)
              </p>
            </div>
            <div className="space-y-2">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-xl font-bold text-primary">2</span>
              </div>
              <h3 className="font-semibold">Process</h3>
              <p className="text-sm text-muted-foreground">
                Our AI transcribes and identifies speakers automatically
              </p>
            </div>
            <div className="space-y-2">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-xl font-bold text-primary">3</span>
              </div>
              <h3 className="font-semibold">Download</h3>
              <p className="text-sm text-muted-foreground">
                Get your transcript in Markdown format with timestamps
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}