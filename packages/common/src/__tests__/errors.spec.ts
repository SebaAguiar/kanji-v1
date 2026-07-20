import { describe, it, expect } from 'bun:test';
import {
  KanjiError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ValidationError,
  TooManyRequestsError,
} from '../utils/errors.js';

describe('KanjiError', () => {
  it('should create with default values', () => {
    const err = new KanjiError('Something went wrong');
    expect(err.message).toBe('Something went wrong');
    expect(err.statusCode).toBe(500);
    expect(err.code).toBe('INTERNAL_ERROR');
    expect(err.name).toBe('KanjiError');
  });

  it('should create with custom status and code', () => {
    const err = new KanjiError('Custom', 418, 'CUSTOM_CODE');
    expect(err.statusCode).toBe(418);
    expect(err.code).toBe('CUSTOM_CODE');
  });
});

describe('BadRequestError', () => {
  it('should have status 400 and code BAD_REQUEST', () => {
    const err = new BadRequestError('Invalid input');
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('BAD_REQUEST');
    expect(err.name).toBe('BadRequestError');
    expect(err).toBeInstanceOf(KanjiError);
  });
});

describe('UnauthorizedError', () => {
  it('should have status 401 and code UNAUTHORIZED', () => {
    const err = new UnauthorizedError();
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('UNAUTHORIZED');
    expect(err.message).toBe('Unauthorized');
    expect(err).toBeInstanceOf(KanjiError);
  });
});

describe('ForbiddenError', () => {
  it('should have status 403 and code FORBIDDEN', () => {
    const err = new ForbiddenError('Access denied');
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe('FORBIDDEN');
    expect(err).toBeInstanceOf(KanjiError);
  });
});

describe('NotFoundError', () => {
  it('should have status 404 and code NOT_FOUND', () => {
    const err = new NotFoundError('User not found');
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
    expect(err).toBeInstanceOf(KanjiError);
  });
});

describe('ConflictError', () => {
  it('should have status 409 and code CONFLICT', () => {
    const err = new ConflictError('Email already exists');
    expect(err.statusCode).toBe(409);
    expect(err.code).toBe('CONFLICT');
    expect(err).toBeInstanceOf(KanjiError);
  });
});

describe('ValidationError', () => {
  it('should have status 422 and code VALIDATION_ERROR', () => {
    const issues = [
      { path: 'email', code: 'invalid_email', message: 'Invalid email format' },
    ];
    const err = new ValidationError(issues, 'Validation failed');
    expect(err.statusCode).toBe(422);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.issues).toEqual(issues);
    expect(err).toBeInstanceOf(KanjiError);
  });
});

describe('TooManyRequestsError', () => {
  it('should have status 429 and code TOO_MANY_REQUESTS', () => {
    const err = new TooManyRequestsError('Rate limit exceeded');
    expect(err.statusCode).toBe(429);
    expect(err.code).toBe('TOO_MANY_REQUESTS');
    expect(err).toBeInstanceOf(KanjiError);
  });
});

describe('Error hierarchy', () => {
  it('should be instanceof checks correctly', () => {
    const errors = [
      new KanjiError('base'),
      new BadRequestError('bad'),
      new UnauthorizedError('unauth'),
      new ForbiddenError('forbid'),
      new NotFoundError('not found'),
      new ConflictError('conflict'),
      new ValidationError([], 'val'),
      new TooManyRequestsError('429'),
    ];

    for (const err of errors) {
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(KanjiError);
    }
  });
});
