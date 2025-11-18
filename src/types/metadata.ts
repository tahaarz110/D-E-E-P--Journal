export interface FieldDefinition {
    name: string;
    type: 'text' | 'number' | 'textarea' | 'date' | 'select' | 'checkbox';
    ui: {
      label: string;
      readonly?: boolean;
      required?: boolean;
      options?: string[]; // For select fields
      placeholder?: string;
    };
  }
  
  export interface EntityDefinition {
    fields: FieldDefinition[];
  }
  
  export interface Schema {
    entities: {
      [entityName: string]: EntityDefinition;
    };
  }