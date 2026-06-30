export type Constructor<T = object> = new (...args: never[]) => T;

export type Token<T = object> = string | symbol | Constructor<T>;

export interface ValueProvider<T = object> {
  provide: Token<T>;
  useValue: T;
}

export interface ClassProvider<T = object> {
  provide: Token<T>;
  useClass: Constructor<T>;
}

export interface FactoryProvider<T = object> {
  provide: Token<T>;
  useFactory: (...args: Array<object>) => T | Promise<T>;
  inject?: Array<Token<object>>;
}

export type Provider<T = object> =
  | Constructor<T>
  | ValueProvider<T>
  | ClassProvider<T>
  | FactoryProvider<T>;

export interface ModuleMetadata {
  imports?: Array<Constructor<object> | DynamicModule>;
  controllers?: Array<Constructor<object>>;
  providers?: Array<Provider<object>>;
  exports?: Array<Token<object>>;
  global?: boolean;
}

export interface DynamicModule {
  module: Constructor<object>;
  imports?: Array<Constructor<object> | DynamicModule>;
  providers?: Array<Provider<object>>;
  exports?: Array<Token<object>>;
  global?: boolean;
}
