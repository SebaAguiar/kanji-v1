export interface GeneratorOptions {
  crudActions: ('create' | 'findAll' | 'findOne' | 'update' | 'delete')[];
  authModel: 'none' | 'role-based' | 'owner-based';
  dbAdapter: 'postgres' | 'mongodb' | 'none';
  generateTests: boolean;
}
