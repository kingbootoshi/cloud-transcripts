export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super('E_VALIDATION', message, 400, details)
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super('E_NOT_FOUND', `${resource} not found`, 404)
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super('E_UNAUTHORIZED', message, 401)
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Too many requests') {
    super('E_RATE_LIMIT', message, 429)
  }
}