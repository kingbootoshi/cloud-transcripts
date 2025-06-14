import { appRouter } from '@/server/routers'
import { createContext } from '@/server/trpc'

export const api = appRouter.createCaller(createContext)