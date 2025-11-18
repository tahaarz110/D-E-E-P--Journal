import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { appWindow } from '@tauri-apps/api/window';

// Context Providers
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { TradeProvider } from './contexts/TradeContext';
import { PluginProvider } from './contexts/PluginContext';
import { SchemaProvider } from './contexts/SchemaContext';
import { NotificationProvider, useNotifications } from './contexts/NotificationContext';
import { AuthProvider } from './contexts/AuthContext';
import { MetadataProvider } from './contexts/MetadataContext';
import { BackupProvider } from './contexts/BackupContext';
import { AnalysisProvider } from './contexts/AnalysisContext';

// Core Components
import Header from './components/Header/Header';
import Sidebar from './components/Sidebar/Sidebar';
import LoadingSpinner from './components/UI/LoadingSpinner';
import ErrorBoundary from './components/UI/ErrorBoundary';
import ToastContainer from './components/UI/ToastContainer';
import ConnectionStatus from './components/UI/ConnectionStatus';

// Main Pages
import DashboardPage from './pages/DashboardPage/DashboardPage';
import TradeListPage from './pages/TradeListPage/TradeListPage';
import AddTradePage from './pages/AddTradePage/AddTradePage';
import EditTradePage from './pages/EditTradePage/EditTradePage';
import TradeDetailsPage from './pages/TradeDetailsPage/TradeDetailsPage';
import ICTInsightsPage from './pages/ICTInsightsPage/ICTInsightsPage';
import ICTPatternManagementPage from './pages/ICTPatternManagementPage/ICTPatternManagementPage';

// Meta-driven Pages
import DynamicFormManagementPage from './pages/DynamicFormManagementPage/DynamicFormManagementPage';
import DynamicTabManagementPage from './pages/DynamicTabManagementPage/DynamicTabManagementPage';
import WidgetDashboardPage from './pages/WidgetDashboardPage/WidgetDashboardPage';

// Analysis Pages
import StrategyAnalysisPage from './pages/StrategyAnalysisPage/StrategyAnalysisPage';
import TimeBasedAnalysisPage from './pages/TimeBasedAnalysisPage/TimeBasedAnalysisPage';
import PsychologicalAnalysisPage from './pages/PsychologicalAnalysisPage/PsychologicalAnalysisPage';
import TechnicalAnalysisPage from './pages/TechnicalAnalysisPage/TechnicalAnalysisPage';

// Integration & Tools Pages
import MetaTraderIntegrationPage from './pages/MetaTraderIntegrationPage/MetaTraderIntegrationPage';
import BackupRestorePage from './pages/BackupRestorePage/BackupRestorePage';
import ImageManagementPage from './pages/ImageManagementPage/ImageManagementPage';
import SettingsPage from './pages/SettingsPage/SettingsPage';
import PluginManagementPage from './pages/PluginManagementPage/PluginManagementPage';

// Types
import { AppConfig, AppStatus, UserPreferences } from './types/app';

// Constants
const APP_CONFIG: AppConfig = {
  name: 'Meta-Driven Trading Journal',
  version: '1.0.0',
  minSupportedTauriVersion: '1.0.0',
  features: {
    metaDriven: true,
    pluginSystem: true,
    multiLanguage: true,
    rtlSupport: true,
    darkMode: true,
    realTimeData: true,
    advancedCharts: true,
    backupRestore: true,
    imageManagement: true
  }
};

