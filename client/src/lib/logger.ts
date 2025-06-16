import winston from 'winston'

const isDevelopment = process.env.NODE_ENV === 'development'

// Custom format for development
const devFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaString = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''
    return `${timestamp} ${level}: ${message} ${metaString}`
  })
)

// JSON format for production
const prodFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
)

// Create the logger
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: isDevelopment ? devFormat : prodFormat,
  transports: [
    new winston.transports.Console({
      stderrLevels: ['error'],
    }),
  ],
})

// Helper function to create a child logger with correlation ID
export function createLogger(correlationId: string) {
  return logger.child({ correlation_id: correlationId })
}

// Log uncaught exceptions and unhandled rejections
if (!isDevelopment) {
  logger.exceptions.handle(
    new winston.transports.Console({
      format: prodFormat,
    })
  )

  logger.rejections.handle(
    new winston.transports.Console({
      format: prodFormat,
    })
  )
}