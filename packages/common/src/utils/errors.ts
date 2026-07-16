export class KanjiError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(message: string, statusCode: number = 500, code: string = 'INTERNAL_ERROR') {
    super(message);
    this.name = 'KanjiError';
    this.statusCode = statusCode;
    this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends KanjiError {
  constructor(message: string = 'Bad request', code: string = 'BAD_REQUEST') {
    super(message, 400, code);
    this.name = 'BadRequestError';
  }
}

export class UnauthorizedError extends KanjiError {
  constructor(message: string = 'Unauthorized', code: string = 'UNAUTHORIZED') {
    super(message, 401, code);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends KanjiError {
  constructor(message: string = 'Forbidden', code: string = 'FORBIDDEN') {
    super(message, 403, code);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends KanjiError {
  constructor(message: string = 'Resource not found', code: string = 'NOT_FOUND') {
    super(message, 404, code);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends KanjiError {
  constructor(message: string = 'Resource conflict', code: string = 'CONFLICT') {
    super(message, 409, code);
    this.name = 'ConflictError';
  }
}

export class ValidationError extends KanjiError {
  public readonly issues: Array<{ path: string; code: string; message: string }>;

  constructor(
    issues: Array<{ path: string; code: string; message: string }>,
    message: string = 'Validation failed',
  ) {
    super(message, 422, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
    this.issues = issues;
  }
}

export class TooManyRequestsError extends KanjiError {
  constructor(message: string = 'Too many requests', code: string = 'TOO_MANY_REQUESTS') {
    super(message, 429, code);
    this.name = 'TooManyRequestsError';
  }
}
