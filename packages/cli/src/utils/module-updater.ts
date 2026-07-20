import {
  Project,
  SyntaxKind,
  ObjectLiteralExpression,
  QuoteKind,
  SourceFile,
  ImportDeclaration,
  PropertyAssignment,
  ArrayLiteralExpression,
  ObjectLiteralElementLike,
} from 'ts-morph';

export function ensurePropertyInDecorator(content: string, propertyName: string): string {
  const project = new Project({
    useInMemoryFileSystem: true,
    manipulationSettings: { quoteKind: QuoteKind.Single },
  });
  const sourceFile = project.createSourceFile('temp.ts', content);

  const classDec = sourceFile.getClasses()[0];
  const decorator = classDec?.getDecorator('KanjijsModule') || classDec?.getDecorator('Module');
  if (!decorator) return content;

  const callExpr = decorator.getCallExpression();
  if (!callExpr) return content;

  const objLiteral = callExpr.getArguments()[0];
  if (!objLiteral || !ObjectLiteralExpression.isObjectLiteralExpression(objLiteral)) return content;

  const existingProp = objLiteral.getProperty(propertyName);
  if (existingProp) return content;

  objLiteral.addPropertyAssignment({
    name: propertyName,
    initializer: '[]',
  });

  return sourceFile.getFullText();
}

function addImportIfMissing(sourceFile: SourceFile, moduleName: string, importPath: string): void {
  const existingImport = sourceFile.getImportDeclaration((dec: ImportDeclaration) => {
    const spec = dec.getModuleSpecifierValue();
    return spec === importPath || spec === importPath.replace(/\.js$/, '');
  });

  if (existingImport) {
    const namedImports = existingImport.getNamedImports().map((i) => i.getName());
    if (!namedImports.includes(moduleName)) {
      existingImport.addNamedImport(moduleName);
    }
  } else {
    // Find last import declaration to insert after
    const imports = sourceFile.getImportDeclarations();
    if (imports.length > 0) {
      const lastImport = imports[imports.length - 1];
      sourceFile.insertImportDeclaration(lastImport.getChildIndex() + 1, {
        namedImports: [moduleName],
        moduleSpecifier: importPath,
      });
    } else {
      sourceFile.addImportDeclaration({
        namedImports: [moduleName],
        moduleSpecifier: importPath,
      });
    }
  }
}

function addElementToArrayProperty(
  sourceFile: SourceFile,
  propertyName: string,
  elementName: string,
): void {
  const classDec = sourceFile.getClasses()[0];
  const decorator = classDec?.getDecorator('KanjijsModule') || classDec?.getDecorator('Module');
  if (!decorator) return;

  const callExpr = decorator.getCallExpression();
  if (!callExpr) return;

  const objLiteral = callExpr.getArguments()[0];
  if (!objLiteral || !ObjectLiteralExpression.isObjectLiteralExpression(objLiteral)) return;

  let prop: ObjectLiteralElementLike | undefined = objLiteral.getProperty(propertyName);
  if (!prop) {
    prop = objLiteral.addPropertyAssignment({
      name: propertyName,
      initializer: '[]',
    });
  }

  if (prop && prop.getKind() === SyntaxKind.PropertyAssignment) {
    const propAssignment = prop as PropertyAssignment;
    const init = propAssignment.getInitializer();
    if (init && init.getKind() === SyntaxKind.ArrayLiteralExpression) {
      const arrayInit = init as ArrayLiteralExpression;
      const elements = arrayInit.getElements().map((e) => e.getText().trim());
      if (!elements.includes(elementName)) {
        arrayInit.addElement(elementName);
      }
    }
  }
}

export function updateAppModule(
  fileContent: string,
  moduleName: string,
  importPath: string,
): string {
  const project = new Project({
    useInMemoryFileSystem: true,
    manipulationSettings: { quoteKind: QuoteKind.Single },
  });
  const sourceFile = project.createSourceFile('temp.ts', fileContent);

  addImportIfMissing(sourceFile, moduleName, importPath);
  addElementToArrayProperty(sourceFile, 'imports', moduleName);

  return sourceFile.getFullText();
}

export function updateLocalModule(
  fileContent: string,
  className: string,
  importPath: string,
  arrayName: 'controllers' | 'providers' | 'exports' | 'gateways',
): string {
  const project = new Project({
    useInMemoryFileSystem: true,
    manipulationSettings: { quoteKind: QuoteKind.Single },
  });
  const sourceFile = project.createSourceFile('temp.ts', fileContent);

  addImportIfMissing(sourceFile, className, importPath);
  addElementToArrayProperty(sourceFile, arrayName, className);

  return sourceFile.getFullText();
}
