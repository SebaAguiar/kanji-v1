import 'reflect-metadata';
import { ValidationSeverity, type ValidationResult } from '../validation';
import { getRegisteredContractActions } from '../decorators/contract';
import type { KanjiContract } from '../types';

interface HttpRouteMeta {
  method: string;
  path: string;
}

export class ContractValidator {
  public static validate(
    controller: Function,
    declaredContract: Record<string, KanjiContract> | null,
  ): ValidationResult[] {
    const results: ValidationResult[] = [];
    const implementedMethods = getRegisteredContractActions(controller);
    const declaredMethods = declaredContract ? Object.keys(declaredContract) : [];

    if (!declaredContract) {
      return results; // No @ContractOf declared, skip validation
    }

    // === ERRORS: Mismatches and orphan contracts (block startup) ===
    for (const methodName of implementedMethods) {
      const contract: KanjiContract | undefined = Reflect.getMetadata(
        'kanji:contract',
        controller.prototype,
        methodName,
      );
      const httpMeta: HttpRouteMeta | undefined = Reflect.getMetadata(
        'kanji:http:method',
        controller.prototype,
        methodName,
      );
      const file: string | undefined = Reflect.getMetadata(
        'kanji:location',
        controller.prototype,
        methodName,
      );

      // Error 1: @Contract declared but no HTTP method decorator
      if (contract && !httpMeta) {
        results.push({
          severity: ValidationSeverity.ERROR,
          message: `Method '${methodName}' has @Contract but no HTTP method decorator (@Get, @Post, etc.)`,
          location: { controller: controller.name, method: methodName, file },
          suggestion: `Add @${contract.method}('${contract.path}') above the method`,
        });
        continue;
      }

      // Error 2: HTTP method mismatch (e.g. contract is POST, decorator is @Get)
      if (contract && httpMeta && contract.method.toUpperCase() !== httpMeta.method.toUpperCase()) {
        results.push({
          severity: ValidationSeverity.ERROR,
          message: `Method '${methodName}': @Contract declares ${contract.method} but decorator declares ${httpMeta.method}`,
          location: { controller: controller.name, method: methodName, file },
          suggestion: `Change the HTTP decorator to @${contract.method.toLowerCase()}() or update the contract`,
        });
      }

      // Error 3: Path mismatch
      if (contract && httpMeta) {
        const contractPath = contract.path.replace(/\/+/g, '/');
        const httpPath = httpMeta.path.replace(/\/+/g, '/');
        if (contractPath !== httpPath) {
          results.push({
            severity: ValidationSeverity.ERROR,
            message: `Method '${methodName}': @Contract declares path '${contract.path}' but decorator declares '${httpMeta.path}'`,
            location: { controller: controller.name, method: methodName, file },
            suggestion: `Change the path in the decorator to match: @${contract.method}('${contract.path}')`,
          });
        }
      }
    }

    // === WARNINGS: Incomplete endpoints or missing contracts (non-blocking) ===
    for (const methodName of implementedMethods) {
      const contract = Reflect.getMetadata('kanji:contract', controller.prototype, methodName);
      const httpMeta: HttpRouteMeta | undefined = Reflect.getMetadata(
        'kanji:http:method',
        controller.prototype,
        methodName,
      );
      const file: string | undefined = Reflect.getMetadata(
        'kanji:location',
        controller.prototype,
        methodName,
      );

      // Warning 1: Implemented route but missing contract schema
      if (httpMeta && !contract) {
        results.push({
          severity: ValidationSeverity.WARN,
          message: `Method '${methodName}' has @${httpMeta.method} but no @Contract decorator`,
          location: { controller: controller.name, method: methodName, file },
          suggestion: `Add @Contract(UserContracts.${methodName}) or remove the HTTP endpoint if not needed`,
        });
      }
    }

    // Warning 2: Declared in contract but missing implementation in controller
    const missing = declaredMethods.filter((m) => !implementedMethods.has(m));
    if (missing.length > 0) {
      // For class level warnings, we can grab the location from the first implemented method or controller class constructor
      // Since it's class level, we just locate it generally
      results.push({
        severity: ValidationSeverity.WARN,
        message: `${controller.name} declares @ContractOf but is missing implementations for: ${missing.join(', ')}`,
        location: { controller: controller.name },
        suggestion:
          `Implement these methods or remove them from the contract. Example template:\n` +
          missing
            .map(
              (m) =>
                `  @${declaredContract[m].method}('${declaredContract[m].path}') @Contract(Contracts.${m}) async ${m}(c: Context) { }`,
            )
            .join('\n'),
      });
    }

    // Warning 3: Implemented in controller but not part of declared contract
    const extra = Array.from(implementedMethods).filter(
      (m) =>
        Reflect.getMetadata('kanji:contract', controller.prototype, m) &&
        !declaredMethods.includes(m),
    );
    for (const methodName of extra) {
      const file: string | undefined = Reflect.getMetadata(
        'kanji:location',
        controller.prototype,
        methodName,
      );
      results.push({
        severity: ValidationSeverity.WARN,
        message: `${controller.name} implements '${methodName}' but it is not in the declared @ContractOf contract`,
        location: { controller: controller.name, method: methodName, file },
        suggestion: `Add this method to the contract object or remove the @Contract decorator from it`,
      });
    }

    return results;
  }
}
