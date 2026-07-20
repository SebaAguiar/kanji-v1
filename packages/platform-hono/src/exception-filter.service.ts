import type { Context } from 'hono';
import type { ExceptionFilter } from '@kanjijs/common';

export class ExceptionFilterService {
  private filters: Array<{
    targets: Array<new (...args: never[]) => Error>;
    instance: ExceptionFilter;
  }> = [];

  register(instance: ExceptionFilter, targets: Array<new (...args: never[]) => Error>): void {
    this.filters.push({ targets, instance });
  }

  async handle(exception: Error, c: Context): Promise<Response | undefined> {
    for (const filter of this.filters) {
      if (filter.targets.some((t) => exception instanceof t)) {
        return filter.instance.catch(exception, c);
      }
    }
    return undefined;
  }
}
