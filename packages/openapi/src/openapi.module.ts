import { KanjijsModule, type DynamicModule } from '@kanjijs/core';
import { OPENAPI_CONFIG, type OpenApiConfig } from './types.js';
import { OpenApiController } from './openapi.controller.js';

@KanjijsModule({})
export class OpenApiModule {
  static forRoot(config: OpenApiConfig): DynamicModule {
    return {
      module: OpenApiModule,
      providers: [
        {
          provide: OPENAPI_CONFIG,
          useValue: config,
        },
      ],
      controllers: [OpenApiController],
    };
  }
}
