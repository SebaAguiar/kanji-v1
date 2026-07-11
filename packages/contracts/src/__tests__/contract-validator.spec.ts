import 'reflect-metadata';
import { describe, it, expect } from 'bun:test';
import { ContractValidator } from '../validators/contract.validator.js';
import { ValidationSeverity } from '../validation.js';
import { Contract } from '../decorators/contract.js';
import { ContractOf } from '../decorators/contract-of.decorator.js';

describe('ContractValidator Bootstrap Validation', () => {
  it('should pass validation when decorators and contract align perfectly', () => {
    const mockContract = {
      getUser: {
        method: 'GET' as const,
        path: '/:id' as const,
        responses: {},
      },
    };

    @ContractOf(mockContract)
    class ValidController {
      @Contract(mockContract.getUser)
      getUser() {}
    }

    // Set mock Hono routing metadata since we don't import @kanjijs/platform-hono in contracts to prevent cycles
    Reflect.defineMetadata(
      'kanji:http:method',
      { method: 'GET', path: '/:id' },
      ValidController.prototype,
      'getUser'
    );

    const results = ContractValidator.validate(ValidController, mockContract);
    expect(results).toHaveLength(0);
  });

  it('should return an error when a method has @Contract but lacks a Hono route decorator', () => {
    const mockContract = {
      createUser: {
        method: 'POST' as const,
        path: '/' as const,
        responses: {},
      },
    };

    @ContractOf(mockContract)
    class MissingRouteController {
      @Contract(mockContract.createUser)
      createUser() {}
    }

    const results = ContractValidator.validate(MissingRouteController, mockContract);
    
    expect(results).toHaveLength(1);
    expect(results[0].severity).toBe(ValidationSeverity.ERROR);
    expect(results[0].message).toContain('but no HTTP method decorator');
  });

  it('should return an error on HTTP method mismatch', () => {
    const mockContract = {
      updateUser: {
        method: 'PUT' as const,
        path: '/:id' as const,
        responses: {},
      },
    };

    @ContractOf(mockContract)
    class MismatchController {
      @Contract(mockContract.updateUser)
      updateUser() {}
    }

    Reflect.defineMetadata(
      'kanji:http:method',
      { method: 'POST', path: '/:id' }, // contract says PUT, route says POST
      MismatchController.prototype,
      'updateUser'
    );

    const results = ContractValidator.validate(MismatchController, mockContract);

    expect(results).toHaveLength(1);
    expect(results[0].severity).toBe(ValidationSeverity.ERROR);
    expect(results[0].message).toContain('declares PUT but decorator declares POST');
  });

  it('should return a warning when a contract method is not implemented in the controller', () => {
    const mockContract = {
      listUsers: { method: 'GET' as const, path: '/' as const, responses: {} },
      deleteUser: { method: 'DELETE' as const, path: '/:id' as const, responses: {} },
    };

    @ContractOf(mockContract)
    class IncompleteController {
      @Contract(mockContract.listUsers)
      listUsers() {}
    }

    Reflect.defineMetadata(
      'kanji:http:method',
      { method: 'GET', path: '/' },
      IncompleteController.prototype,
      'listUsers'
    );

    const results = ContractValidator.validate(IncompleteController, mockContract);

    const warning = results.find((r) => r.severity === ValidationSeverity.WARN);
    expect(warning).toBeDefined();
    expect(warning!.message).toContain('missing implementations for: deleteUser');
  });
});
