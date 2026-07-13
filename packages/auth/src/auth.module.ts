import { KanjijsModule, type DynamicModule } from '@kanjijs/core';
import { AUTH_CONFIG, SESSION_PROVIDER, type AuthConfig } from './types.js';
import { SessionProvider } from './session.js';
import { OAuthController } from './oauth.controller.js';

@KanjijsModule({
  exports: [SessionProvider, SESSION_PROVIDER],
  global: true,
})
export class AuthModule {
  static forRoot(config: AuthConfig): DynamicModule {
    return {
      module: AuthModule,
      providers: [
        {
          provide: AUTH_CONFIG,
          useValue: config,
        },
        SessionProvider,
        {
          provide: SESSION_PROVIDER,
          useClass: SessionProvider,
        },
      ],
      controllers: [OAuthController],
      exports: [SessionProvider, SESSION_PROVIDER],
      global: true,
    };
  }
}
