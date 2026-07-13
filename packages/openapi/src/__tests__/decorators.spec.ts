import 'reflect-metadata';
import { describe, it, expect } from 'bun:test';
import {
  Summary,
  Description,
  Tag,
  OPENAPI_SUMMARY_KEY,
  OPENAPI_DESCRIPTION_KEY,
  OPENAPI_TAGS_KEY,
} from '../decorators.js';

describe('OpenAPI Decorators', () => {
  it('should define summary metadata', () => {
    class TestController {
      @Summary('Get item summary')
      getItem() {}
    }

    const summary = Reflect.getMetadata(OPENAPI_SUMMARY_KEY, TestController.prototype, 'getItem');
    expect(summary).toBe('Get item summary');
  });

  it('should define description metadata', () => {
    class TestController {
      @Description('Get item full description')
      getItem() {}
    }

    const description = Reflect.getMetadata(OPENAPI_DESCRIPTION_KEY, TestController.prototype, 'getItem');
    expect(description).toBe('Get item full description');
  });

  it('should define tags metadata', () => {
    class TestController {
      @Tag('items', 'read')
      getItem() {}
    }

    const tags = Reflect.getMetadata(OPENAPI_TAGS_KEY, TestController.prototype, 'getItem');
    expect(tags).toEqual(['items', 'read']);
  });
});
