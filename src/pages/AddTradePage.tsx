import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { useNavigate } from 'react-router-dom';
import DynamicForm from '../components/DynamicForm/DynamicForm';
import { NewTrade } from '../types/trade';

const AddTradePage: React.FC = () => {
  const navigate = useNavigate();
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useDynamicForm, setUseDynamicForm] = useState(true);

  const handleDynamicSubmit = (data: any) => {
    console.log('Trade created via dynamic form:', data);
    setSuccess(true);
    setTimeout(() => {
      setSuccess(false);
      navigate('/trades');
    }, 2000);
  };

  const handleDynamicError = (errorMsg: string) => {
    setError(errorMsg);
  };

  // Traditional form handler as backup
  const handleTraditionalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    const formData = new FormData(e.target as HTMLFormElement);
    const trade: NewTrade = {
      symbol: formData.get('symbol') as string,
      trade_type: formData.get('trade_type') as string,
      volume: parseFloat(formData.get('volume') as string),
      entry_price: parseFloat(formData.get('entry_price') as string),
      sl: parseFloat(formData.get('sl') as string),
      tp: parseFloat(formData.get('tp') as string),
      entry_time: new Date(formData.get('entry_time') as string).toISOString(),
      notes: formData.get('notes') as string || undefined,
    };

    try {
      await invoke('create_trade', { trade });
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        navigate('/trades');
      }, 2000);
    } catch (err) {
      setError('Failed to create trade: ' + err);
    }
  };

  const handleCancel = () => {
    navigate('/trades');
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Add New Trade</h1>
        <div className="flex space-x-4">
          <div className="flex items-center">
            <label className="flex items-center text-sm text-gray-700">
              <input
                type="checkbox"
                checked={useDynamicForm}
                onChange={(e) => setUseDynamicForm(e.target.checked)}
                className="mr-2"
              />
              Use Dynamic Form
            </label>
          </div>
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50"
          >
            Back to Trades
          </button>
        </div>
      </div>

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
          Trade created successfully! Redirecting...
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        {useDynamicForm ? (
          <DynamicForm 
            entityName="Trade" 
            onSubmit={handleDynamicSubmit}
            onCancel={handleCancel}
            showCancel={true}
          />
        ) : (
          <form onSubmit={handleTraditionalSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Symbol */}
              <div>
                <label htmlFor="symbol" className="block text-sm font-medium text-gray-700 mb-2">
                  Symbol *
                </label>
                <input
                  type="text"
                  id="symbol"
                  name="symbol"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  placeholder="e.g., EURUSD"
                />
              </div>

              {/* Trade Type */}
              <div>
                <label htmlFor="trade_type" className="block text-sm font-medium text-gray-700 mb-2">
                  Trade Type *
                </label>
                <select
                  id="trade_type"
                  name="trade_type"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="Buy">Buy</option>
                  <option value="Sell">Sell</option>
                </select>
              </div>

              {/* Volume */}
              <div>
                <label htmlFor="volume" className="block text-sm font-medium text-gray-700 mb-2">
                  Volume (Lots) *
                </label>
                <input
                  type="number"
                  id="volume"
                  name="volume"
                  step="0.01"
                  min="0.01"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              {/* Entry Price */}
              <div>
                <label htmlFor="entry_price" className="block text-sm font-medium text-gray-700 mb-2">
                  Entry Price *
                </label>
                <input
                  type="number"
                  id="entry_price"
                  name="entry_price"
                  step="0.00001"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              {/* Stop Loss */}
              <div>
                <label htmlFor="sl" className="block text-sm font-medium text-gray-700 mb-2">
                  Stop Loss *
                </label>
                <input
                  type="number"
                  id="sl"
                  name="sl"
                  step="0.00001"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              {/* Take Profit */}
              <div>
                <label htmlFor="tp" className="block text-sm font-medium text-gray-700 mb-2">
                  Take Profit *
                </label>
                <input
                  type="number"
                  id="tp"
                  name="tp"
                  step="0.00001"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>

            {/* Entry Time */}
            <div>
              <label htmlFor="entry_time" className="block text-sm font-medium text-gray-700 mb-2">
                Entry Time *
              </label>
              <input
                type="datetime-local"
                id="entry_time"
                name="entry_time"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            {/* Notes */}
            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
                Notes
              </label>
              <textarea
                id="notes"
                name="notes"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                placeholder="Additional notes about the trade..."
              />
            </div>

            {/* Commission */}
            <div>
              <label htmlFor="commission" className="block text-sm font-medium text-gray-700 mb-2">
                Commission
              </label>
              <input
                type="number"
                id="commission"
                name="commission"
                step="0.01"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            {/* Submit Buttons */}
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-primary-600 text-white font-medium rounded-md shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                Add Trade
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Additional Information */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-sm font-medium text-blue-800 mb-2">Trade Information</h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• All fields marked with * are required</li>
          <li>• Entry time should be in your local timezone</li>
          <li>• Volume is in standard lots (1.0 = 100,000 units)</li>
          <li>• Use the dynamic form for schema-driven customization</li>
        </ul>
      </div>
    </div>
  );
};

export default AddTradePage;