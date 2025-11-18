import { invoke } from '@tauri-apps/api/tauri';
import { PluginManifest, PluginInfo, PluginExecutionResult } from '../types/plugin';

export const listPlugins = async (): Promise<string[]> => {
  try {
    return await invoke('list_plugins');
  } catch (error) {
    console.error('Failed to list plugins:', error);
    return [];
  }
};

export const getPluginManifest = async (pluginName: string): Promise<PluginManifest | null> => {
  try {
    return await invoke('get_plugin_manifest', { pluginName });
  } catch (error) {
    console.error('Failed to get plugin manifest:', error);
    return null;
  }
};

export const executePluginCommand = async (
  pluginName: string,
  commandName: string,
  input: any
): Promise<PluginExecutionResult> => {
  try {
    const startTime = performance.now();
    const result = await invoke('execute_plugin_command', {
      pluginName,
      commandName,
      input
    });
    const executionTime = performance.now() - startTime;
    
    return {
      success: true,
      data: result,
      executionTime
    };
  } catch (error) {
    console.error('Failed to execute plugin command:', error);
    return {
      success: false,
      error: error as string
    };
  }
};

export const getPluginInfo = async (pluginName: string): Promise<any> => {
  try {
    return await invoke('get_plugin_info', { pluginName });
  } catch (error) {
    console.error('Failed to get plugin info:', error);
    return null;
  }
};