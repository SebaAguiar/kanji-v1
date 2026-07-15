export function ensurePropertyInDecorator(content: string, propertyName: string): string {
  const regex = new RegExp(`\\b${propertyName}:`);
  if (!regex.test(content)) {
    return content.replace(/@KanjijsModule\(\{/, `@KanjijsModule({\n  ${propertyName}: [],`);
  }
  return content;
}

export function updateAppModule(fileContent: string, moduleName: string, importPath: string): string {
  if (fileContent.includes(moduleName)) {
    return fileContent;
  }

  const importStatement = `import { ${moduleName} } from '${importPath}';\n`;
  let updatedContent = fileContent;
  const lastImportIndex = fileContent.lastIndexOf('import ');
  if (lastImportIndex !== -1) {
    const nextNewLine = fileContent.indexOf('\n', lastImportIndex);
    if (nextNewLine !== -1) {
      updatedContent = fileContent.slice(0, nextNewLine + 1) + importStatement + fileContent.slice(nextNewLine + 1);
    } else {
      updatedContent = importStatement + fileContent;
    }
  } else {
    updatedContent = importStatement + fileContent;
  }

  updatedContent = ensurePropertyInDecorator(updatedContent, 'imports');
  const importsIndex = updatedContent.indexOf('imports:');
  if (importsIndex === -1) {
    return updatedContent;
  }

  const openBracketIndex = updatedContent.indexOf('[', importsIndex);
  if (openBracketIndex === -1) {
    return updatedContent;
  }

  let bracketCount = 1;
  let closeBracketIndex = -1;
  for (let i = openBracketIndex + 1; i < updatedContent.length; i++) {
    if (updatedContent[i] === '[') {
      bracketCount++;
    } else if (updatedContent[i] === ']') {
      bracketCount--;
      if (bracketCount === 0) {
        closeBracketIndex = i;
        break;
      }
    }
  }

  if (closeBracketIndex === -1) {
    return updatedContent;
  }

  const innerContent = updatedContent.slice(openBracketIndex + 1, closeBracketIndex);
  const trimmedInner = innerContent.replace(/^\s*\n/, '').trimEnd();

  let newInner = '';
  if (trimmedInner.trim().length === 0) {
    // Buscar la indentación de la línea de imports:
    const beforeImports = updatedContent.slice(0, importsIndex);
    const lastLineBeforeImports = beforeImports.split('\n').pop() || '';
    const closeIndentMatch = lastLineBeforeImports.match(/^(\s*)/);
    const closeIndent = closeIndentMatch ? closeIndentMatch[1] : '  ';
    
    newInner = `\n${closeIndent}  ${moduleName},\n${closeIndent}`;
  } else {
    const isMultiline = innerContent.includes('\n');
    if (isMultiline) {
      const lines = innerContent.split('\n').filter(line => line.trim().length > 0);
      const lastLine = lines[lines.length - 1];
      const indentationMatch = lastLine.match(/^(\s*)/);
      const indent = indentationMatch ? indentationMatch[1] : '    ';
      
      const beforeImports = updatedContent.slice(0, importsIndex);
      const lastLineBeforeImports = beforeImports.split('\n').pop() || '';
      const closeIndentMatch = lastLineBeforeImports.match(/^(\s*)/);
      const closeIndent = closeIndentMatch ? closeIndentMatch[1] : '  ';

      if (trimmedInner.endsWith(',')) {
        newInner = `\n${trimmedInner}\n${indent}${moduleName},\n${closeIndent}`;
      } else {
        newInner = `\n${trimmedInner},\n${indent}${moduleName},\n${closeIndent}`;
      }
    } else {
      newInner = `${trimmedInner.trim()}, ${moduleName}`;
    }
  }

  updatedContent = updatedContent.slice(0, openBracketIndex + 1) + newInner + updatedContent.slice(closeBracketIndex);
  return updatedContent;
}

export function updateLocalModule(
  fileContent: string,
  className: string,
  importPath: string,
  arrayName: 'controllers' | 'providers' | 'exports'
): string {
  let updatedContent = fileContent;
  const importStatement = `import { ${className} } from '${importPath}';\n`;
  if (!fileContent.includes(importStatement)) {
    const lastImportIndex = fileContent.lastIndexOf('import ');
    if (lastImportIndex !== -1) {
      const nextNewLine = fileContent.indexOf('\n', lastImportIndex);
      if (nextNewLine !== -1) {
        updatedContent = fileContent.slice(0, nextNewLine + 1) + importStatement + fileContent.slice(nextNewLine + 1);
      } else {
        updatedContent = importStatement + fileContent;
      }
    } else {
      updatedContent = importStatement + fileContent;
    }
  }

  updatedContent = ensurePropertyInDecorator(updatedContent, arrayName);
  const propertyKey = `${arrayName}:`;
  const propertyIndex = updatedContent.indexOf(propertyKey);
  if (propertyIndex === -1) {
    return updatedContent;
  }

  const openBracketIndex = updatedContent.indexOf('[', propertyIndex);
  if (openBracketIndex === -1) {
    return updatedContent;
  }

  let bracketCount = 1;
  let closeBracketIndex = -1;
  for (let i = openBracketIndex + 1; i < updatedContent.length; i++) {
    if (updatedContent[i] === '[') {
      bracketCount++;
    } else if (updatedContent[i] === ']') {
      bracketCount--;
      if (bracketCount === 0) {
        closeBracketIndex = i;
        break;
      }
    }
  }

  if (closeBracketIndex === -1) {
    return updatedContent;
  }

  const innerContent = updatedContent.slice(openBracketIndex + 1, closeBracketIndex);
  
  const elementRegex = new RegExp(`\\b${className}\\b`);
  if (elementRegex.test(innerContent)) {
    return updatedContent;
  }

  const trimmedInner = innerContent.replace(/^\s*\n/, '').trimEnd();

  let newInner = '';
  if (trimmedInner.trim().length === 0) {
    const beforeProperty = updatedContent.slice(0, propertyIndex);
    const lastLineBeforeProperty = beforeProperty.split('\n').pop() || '';
    const closeIndentMatch = lastLineBeforeProperty.match(/^(\s*)/);
    const closeIndent = closeIndentMatch ? closeIndentMatch[1] : '  ';
    
    newInner = `\n${closeIndent}  ${className},\n${closeIndent}`;
  } else {
    const isMultiline = innerContent.includes('\n');
    if (isMultiline) {
      const lines = innerContent.split('\n').filter(line => line.trim().length > 0);
      const lastLine = lines[lines.length - 1];
      const indentationMatch = lastLine.match(/^(\s*)/);
      const indent = indentationMatch ? indentationMatch[1] : '    ';
      
      const beforeProperty = updatedContent.slice(0, propertyIndex);
      const lastLineBeforeProperty = beforeProperty.split('\n').pop() || '';
      const closeIndentMatch = lastLineBeforeProperty.match(/^(\s*)/);
      const closeIndent = closeIndentMatch ? closeIndentMatch[1] : '  ';

      if (trimmedInner.endsWith(',')) {
        newInner = `\n${trimmedInner}\n${indent}${className},\n${closeIndent}`;
      } else {
        newInner = `\n${trimmedInner},\n${indent}${className},\n${closeIndent}`;
      }
    } else {
      newInner = `${trimmedInner.trim()}, ${className}`;
    }
  }

  updatedContent = updatedContent.slice(0, openBracketIndex + 1) + newInner + updatedContent.slice(closeBracketIndex);
  return updatedContent;
}
