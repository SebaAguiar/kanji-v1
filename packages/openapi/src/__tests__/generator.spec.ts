import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { HttpMetadataStorage, Controller, Get } from '@kanjijs/platform-hono';
import { OpenApiGenerator } from '../generator.js';
import { Summary, Tag } from '../decorators.js';
import type { OpenApiConfig } from '../types.js';

const config: OpenApiConfig = { title: 'Test API', version: '0.0.1' };

let controllersSnapshot: Map<Function, string>;
let routesSnapshot: Map<Function, any[]>;

@Controller('/items')
export class ItemController {
  @Get('/')
  @Summary('Get all items')
  @Tag('Items')
  findAll() {}
}

describe('OpenApiGenerator', () => {
  beforeAll(() => {
    const storage = HttpMetadataStorage.getInstance();
    controllersSnapshot = new Map(storage.controllers);
    routesSnapshot = new Map(storage.routes);
  });

  afterAll(() => {
    const storage = HttpMetadataStorage.getInstance();
    (storage as any).controllers = controllersSnapshot;
    (storage as any).routes = routesSnapshot;
  });

  it('generates spec with correct title and version', () => {
    const generator = new OpenApiGenerator(config);
    const spec = generator.generateSpec();
    expect(spec.openapi).toBe('3.0.0');
    expect(spec.info.title).toBe('Test API');
    expect(spec.info.version).toBe('0.0.1');
  });

  it('reads @Summary decorator metadata into operation.summary', () => {
    const generator = new OpenApiGenerator(config);
    const spec = generator.generateSpec();
    const operation = spec.paths['/items']?.get;
    expect(operation?.summary).toBe('Get all items');
  });

  it('reads @Tag decorator metadata into operation.tags', () => {
    const generator = new OpenApiGenerator(config);
    const spec = generator.generateSpec();
    const operation = spec.paths['/items']?.get;
    expect(operation?.tags).toEqual(['Items']);
  });
});
