import { createClient } from '@supabase/supabase-js'
import type { Database } from '@cloud-transcripts/db'

const serviceClient = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: { Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` },
    },
  }
)

export { serviceClient }