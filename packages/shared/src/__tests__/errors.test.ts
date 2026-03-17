import { describe, it, expect } from 'vitest';
import {
  AppError,
  NotFoundError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  RateLimitError,
  ExternalServiceError,
} from '../errors.js';

describe('AppError', () => {
  it('creates error with defaults', () => {
    const err = new AppError('Something went wrong');
    expect(err.message).toBe('Something went wrong');
    expect(err.statusCode).toBe(500);
    expect(err.code).toBe('INTERNAL_ERROR');
    expect(err.isOperational).toBe(true);
    expect(err).toBeInstanceOf(Error);
  });
});

describe('NotFoundError', () => {
  it('creates 404 error with resource name', () => {
    const err = new NotFoundError('User', '123');
    expect(err.statusCode).toBe(404);
    expect(err.message).toBe("User with id '123' not found");
  });

  it('creates 404 error without id', () => {
    const err = new NotFoundError('User');
    expect(err.message).toBe('User not found');
  });
});

describe('ValidationError', () => {
  it('creates 400 error', () => {
    const err = new ValidationError('Invalid email');
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('VALIDATION_ERROR');
  });
});

describe('AuthenticationError', () => {
  it('creates 401 error', () => {
    const err = new AuthenticationError();
    expect(err.statusCode).toBe(401);
  });
});

describe('AuthorizationError', () => {
  it('creates 403 error', () => {
    const err = new AuthorizationError();
    expect(err.statusCode).toBe(403);
  });
});

describe('ConflictError', () => {
  it('creates 409 error', () => {
    const err = new ConflictError('Email already exists');
    expect(err.statusCode).toBe(409);
  });
});

describe('RateLimitError', () => {
  it('creates 429 error', () => {
    const err = new RateLimitError();
    expect(err.statusCode).toBe(429);
  });
});

describe('ExternalServiceError', () => {
  it('creates 502 error with service name', () => {
    const err = new ExternalServiceError('Ollama', 'Connection refused');
    expect(err.statusCode).toBe(502);
    expect(err.message).toBe('Ollama: Connection refused');
  });
});
