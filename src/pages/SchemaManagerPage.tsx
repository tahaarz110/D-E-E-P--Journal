import React, { useEffect, useState } from 'react';
import { getSchema, updateSchema } from '../utils/schemaManager';
import { Schema } from '../types/metadata';

const SchemaManagerPage: React.FC = () => {
  const [schema, setSchema] = useState<Schema | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [editedSchema, setEditedSchema] = useState<string>('');

  useEffect(() => {
    loadSchema();
  }, []);

  const loadSchema = async () => {
    try {
      setLoading(true);
      // We'll get the full schema by requesting a known entity and building the full schema
      const tradeSchema = await getSchema('Trade');
      const fullSchema: Schema = {
        entities: {
          Trade: tradeSchema
        }
      };
      setSchema(fullSchema);
      setEditedSchema(JSON.stringify(fullSchema, null, 2));
      setError(null);
    } catch (err) {
      setError('Failed to load schema');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSchema = async () => {
    if (!editedSchema) return;

    try {
      const parsedSchema: Schema = JSON.parse(editedSchema);
      await updateSchema(parsedSchema);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      // Reload the schema to get any updates
      await loadSchema();
    } catch (err) {
      setError('Failed to update schema - Invalid JSON');
      console.error(err);
    }
  };

  const handleSchemaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditedSchema(e.target.value);
    setError(null);
  };

  const handleReset = () => {
    if (schema) {
      setEditedSchema(JSON.stringify(schema, null, 2));
    }
    setError(null);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg text-gray-600">Loading schema...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Schema Manager</h1>
        <div className="flex space-x-3">
          <button
            onClick={handleReset}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50"
          >
            Reset
          </button>
          <button
            onClick={handleSaveSchema}
            className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-md shadow-sm hover:bg-primary-700"
          >
            Save Schema
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
          Schema updated successfully!
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Schema Definition</h3>
          <p className="text-sm text-gray-600 mt-1">
            Edit the JSON schema to customize forms and tables. Changes will be applied after saving.
          </p>
        </div>
        <textarea
          value={editedSchema}
          onChange={handleSchemaChange}
          rows={25}
          className="w-full px-6 py-4 text-sm font-mono text-gray-800 focus:outline-none resize-y"
          spellCheck={false}
        />
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-medium text-blue-800 mb-2">Schema Tips:</h4>
        <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
          <li>Add new fields to automatically create database columns</li>
          <li>Supported field types: text, number, textarea, date, select, checkbox</li>
          <li>For select fields, provide options array in the ui object</li>
          <li>Set required: true to make fields mandatory</li>
          <li>Set readonly: true for display-only fields</li>
        </ul>
      </div>
    </div>
  );
};

export default SchemaManagerPage;