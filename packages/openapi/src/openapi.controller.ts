import 'reflect-metadata';
import { type Context } from 'hono';
import { Controller, Get } from '@kanjijs/platform-hono';
import { Inject } from '@kanjijs/core';
import { OpenApiGenerator } from './generator.js';
import { buildSwaggerHtml } from './swagger-ui.js';
import { buildReDocHtml } from './redoc-ui.js';
import { OPENAPI_CONFIG, type OpenApiConfig } from './types.js';

@Controller('/api')
export class OpenApiController {
  constructor(@Inject(OPENAPI_CONFIG) private readonly config: OpenApiConfig) {}

  @Get('/openapi.json')
  spec(c: Context): Response {
    const generator = new OpenApiGenerator(this.config);
    return c.json(generator.generateSpec());
  }

  @Get('/docs')
  docs(c: Context): Response {
    const specPath = this.config.specPath ?? '/api/openapi.json';
    return c.html(buildSwaggerHtml(specPath, this.config.title));
  }

  @Get('/docs/redoc')
  redoc(c: Context): Response {
    const specPath = this.config.specPath ?? '/api/openapi.json';
    return c.html(buildReDocHtml(specPath, this.config.title));
  }
}
