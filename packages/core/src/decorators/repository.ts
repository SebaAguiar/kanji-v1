import { Injectable } from './injectable.js';

/**
 * Repository decorator marks a class as a data access provider.
 * Semantically identical to @Injectable, but communicates database responsibility.
 */
export function Repository(): ClassDecorator {
  return Injectable();
}
