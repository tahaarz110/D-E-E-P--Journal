import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { open } from '@tauri-apps/api/dialog';
import { useTheme } from '../contexts/ThemeContext';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/LoadingSpinner';

const SettingsPage: React.FC = () => {
  const [backupStatus, setBackupStatus] = useState<string | null>(null);
  const [restoreStatus, setRestoreStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { theme, toggleTheme, language, setLanguage } = useTheme();

  const handleCreateBackup = async () => {
    setLoading(true);
    setBackupStatus(null);
    try {
      const backupPath = await invoke('create_backup');
      setBackupStatus(`Backup created successfully at: ${backupPath}`);
      toast.success('Backup created successfully!');
    } catch (error) {
      const errorMsg = `Failed to create backup: ${error}`;
      setBackupStatus(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreBackup = async () => {
    setLoading(true);
    setRestoreStatus(null);
    try {
      const selected = await open({
        multiple: false,
        filters: [{
          name: 'Zip',
          extensions: ['zip']
        }]
      });
      if (selected && typeof selected === 'string') {
        await invoke('restore_from_backup', { zipPath: selected });
        setRestoreStatus('Backup restored successfully! Please restart the application.');
        toast.success('Backup restored successfully! Please restart the application.');
      } else {
        setRestoreStatus('No file selected.');
        toast.error('No file selected.');
      }
    } catch (error) {
      const errorMsg = `Failed to restore backup: ${error}`;
      setRestoreStatus(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleThemeChange = (newTheme: 'light' | 'dark') => {
    if (theme !== newTheme) {
      toggleTheme();
    }
  };

  const handleLanguageChange = (newLanguage: 'en' | 'fa') => {
    if (language !== newLanguage) {
      setLanguage(newLanguage);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Settings</h1>

      {/* Appearance Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Appearance</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Theme
            </label>
            <div className="flex space-x-4">
              <button
                onClick={() => handleThemeChange('light')}
                className={`flex-1 px-4 py-2 border rounded-md text-center ${
                  theme === 'light'
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600'
                }`}
              >
                Light
              </button>
              <button
                onClick={() => handleThemeChange('dark')}
                className={`flex-1 px-4 py-2 border rounded-md text-center ${
                  theme === 'dark'
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600'
                }`}
              >
                Dark
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Language
            </label>
            <div className="flex space-x-4">
              <button
                onClick={() => handleLanguageChange('en')}
                className={`flex-1 px-4 py-2 border rounded-md text-center ${
                  language === 'en'
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600'
                }`}
              >
                English
              </button>
              <button
                onClick={() => handleLanguageChange('fa')}
                className={`flex-1 px-4 py-2 border rounded-md text-center ${
                  language === 'fa'
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600'
                }`}
              >
                فارسی
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Backup and Restore Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Backup & Restore</h3>
        
        <div className="space-y-4">
          <div>
            <button
              onClick={handleCreateBackup}
              disabled={loading}
              className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-md shadow-sm hover:bg-primary-700 disabled:opacity-50"
            >
              {loading ? <LoadingSpinner size="sm" /> : null}
              <span>{loading ? 'Creating Backup...' : 'Create Backup'}</span>
            </button>
            {backupStatus && (
              <p className={`mt-2 text-sm ${
                backupStatus.includes('successfully') 
                  ? 'text-green-600 dark:text-green-400' 
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {backupStatus}
              </p>
            )}
          </div>

          <div>
            <button
              onClick={handleRestoreBackup}
              disabled={loading}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md shadow-sm hover:bg-green-700 disabled:opacity-50"
            >
              {loading ? <LoadingSpinner size="sm" /> : null}
              <span>{loading ? 'Restoring...' : 'Restore from Backup'}</span>
            </button>
            {restoreStatus && (
              <p className={`mt-2 text-sm ${
                restoreStatus.includes('successfully') 
                  ? 'text-green-600 dark:text-green-400' 
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {restoreStatus}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* MetaTrader Integration Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">MetaTrader Integration</h3>
        <div className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            The MetaTrader integration server is running on <code className="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded">localhost:1421</code>.
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Use the provided Expert Advisor (EA) in MetaTrader to automatically send trades to this application.
          </p>
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">Endpoint Details:</h4>
            <ul className="text-sm text-blue-700 dark:text-blue-400 space-y-1">
              <li><strong>URL:</strong> http://localhost:1421/trade</li>
              <li><strong>Method:</strong> POST</li>
              <li><strong>Content-Type:</strong> application/json</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Application Info Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Application Information</h3>
        <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
          <p><strong>Version:</strong> 1.0.0</p>
          <p><strong>Author:</strong> Meta-Driven Trading Journal Team</p>
          <p><strong>Description:</strong> Advanced trading journal with ICT analysis and meta-driven architecture</p>
          <p><strong>Technology Stack:</strong> Tauri, Rust, React, TypeScript, SQLite</p>
        </div>
      </div>

      {/* Data Management Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Data Management</h3>
        <div className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Your data is stored locally in the application data directory. Backups include:
          </p>
          <ul className="text-sm text-gray-600 dark:text-gray-400 list-disc list-inside space-y-1">
            <li>SQLite database (trading_journal.db)</li>
            <li>Schema definitions (schema.json)</li>
            <li>All uploaded images and thumbnails</li>
            <li>Application settings</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;