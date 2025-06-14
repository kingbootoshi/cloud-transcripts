import { NextRequest, NextResponse } from 'next/server'
import { serviceClient } from '@/lib/supabase/service'
import { logger } from '@/lib/logger'
import { webhookPayloadSchema } from '@cloud-transcripts/db'
import { JOB_STATUS } from '@cloud-transcripts/shared'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  const log = logger.child({ 
    correlation_id: crypto.randomUUID(),
    endpoint: '/api/webhook/modal',
  })

  try {
    // Verify webhook signature
    const signature = request.headers.get('x-modal-signature')
    const body = await request.text()
    
    const expectedSignature = crypto
      .createHmac('sha256', process.env.WEBHOOK_SECRET!)
      .update(body)
      .digest('hex')

    if (signature !== expectedSignature) {
      log.warn('Invalid webhook signature')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse and validate payload
    const payload = webhookPayloadSchema.parse(JSON.parse(body))
    
    log.info('Received Modal webhook', {
      job_id: payload.job_id,
      status: payload.status,
    })

    // Update database using service role client
    const supabase = serviceClient

    // Update video status
    log.debug('Attempting DB update', { job_id: payload.job_id, target_status: payload.status })
    
    const { error: videoError } = await supabase
      .from('videos')
      .update({ 
        status: payload.status === 'done' ? JOB_STATUS.DONE : JOB_STATUS.ERROR,
        updated_at: new Date().toISOString(),
      })
      .eq('id', payload.job_id)

    if (videoError) {
      log.error('DB_UPDATE_FAIL', {
        error: videoError.message,
        job_id: payload.job_id,
      })
      return NextResponse.json({ error: 'Failed to update video' }, { status: 500 })
    }
    
    log.info('DB_UPDATED', { job_id: payload.job_id, new_status: payload.status === 'done' ? JOB_STATUS.DONE : JOB_STATUS.ERROR })

    // Create transcript record if successful
    if (payload.status === 'done' && payload.md_key && payload.json_key) {
      const { error: transcriptError } = await supabase
        .from('transcripts')
        .insert({
          video_id: payload.job_id,
          markdown_key: payload.md_key,
          json_key: payload.json_key,
        })

      if (transcriptError) {
        log.error('Failed to create transcript record', {
          error: transcriptError.message,
          job_id: payload.job_id,
        })
        return NextResponse.json({ error: 'Failed to create transcript' }, { status: 500 })
      }
    }

    log.info('Webhook processed successfully', {
      job_id: payload.job_id,
      status: payload.status,
    })

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    log.error('Webhook processing failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}