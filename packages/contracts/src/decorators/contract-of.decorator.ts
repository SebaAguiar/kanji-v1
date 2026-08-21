import type { ContractClass } from '../types.js';
import 'reflect-metadata';
import type { KanjiContract } from '../types.js';

export function ContractOf(contracts: Record<string, KanjiContract>): ClassDecorator {
  return (target) => {
    Reflect.defineMetadata('kanji:contract-of', contracts, target);
  };
}

export function getControllerContract(
  controllerClass: ContractClass,
): Record<string, KanjiContract> | null {
  return Reflect.getMetadata('kanji:contract-of', controllerClass) || null;
}
