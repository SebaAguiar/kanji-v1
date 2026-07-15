export function isValidArtifactType(type: string): boolean {
  const allowedTypes = ['resource', 'module', 'controller', 'service', 'repository'];
  return allowedTypes.includes(type.toLowerCase().trim());
}

export function validateNameInput(val: string): boolean | string {
  return val.trim().length > 0 ? true : 'Name is required';
}
