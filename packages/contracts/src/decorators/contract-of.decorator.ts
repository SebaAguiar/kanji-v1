import 'reflect-metadata';
import type { KanjiContract } from '../types';

export function ContractOf(contracts: Record<string, KanjiContract>): ClassDecorator {
  return (target: Function) => {
    Reflect.defineMetadata('kanji:contract-of', contracts, target);
  };
}

export function getControllerContract(controllerClass: Function): Record<string, KanjiContract> | null {
  return Reflect.getMetadata('kanji:contract-of', controllerClass) || null;
}
