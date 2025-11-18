import React, { useEffect, useState } from 'react';
import { listPlugins, getPluginManifest, executePluginCommand, getPluginInfo } from '../utils/pluginManager';
import { PluginManifest, PluginInfo, CommandDefinition, PluginExecutionResult } from '../types/plugin';
import LoadingSpinner from '../components/LoadingSpinner';
import toast from 'react-hot-toast';

const PluginManagementPage: React.FC = () => {
  const [plugins, setPlugins] = useState<string[]>([]);
  const [selectedPlugin, setSelectedPlugin] = useState<string | null>(null);
  const [manifest, setManifest] = useState<PluginManifest | null>(null);
  const [pluginInfo, setPluginInfo] = useState<any>(null);
  const [selectedCommand, setSelectedCommand] = useState<string | null>(null);
  const [commandInput, setCommandInput] = useState<any>({});
  const [executionResult, setExecutionResult] = useState<PluginExecutionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);

  useEffect(() => {
    loadPlugins();
  }, []);

  const loadPlugins = async () => {
    setLoading(true);
    try {
      const pluginList = await listPlugins();
      setPlugins(pluginList);
      if (pluginList.length > 0) {
        setSelectedPlugin(pluginList[0]);
      }
    } catch (error) {
      toast.error('Failed to load plugins');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedPlugin) {
      loadPluginDetails(selectedPlugin);
    }
  }, [selectedPlugin]);

  const loadPluginDetails = async (pluginName: string) => {
    setLoading(true);
    try {
      const [manifestData, infoData] = await Promise.all([
        getPluginManifest(pluginName),
        getPluginInfo(pluginName)
      ]);
      setManifest(manifestData);
      setPluginInfo(infoData);
      setSelectedCommand(null);
      setCommandInput({});
      setExecutionResult(null);
    } catch (error) {
      toast.error(`Failed to load plugin details for ${pluginName}`);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteCommand = async () => {
    if (!selectedPlugin || !selectedCommand) return;

    setExecuting(true);
    try {
      const result = await executePluginCommand(selectedPlugin, selectedCommand, commandInput);
      setExecutionResult(result);
      
      if (result.success) {
        toast.success(`Command executed successfully in ${result.executionTime?.toFixed(2)}ms`);
      } else {
        toast.error(`Command execution failed: ${result.error}`);
      }
    } catch (error) {
      toast.error('Failed to execute command');
      console.error(error);
    } finally {
      setExecuting(false);
    }
  };

  const renderInputField = (propertyName: string, schema: any) => {
    const type = schema.type;
    const description = schema.description || '';

    switch (type) {
      case 'string':
        return (
          <div key={propertyName}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {propertyName}
              {description && <span className="text-gray-500 text-xs ml-1">({description})</span>}
            </label>
            <input
              type="text"
              value={commandInput[propertyName] || ''}
              onChange={(e) => setCommandInput(prev => ({
                ...prev,
                [propertyName]: e.target.value
              }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
        );

      case 'number':
        return (
          <div key={propertyName}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {propertyName}
              {description && <span className="text-gray-500 text-xs ml-1">({description})</span>}
            </label>
            <input
              type="number"
              value={commandInput[propertyName] || ''}
              onChange={(e) => setCommandInput(prev => ({
                ...prev,
                [propertyName]: parseFloat(e.target.value) || 0
              }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
        );

      case 'array':
        return (
          <div key={propertyName}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {propertyName}
              {description && <span className="text-gray-500 text-xs ml-1">({description})</span>}
            </label>
            <textarea
              value={commandInput[propertyName] ? JSON.stringify(commandInput[propertyName]) : ''}
              onChange={(e) => {
                try {
                  const value = e.target.value ? JSON.parse(e.target.value) : [];
                  setCommandInput(prev => ({ ...prev, [propertyName]: value }));
                } catch {
                  // Invalid JSON, ignore
                }
              }}
              placeholder="Enter as JSON array, e.g., [1, 2, 3]"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 font-mono text-sm"
              rows={3}
            />
          </div>
        );

      case 'object':
        return (
          <div key={propertyName}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {propertyName}
              {description && <span className="text-gray-500 text-xs ml-1">({description})</span>}
            </label>
            <textarea
              value={commandInput[propertyName] ? JSON.stringify(commandInput[propertyName], null, 2) : ''}
              onChange={(e) => {
                try {
                  const value = e.target.value ? JSON.parse(e.target.value) : {};
                  setCommandInput(prev => ({ ...prev, [propertyName]: value }));
                } catch {
                  // Invalid JSON, ignore
                }
              }}
              placeholder="Enter as JSON object"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 font-mono text-sm"
              rows={4}
            />
          </div>
        );

      default:
        return (
          <div key={propertyName}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {propertyName}
              {description && <span className="text-gray-500 text-xs ml-1">({description})</span>}
            </label>
            <input
              type="text"
              value={commandInput[propertyName] || ''}
              onChange={(e) => setCommandInput(prev => ({
                ...prev,
                [propertyName]: e.target.value
              }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
        );
    }
  };

  const renderCommandForm = (command: CommandDefinition) => {
    const properties = command.input_schema.properties || {};
    const required = command.input_schema.required || [];

    return (
      <div className="space-y-4">
        <h4 className="text-lg font-semibold text-gray-900">Command: {command.name}</h4>
        <p className="text-gray-600">{command.description}</p>
        
        <div className="space-y-3">
          {Object.keys(properties).map(propertyName => 
            renderInputField(propertyName, properties[propertyName])
          )}
        </div>

        <button
          onClick={handleExecuteCommand}
          disabled={executing}
          className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
        >
          {executing ? 'Executing...' : 'Execute Command'}
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Plugin Management</h1>
        <button
          onClick={loadPlugins}
          className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-md shadow-sm hover:bg-primary-700"
        >
          Refresh Plugins
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Plugin List */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Available Plugins</h3>
          {loading ? (
            <LoadingSpinner text="Loading plugins..." />
          ) : (
            <div className="space-y-2">
              {plugins.map(plugin => (
                <button
                  key={plugin}
                  onClick={() => setSelectedPlugin(plugin)}
                  className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                    selectedPlugin === plugin
                      ? 'bg-primary-50 border-primary-200 text-primary-700'
                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <div className="font-medium">{plugin}</div>
                  {pluginInfo && pluginInfo.name === plugin && (
                    <div className="text-sm text-gray-500 mt-1">
                      v{pluginInfo.version} by {pluginInfo.author}
                    </div>
                  )}
                </button>
              ))}
              {plugins.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No plugins found
                </div>
              )}
            </div>
          )}
        </div>

        {/* Plugin Details and Commands */}
        <div className="lg:col-span-2 space-y-6">
          {selectedPlugin && manifest && (
            <>
              {/* Plugin Info */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{manifest.name}</h3>
                <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 mb-4">
                  <div>
                    <strong>Version:</strong> {manifest.version}
                  </div>
                  <div>
                    <strong>Author:</strong> {manifest.author}
                  </div>
                </div>
                <p className="text-gray-700">{manifest.description}</p>
              </div>

              {/* Available Commands */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Available Commands</h3>
                <div className="space-y-3">
                  {Object.entries(manifest.commands).map(([commandName, command]) => (
                    <button
                      key={commandName}
                      onClick={() => {
                        setSelectedCommand(commandName);
                        setCommandInput({});
                        setExecutionResult(null);
                      }}
                      className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                        selectedCommand === commandName
                          ? 'bg-primary-50 border-primary-200 text-primary-700'
                          : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <div className="font-medium">{command.name}</div>
                      <div className="text-sm text-gray-500 mt-1">{command.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Command Execution */}
              {selectedCommand && manifest.commands[selectedCommand] && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  {renderCommandForm(manifest.commands[selectedCommand])}
                </div>
              )}

              {/* Execution Result */}
              {executionResult && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Execution Result</h3>
                  <div className={`p-4 rounded-lg ${
                    executionResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                  }`}>
                    <div className="flex justify-between items-start mb-2">
                      <span className={`font-medium ${
                        executionResult.success ? 'text-green-800' : 'text-red-800'
                      }`}>
                        {executionResult.success ? 'Success' : 'Error'}
                      </span>
                      {executionResult.executionTime && (
                        <span className="text-sm text-gray-500">
                          {executionResult.executionTime.toFixed(2)}ms
                        </span>
                      )}
                    </div>
                    {executionResult.success ? (
                      <pre className="text-sm text-green-700 bg-green-100 p-3 rounded overflow-x-auto">
                        {JSON.stringify(executionResult.data, null, 2)}
                      </pre>
                    ) : (
                      <p className="text-red-700">{executionResult.error}</p>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PluginManagementPage;