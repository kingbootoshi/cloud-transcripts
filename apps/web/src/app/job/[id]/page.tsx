'use client'

import { useParams } from 'next/navigation'
import { trpc } from '@/lib/trpc/client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2, CheckCircle, XCircle, Download } from 'lucide-react'
import Link from 'next/link'

function DownloadButton({ transcriptId }: { transcriptId: string }) {
  const [isDownloading, setIsDownloading] = useState(false)
  const downloadMutation = trpc.transcript.getDownloadUrl.useQuery(
    { id: transcriptId, format: 'markdown' },
    { enabled: false }
  )

  const handleDownload = async () => {
    setIsDownloading(true)
    try {
      const result = await downloadMutation.refetch()
      if (result.data?.url) {
        // Create a temporary anchor element to trigger download
        const link = document.createElement('a')
        link.href = result.data.url
        link.download = `transcript-${transcriptId}.md`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      }
    } catch (error) {
      console.error('Download failed:', error)
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <button
      onClick={handleDownload}
      disabled={isDownloading}
      className="inline-flex items-center space-x-2 border border-input bg-background px-4 py-2 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors disabled:opacity-50"
    >
      {isDownloading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Download className="w-4 h-4" />
      )}
      <span>{isDownloading ? 'Downloading...' : 'Download'}</span>
    </button>
  )
}

export default function JobPage() {
  const params = useParams()
  const jobId = params.id as string
  
  const { data: job, isLoading, refetch } = trpc.job.get.useQuery(
    { id: jobId },
    {
      refetchInterval: (query) => {
        // Stop polling if job is done or errored
        if (query.state.data?.status === 'done' || query.state.data?.status === 'error') {
          return false
        }
        // Poll every 2 seconds while processing
        return 2000
      },
    }
  )

  // Set up real-time subscription
  useEffect(() => {
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
        () => {
          refetch()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [jobId, refetch])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    )
  }

  if (!job) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl mb-4">Job not found</p>
          <Link href="/" className="text-primary hover:underline">
            Go back home
          </Link>
        </div>
      </div>
    )
  }

  const StatusIcon = {
    queued: Loader2,
    processing: Loader2,
    done: CheckCircle,
    error: XCircle,
  }[job.status as 'queued' | 'processing' | 'done' | 'error']

  const statusColor = {
    queued: 'text-muted-foreground',
    processing: 'text-primary',
    done: 'text-green-600',
    error: 'text-destructive',
  }[job.status as 'queued' | 'processing' | 'done' | 'error']

  const statusText = {
    queued: 'Waiting in queue...',
    processing: 'Processing your file...',
    done: 'Transcription complete!',
    error: 'An error occurred',
  }[job.status as 'queued' | 'processing' | 'done' | 'error']

  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-2xl mx-auto">
          <Link 
            href="/" 
            className="text-sm text-muted-foreground hover:text-foreground mb-8 inline-block"
          >
            ← Back to home
          </Link>
          
          <div className="bg-card rounded-lg shadow-sm border p-8">
            <div className="flex items-center space-x-4 mb-6">
              <StatusIcon 
                className={`w-8 h-8 ${statusColor} ${
                  (job.status === 'queued' || job.status === 'processing') ? 'animate-spin' : ''
                }`} 
              />
              <div>
                <h1 className="text-2xl font-semibold">{statusText}</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {job.source_type === 'upload' ? 'Uploaded file' : 'YouTube video'}
                </p>
              </div>
            </div>

            {job.status === 'processing' && (
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span>Extracting audio...</span>
                  <span className="text-muted-foreground">✓</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Transcribing with WhisperX...</span>
                  <span className="text-muted-foreground animate-pulse">●</span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Identifying speakers...</span>
                  <span>-</span>
                </div>
              </div>
            )}

            {job.status === 'done' && job.transcripts?.[0] && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Your transcript is ready for download
                </p>
                <div className="flex space-x-3">
                  <Link
                    href={`/transcript/${job.transcripts[0].id}`}
                    className="inline-flex items-center space-x-2 bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors"
                  >
                    <span>View Transcript</span>
                  </Link>
                  <DownloadButton transcriptId={job.transcripts[0].id} />
                </div>
              </div>
            )}

            {job.status === 'error' && (
              <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                <p className="text-sm text-destructive">
                  Something went wrong while processing your file. Please try again.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}