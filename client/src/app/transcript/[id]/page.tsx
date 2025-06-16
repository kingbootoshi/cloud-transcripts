import { notFound } from 'next/navigation'
import { api } from '@/trpc/server'
import { MarkdownViewer } from '../MarkdownViewer'

export default async function TranscriptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    // Get the markdown download URL
    const { url } = await api.transcript.getDownloadUrl({
      id: id,
      format: 'markdown'
    })

    return (
      <div className="container mx-auto py-8 px-4">
        <h1 className="text-2xl font-bold mb-6">Transcript</h1>
        <MarkdownViewer markdownUrl={url} />
      </div>
    )
  } catch (error) {
    console.error('Failed to load transcript', error)
    notFound()
  }
}