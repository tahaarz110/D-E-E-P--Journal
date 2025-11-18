import { invoke } from '@tauri-apps/api/tauri';
import { Schema } from '../types/metadata';

export const getSchema = async (entityName: string): Promise<any> => {
  try {
    return await invoke('get_schema', { entityName });
  } catch (error) {
    console.error('Failed to get schema:', error);
    throw error;
  }
};

export const updateSchema = async (schema: Schema): Promise<void> => {
  try {
    await invoke('update_schema', { schema });
  } catch (error) {
    console.error('Failed to update schema:', error);
    throw error;
  }
};

export const saveEntity = async (entityName: string, data: any): Promise<void> => {
  try {
    await invoke('save_entity', { entityName, data });
  } catch (error) {
    console.error('Failed to save entity:', error);
    throw error;
  }
};

export const getAllEntities = async (): Promise<string[]> => {
  try {
    // This would need to be implemented in the backend
    // For now, return hardcoded entities
    return ['Trade'];
  } catch (error) {
    console.error('Failed to get entities:', error);
    return [];
  }
};

export const getEntityData = async (entityName: string): Promise<any[]> => {
  try {
    if (entityName === 'Trade') {
      return await invoke('get_all_trades');
    }
    return [];
  } catch (error) {
    console.error('Failed to get entity data:', error);
    return [];
  }
};