import { KanjijsModule, type DynamicModule } from '@kanjijs/core';
import { AUTH_CONFIG, SESSION_PROVIDER, type AuthConfig } from './types.js';
import { SessionProvider } from './session.js';

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
      exports: [SessionProvider, SESSION_PROVIDER],
      global: true,
    };
  }
}
