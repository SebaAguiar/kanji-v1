// packages/contracts/src/types.ts

import { z } from 'zod';

export interface KanjiContract {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD';
  path: string;
  request?: {
    body?: z.ZodTypeAny;
    params?: z.ZodTypeAny;
    query?: z.ZodTypeAny;
    headers?: z.ZodTypeAny;
  };
  responses: Record<number, z.ZodTypeAny>;
}

export interface WebSocketContract {
  body: z.ZodTypeAny;
}

export type KanjiContractUnion = KanjiContract | WebSocketContract;