// Main App Initialization Component
const AppContent: React.FC = () => {
  const { theme, isRTL, language } = useTheme();
  const { showNotification } = useNotifications();
  
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [appStatus, setAppStatus] = useState<AppStatus>('initializing');
  const [appError, setAppError] = useState<string | null>(null);
  const [userPreferences, setUserPreferences] = useState<UserPreferences | null>(null);
  const [isOnline, setIsOnline] = useState(true);

  // Initialize application
  const initializeApp = useCallback(async () => {
    try {
      setAppStatus('initializing');
      
      // Load user preferences
      const preferences = await invoke<UserPreferences>('load_user_preferences');
      setUserPreferences(preferences);

      // Initialize core services in parallel
      await Promise.all([
        invoke('initialize_database'),
        invoke('load_default_schemas'),
        invoke('initialize_plugin_system'),
        invoke('load_application_settings'),
        invoke('verify_data_integrity')
      ]);

      // Start background services
      await Promise.all([
        invoke('start_metatrader_listener'),
        invoke('start_backup_scheduler'),
        invoke('start_performance_monitor')
      ]);

      setAppStatus('ready');
      showNotification('success', 'Application initialized successfully');

    } catch (error) {
      console.error('Failed to initialize app:', error);
      setAppError(`Initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setAppStatus('error');
      showNotification('error', 'Failed to initialize application');
    }
  }, [showNotification]);

  // Handle online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      showNotification('info', 'Connection restored');
    };

    const handleOffline = () => {
      setIsOnline(false);
      showNotification('warning', 'You are currently offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [showNotification]);

  // Initialize app on mount
  useEffect(() => {
    initializeApp();
  }, [initializeApp]);

  // Handle window focus for data refresh
  useEffect(() => {
    const handleFocus = async () => {
      if (appStatus === 'ready') {
        // Refresh critical data when window gains focus
        try {
          await invoke('refresh_cached_data');
        } catch (error) {
          console.error('Error refreshing data:', error);
        }
      }
    };

    const unlisten = appWindow.onFocusChanged(({ payload: focused }) => {
      if (focused) {
        handleFocus();
      }
    });

    return () => {
      unlisten.then(fn => fn());
    };
  }, [appStatus]);

  const direction = isRTL ? 'rtl' : 'ltr';

  // Render loading states
  if (appStatus === 'initializing') {
    return (
      <div className={`min-h-screen ${theme === 'dark' ? 'dark bg-gray-900' : 'bg-gray-50'} flex items-center justify-center`}>
        <div className="text-center">
          <LoadingSpinner size="xlarge" />
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
            Initializing Meta-Driven Trading Journal...
          </p>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-500">
            Loading core modules and data...
          </p>
        </div>
      </div>
    );
  }

  // Render error state
  if (appStatus === 'error') {
    return (
      <div className={`min-h-screen ${theme === 'dark' ? 'dark bg-gray-900' : 'bg-gray-50'} flex items-center justify-center`}>
        <div className="text-center max-w-md p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Initialization Error</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">{appError}</p>
          <div className="space-y-2">
            <button
              onClick={initializeApp}
              className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Retry Initialization
            </button>
            <button
              onClick={() => window.location.reload()}
              className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              Reload Application
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main app layout
  return (
    <Router>
      <div 
        className={`min-h-screen ${theme === 'dark' ? 'dark bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}
        dir={direction}
        lang={language}
      >
        {/* Connection Status Indicator */}
        {!isOnline && (
          <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-500 text-white text-center py-1 text-sm">
            ⚠️ You are currently offline. Some features may be limited.
          </div>
        )}

        <Header 
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)} 
          appConfig={APP_CONFIG}
        />
        
        <div className="flex pt-16">
          <Sidebar 
            isOpen={sidebarOpen} 
            appStatus={appStatus}
            userPreferences={userPreferences}
          />
          
          <main 
            className={`flex-1 transition-all duration-300 ${
              sidebarOpen ? (isRTL ? 'mr-64' : 'ml-64') : (isRTL ? 'mr-0' : 'ml-0')
            }`}
          >
            <div className="p-6">
              <Routes>
                {/* Dashboard & Core Trading */}
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/trades" element={<TradeListPage />} />
                <Route path="/add-trade" element={<AddTradePage />} />
                <Route path="/edit-trade/:id" element={<EditTradePage />} />
                <Route path="/trade-details/:id" element={<TradeDetailsPage />} />
                
                {/* ICT Analysis */}
                <Route path="/ict-insights" element={<ICTInsightsPage />} />
                <Route path="/ict-patterns" element={<ICTPatternManagementPage />} />
                
                {/* Meta-driven Engines */}
                <Route path="/forms-management" element={<DynamicFormManagementPage />} />
                <Route path="/tabs-management" element={<DynamicTabManagementPage />} />
                <Route path="/widget-dashboard" element={<WidgetDashboardPage />} />
                
                {/* Advanced Analysis */}
                <Route path="/strategy-analysis" element={<StrategyAnalysisPage />} />
                <Route path="/time-analysis" element={<TimeBasedAnalysisPage />} />
                <Route path="/psychological-analysis" element={<PsychologicalAnalysisPage />} />
                <Route path="/technical-analysis" element={<TechnicalAnalysisPage />} />
                
                {/* Integration & Tools */}
                <Route path="/metatrader-integration" element={<MetaTraderIntegrationPage />} />
                <Route path="/backup-restore" element={<BackupRestorePage />} />
                <Route path="/image-management" element={<ImageManagementPage />} />
                <Route path="/plugins" element={<PluginManagementPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                
                {/* Fallback route */}
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </div>
          </main>
        </div>

        {/* Toast Notifications */}
        <ToastContainer />
        
        {/* Connection Status */}
        <ConnectionStatus isOnline={isOnline} />
      </div>
    </Router>
  );
};

// Root App Component with all Providers
const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <NotificationProvider>
          <AuthProvider>
            <MetadataProvider>
              <SchemaProvider>
                <TradeProvider>
                  <AnalysisProvider>
                    <PluginProvider>
                      <BackupProvider>
                        <AppContent />
                      </BackupProvider>
                    </PluginProvider>
                  </AnalysisProvider>
                </TradeProvider>
              </SchemaProvider>
            </MetadataProvider>
          </AuthProvider>
        </NotificationProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
};

export default App;

// Performance monitoring hook
const usePerformanceMonitor = () => {
  const { showNotification } = useNotifications();

  useEffect(() => {
    const monitorPerformance = () => {
      // Monitor memory usage
      if (performance.memory) {
        const usedJSHeapSize = performance.memory.usedJSHeapSize;
        const jsHeapSizeLimit = performance.memory.jsHeapSizeLimit;
        
        if (usedJSHeapSize > jsHeapSizeLimit * 0.8) {
          showNotification('warning', 'High memory usage detected. Consider closing some tabs.');
        }
      }

      // Monitor frame rate
      let frameCount = 0;
      let lastTime = performance.now();
      
      const checkFrameRate = (currentTime: number) => {
        frameCount++;
        
        if (currentTime - lastTime >= 1000) {
          const fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
          
          if (fps < 30) {
            showNotification('warning', `Low performance detected (${fps} FPS). Simplifying UI...`);
          }
          
          frameCount = 0;
          lastTime = currentTime;
        }
        
        requestAnimationFrame(checkFrameRate);
      };
      
      requestAnimationFrame(checkFrameRate);
    };

    monitorPerformance();
  }, [showNotification]);
};

// Custom hook for app lifecycle management
const useAppLifecycle = () => {
  const { showNotification } = useNotifications();

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      // Check if there's unsaved data
      const hasUnsavedChanges = document.querySelectorAll('[data-unsaved="true"]').length > 0;
      
      if (hasUnsavedChanges) {
        event.preventDefault();
        event.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return event.returnValue;
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // App is in background
        invoke('reduce_priority');
      } else {
        // App is in foreground
        invoke('restore_priority');
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [showNotification]);

  // Handle Tauri events
  useEffect(() => {
    const setupTauriEvents = async () => {
      try {
        const unlisten = await appWindow.onCloseRequested(async (event) => {
          // Check for unsaved work
          const hasUnsavedWork = await invoke<boolean>('has_unsaved_changes');
          
          if (hasUnsavedWork) {
            event.preventDefault();
            
            const confirmClose = await invoke<boolean>('confirm_application_close');
            if (confirmClose) {
              await invoke('save_unsaved_changes');
              appWindow.close();
            }
          }
        });

        return unlisten;
      } catch (error) {
        console.error('Error setting up Tauri events:', error);
      }
    };

    setupTauriEvents();
  }, []);
};

// Health check hook
const useHealthCheck = () => {
  const [isHealthy, setIsHealthy] = useState(true);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const health = await invoke<{ status: string; issues: string[] }>('health_check');
        setIsHealthy(health.status === 'healthy');
        
        if (health.issues.length > 0) {
          console.warn('Health check issues:', health.issues);
        }
      } catch (error) {
        console.error('Health check failed:', error);
        setIsHealthy(false);
      }
    };

    // Check health every 5 minutes
    const interval = setInterval(checkHealth, 5 * 60 * 1000);
    checkHealth(); // Initial check

    return () => clearInterval(interval);
  }, []);

  return isHealthy;
};

// Export additional utilities for testing
export { usePerformanceMonitor, useAppLifecycle, useHealthCheck };
export { APP_CONFIG };

// Hot reload support for development
if (import.meta.hot) {
  import.meta.hot.accept();
}