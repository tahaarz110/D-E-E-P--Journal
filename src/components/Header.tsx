import React, { useState, useMemo, useCallback } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useTrade } from '../../contexts/TradeContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { invoke } from '@tauri-apps/api/tauri';

// Components
import SearchBox from '../UI/SearchBox';
import UserMenu from './UserMenu';
import QuickActions from './QuickActions';
import StatusIndicator from './StatusIndicator';
import NotificationBell from './NotificationBell';

// Types
interface HeaderProps {
  onMenuToggle: () => void;
  appConfig: {
    name: string;
    version: string;
    features: Record<string, boolean>;
  };
}

interface AppStatus {
  database: 'connected' | 'disconnected' | 'error';
  metatrader: 'connected' | 'disconnected' | 'connecting';
  plugins: 'loaded' | 'loading' | 'error';
  sync: 'synced' | 'syncing' | 'error';
}

const Header: React.FC<HeaderProps> = ({ onMenuToggle, appConfig }) => {
  const { theme, toggleTheme, language, setLanguage, isRTL } = useTheme();
  const { state: tradeState, actions: tradeActions } = useTrade();
  const { notifications, markAsRead, clearAllNotifications } = useNotifications();
  
  const [appStatus, setAppStatus] = useState<AppStatus>({
    database: 'connected',
    metatrader: 'disconnected',
    plugins: 'loaded',
    sync: 'synced'
  });
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);

  // Memoized status indicators
  const statusIndicators = useMemo(() => [
    {
      key: 'database',
      label: 'Database',
      status: appStatus.database,
      icon: '💾',
      tooltip: 'Trade database connection'
    },
    {
      key: 'metatrader',
      label: 'MetaTrader',
      status: appStatus.metatrader,
      icon: '📈',
      tooltip: 'MetaTrader integration status'
    },
    {
      key: 'plugins',
      label: 'Plugins',
      status: appStatus.plugins,
      icon: '🔌',
      tooltip: 'Plugin system status'
    },
    {
      key: 'sync',
      label: 'Sync',
      status: appStatus.sync,
      icon: '🔄',
      tooltip: 'Data synchronization status'
    }
  ], [appStatus]);

  // Unread notifications count
  const unreadNotificationsCount = useMemo(() => {
    return notifications.filter(notification => !notification.read).length;
  }, [notifications]);

  // Quick actions
  const quickActions = useMemo(() => [
    {
      id: 'new-trade',
      label: 'New Trade',
      icon: '➕',
      shortcut: 'Ctrl+N',
      action: () => {
        // Navigate to add trade page
        window.location.href = '/add-trade';
      }
    },
    {
      id: 'quick-stats',
      label: 'Quick Stats',
      icon: '📊',
      shortcut: 'Ctrl+S',
      action: async () => {
        const stats = await invoke('get_quick_stats');
        // Show stats in modal or toast
      }
    },
    {
      id: 'export-data',
      label: 'Export Data',
      icon: '📤',
      shortcut: 'Ctrl+E',
      action: () => tradeActions.exportTrades()
    },
    {
      id: 'backup-now',
      label: 'Backup Now',
      icon: '💾',
      shortcut: 'Ctrl+B',
      action: async () => {
        await invoke('create_backup');
      }
    }
  ], [tradeActions]);

  // Handle search
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    
    if (query.trim()) {
      // Implement search logic
      tradeActions.applyAdvancedFilters({
        // Search in symbol, notes, strategy, etc.
      });
    } else {
      tradeActions.applyAdvancedFilters({});
    }
  }, [tradeActions]);

  // Handle theme toggle
  const handleThemeToggle = useCallback(() => {
    toggleTheme();
  }, [toggleTheme]);

  // Handle language change
  const handleLanguageChange = useCallback((newLanguage: string) => {
    setLanguage(newLanguage as any);
  }, [setLanguage]);

  // Refresh status
  const refreshStatus = useCallback(async () => {
    try {
      const status = await invoke<AppStatus>('get_application_status');
      setAppStatus(status);
    } catch (error) {
      console.error('Failed to refresh status:', error);
    }
  }, []);

  // Auto-refresh status every 30 seconds
  React.useEffect(() => {
    refreshStatus();
    const interval = setInterval(refreshStatus, 30000);
    return () => clearInterval(interval);
  }, [refreshStatus]);

  return (
    <header className={`
      fixed top-0 left-0 right-0 z-50 
      bg-white dark:bg-gray-800 
      shadow-md border-b border-gray-200 dark:border-gray-700
      transition-colors duration-200
    `}>
      <div className="flex items-center justify-between h-16 px-4">
        {/* Left Section - Menu Button & App Info */}
        <div className="flex items-center flex-1">
          <button
            onClick={onMenuToggle}
            className={`
              p-2 rounded-md 
              text-gray-600 dark:text-gray-300 
              hover:bg-gray-100 dark:hover:bg-gray-700
              focus:outline-none focus:ring-2 focus:ring-blue-500
              transition-colors duration-200
              ${isRTL ? 'ml-4' : 'mr-4'}
            `}
            aria-label="Toggle menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* App Logo & Name */}
          <div className="flex items-center">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">MJ</span>
            </div>
            <div className={`${isRTL ? 'mr-3' : 'ml-3'}`}>
              <h1 className="text-lg font-semibold text-gray-800 dark:text-white">
                {appConfig.name}
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                v{appConfig.version}
              </p>
            </div>
          </div>

          {/* Status Indicators */}
          <div className={`hidden md:flex items-center ${isRTL ? 'mr-6' : 'ml-6'} space-x-2`}>
            {statusIndicators.map((indicator) => (
              <StatusIndicator
                key={indicator.key}
                status={indicator.status}
                icon={indicator.icon}
                tooltip={indicator.tooltip}
              />
            ))}
          </div>
        </div>

        {/* Center Section - Search Box */}
        <div className="flex-1 max-w-2xl mx-4">
          <SearchBox
            value={searchQuery}
            onChange={handleSearch}
            onFocusChange={setIsSearchFocused}
            placeholder={isRTL ? "جستجو در معاملات..." : "Search trades..."}
            isRTL={isRTL}
          />
        </div>

        {/* Right Section - Actions & User Menu */}
        <div className="flex items-center justify-end flex-1 space-x-2">
          {/* Quick Actions */}
          <QuickActions
            actions={quickActions}
            isOpen={quickActionsOpen}
            onToggle={() => setQuickActionsOpen(!quickActionsOpen)}
            isRTL={isRTL}
          />

          {/* Notification Bell */}
          <NotificationBell
            count={unreadNotificationsCount}
            notifications={notifications}
            onMarkAsRead={markAsRead}
            onClearAll={clearAllNotifications}
            isRTL={isRTL}
          />

          {/* Theme Toggle */}
          <button
            onClick={handleThemeToggle}
            className={`
              p-2 rounded-md 
              text-gray-600 dark:text-gray-300 
              hover:bg-gray-100 dark:hover:bg-gray-700
              focus:outline-none focus:ring-2 focus:ring-blue-500
              transition-colors duration-200
            `}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
              </svg>
            )}
          </button>

          {/* Language Selector */}
          <select
            value={language}
            onChange={(e) => handleLanguageChange(e.target.value)}
            className={`
              px-3 py-1 border border-gray-300 dark:border-gray-600 
              rounded-md bg-white dark:bg-gray-700 
              text-gray-900 dark:text-white 
              focus:outline-none focus:ring-2 focus:ring-blue-500
              transition-colors duration-200
            `}
          >
            <option value="en">English</option>
            <option value="fa">فارسی</option>
            <option value="ar">العربية</option>
            <option value="tr">Türkçe</option>
          </select>

          {/* User Menu */}
          <UserMenu
            isOpen={userMenuOpen}
            onToggle={() => setUserMenuOpen(!userMenuOpen)}
            isRTL={isRTL}
          />
        </div>
      </div>

      {/* Secondary Header - Stats & Quick Info */}
      <div className="bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600">
        <div className="px-4 py-2">
          <div className="flex items-center justify-between text-sm">
            {/* Trade Stats */}
            <div className="flex items-center space-x-4">
              <span className="text-gray-600 dark:text-gray-400">
                Total: <strong className="text-gray-800 dark:text-white">{tradeState.stats.total_trades}</strong>
              </span>
              <span className="text-green-600 dark:text-green-400">
                Wins: <strong>{tradeState.stats.winning_trades}</strong>
              </span>
              <span className="text-red-600 dark:text-red-400">
                Losses: <strong>{tradeState.stats.losing_trades}</strong>
              </span>
              <span className="text-blue-600 dark:text-blue-400">
                Win Rate: <strong>{tradeState.stats.win_rate.toFixed(1)}%</strong>
              </span>
              <span className={`${tradeState.stats.net_profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                P/L: <strong>${tradeState.stats.net_profit.toFixed(2)}</strong>
              </span>
            </div>

            {/* Last Updated */}
            <div className="text-gray-500 dark:text-gray-400 text-xs">
              {tradeState.lastUpdated && (
                <>Last updated: {new Date(tradeState.lastUpdated).toLocaleTimeString()}</>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;