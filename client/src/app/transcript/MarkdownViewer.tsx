'use client'
import { useEffect, useState } from 'react'
import { marked } from 'marked'

export function MarkdownViewer({ markdownUrl }: { markdownUrl: string }) {
  const [html, setHtml] = useState('<p>Loading…</p>')

  useEffect(() => {
    fetch(markdownUrl)
      .then(r => r.text())
      .then(async md => {
        const parsed = await marked.parse(md)
        setHtml(parsed)
        console.debug('[VIEWER] Markdown loaded', { bytes: md.length })
      })
      .catch(err => {
        console.error('[VIEWER] Failed to load markdown', err)
        setHtml('<p class="text-red-600">Failed to load transcript.</p>')
      })
  }, [markdownUrl])

  return <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: html }} />
}