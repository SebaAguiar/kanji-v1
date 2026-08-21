import 'reflect-metadata';

export interface ExceptionFilter<T = Error> {
  catch(exception: T, context: unknown): unknown;
}

const CATCH_DECORATOR_KEY = 'kanji:exception:filters';

export function Catch(
  ...exceptions: Array<abstract new (...args: never[]) => Error>
): ClassDecorator {
  return (target) => {
    Reflect.defineMetadata(CATCH_DECORATOR_KEY, exceptions, target);
  };
}

export function getExceptionFilterTargets(
  target: object,
): Array<abstract new (...args: never[]) => Error> | undefined {
  return Reflect.getMetadata(CATCH_DECORATOR_KEY, target);
}
