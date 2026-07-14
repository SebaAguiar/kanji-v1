import 'reflect-metadata';

export interface ExceptionFilter<T = Error> {
  catch(exception: T, context: any): any;
}

const CATCH_DECORATOR_KEY = 'kanji:exception:filters';

export function Catch(...exceptions: Array<new (...args: any[]) => Error>): ClassDecorator {
  return (target) => {
    Reflect.defineMetadata(CATCH_DECORATOR_KEY, exceptions, target);
  };
}

export function getExceptionFilterTargets(target: object): Array<new (...args: any[]) => Error> | undefined {
  return Reflect.getMetadata(CATCH_DECORATOR_KEY, target);
}
