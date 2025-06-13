import { initTRPC, TRPCError } from '@trpc/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import superjson from 'superjson'

export const createContext = async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  return {
    supabase,
    user,
    correlationId: crypto.randomUUID(),
  }
}

export type Context = Awaited<ReturnType<typeof createContext>>

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof z.ZodError
            ? error.cause.flatten()
            : null,
      },
    }
  },
})

export const router = t.router
export const publicProcedure = t.procedure.use(async (opts) => {
  const start = Date.now()
  const log = logger.child({ 
    correlation_id: opts.ctx.correlationId,
    procedure: opts.path,
    type: opts.type,
  })

  log.info('tRPC request started')

  const result = await opts.next({
    ctx: {
      ...opts.ctx,
      logger: log,
    },
  })

  const duration = Date.now() - start
  log.info('tRPC request completed', { duration_ms: duration })

  return result
})

export const protectedProcedure = publicProcedure.use(async (opts) => {
  if (!opts.ctx.user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You must be logged in to perform this action',
    })
  }

  return opts.next({
    ctx: {
      ...opts.ctx,
      user: opts.ctx.user,
    },
  })
})