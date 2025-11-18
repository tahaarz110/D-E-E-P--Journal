import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { useTrade } from '../../contexts/TradeContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useNotifications } from '../../contexts/NotificationContext';
import DashboardHeader from './components/DashboardHeader';
import MetricCards from './components/MetricCards';
import ChartContainer from './components/ChartContainer';
import RecentTrades from './components/RecentTrades';
import PerformanceWidgets from './components/PerformanceWidgets';
import TradingCalendar from './components/TradingCalendar';
import MarketOverview from './components/MarketOverview';
import QuickActionsPanel from './components/QuickActionsPanel';
import { 
  DashboardConfig, 
  WidgetConfig, 
  TimeRange,
  PerformanceMetric 
} from '../../types/dashboard';

// Types
interface DashboardData {
  summary: {
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    openTrades: number;
    winRate: number;
    totalProfit: number;
    netProfit: number;
    averageProfit: number;
    averageLoss: number;
    profitFactor: number;
    expectancy: number;
  };
  charts: {
    equityCurve: any[];
    monthlyPerformance: any[];
    strategyBreakdown: any[];
    timeAnalysis: any[];
    psychologicalMetrics: any[];
  };
  recentActivity: any[];
  marketData: any;
  alerts: any[];
}

// Default dashboard configuration
const DEFAULT_DASHBOARD_CONFIG: DashboardConfig = {
  layout: 'grid',
  refreshInterval: 30000, // 30 seconds
  timeRange: 'month',
  widgets: {
    metrics: true,
    equityCurve: true,
    monthlyPerformance: true,
    strategyBreakdown: true,
    recentTrades: true,
    tradingCalendar: true,
    marketOverview: true,
    quickActions: true
  },
  alerts: {
    enabled: true,
    maxAlerts: 5
  }
};

const DashboardPage: React.FC = () => {
  // Context hooks
  const { state: tradeState, actions: tradeActions } = useTrade();
  const { theme, isRTL } = useTheme();
  const { showNotification } = useNotifications();

  // State management
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [config, setConfig] = useState<DashboardConfig>(DEFAULT_DASHBOARD_CONFIG);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRange>('month');
  const [selectedMetrics, setSelectedMetrics] = useState<Set<string>>(new Set([
    'winRate', 'netProfit', 'totalTrades', 'profitFactor'
  ]));

  // Load dashboard data
  const loadDashboardData = useCallback(async () => {
    try {
      setIsLoading(true);
      
      const data = await invoke<DashboardData>('get_dashboard_data', {
        timeRange: config.timeRange
      });
      
      setDashboardData(data);
      
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      showNotification('error', 'Failed to load dashboard data');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [config.timeRange, showNotification]);

  // Refresh data
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadDashboardData();
    showNotification('success', 'Dashboard updated');
  }, [loadDashboardData, showNotification]);

  // Auto-refresh
  useEffect(() => {
    loadDashboardData();

    if (config.refreshInterval > 0) {
      const interval = setInterval(loadDashboardData, config.refreshInterval);
      return () => clearInterval(interval);
    }
  }, [loadDashboardData, config.refreshInterval]);

  // Calculate additional metrics
  const calculatedMetrics = useMemo((): PerformanceMetric[] => {
    if (!dashboardData) return [];

    const { summary } = dashboardData;
    
    return [
      {
        id: 'consistency',
        label: 'Consistency Score',
        value: calculateConsistency(tradeState.trades),
        format: 'percentage',
        trend: 'up',
        change: 2.5,
        icon: '📈'
      },
      {
        id: 'riskAdjustedReturn',
        label: 'Risk-Adjusted Return',
        value: calculateRiskAdjustedReturn(summary.netProfit, tradeState.trades),
        format: 'percentage',
        trend: 'up',
        change: 1.2,
        icon: '⚖️'
      },
      {
        id: 'avgTradeDuration',
        label: 'Avg Trade Duration',
        value: calculateAverageTradeDuration(tradeState.trades),
        format: 'duration',
        trend: 'down',
        change: -0.5,
        icon: '⏱️'
      },
      {
        id: 'bestStrategy',
        label: 'Best Strategy',
        value: findBestStrategy(tradeState.trades),
        format: 'text',
        trend: 'neutral',
        icon: '🎯'
      },
      {
        id: 'worstSession',
        label: 'Worst Session',
        value: findWorstTradingSession(tradeState.trades),
        format: 'text',
        trend: 'down',
        change: -8.2,
        icon: '📉'
      },
      {
        id: 'maxDrawdown',
        label: 'Max Drawdown',
        value: calculateMaxDrawdown(dashboardData.charts.equityCurve),
        format: 'currency',
        trend: 'down',
        change: -3.1,
        icon: '📊'
      }
    ];
  }, [dashboardData, tradeState.trades]);

  // Metric calculation functions
  const calculateConsistency = (trades: any[]): number => {
    const closedTrades = trades.filter(t => t.is_win !== undefined);
    if (closedTrades.length === 0) return 0;

    let consistencyScore = 0;
    let consecutiveWins = 0;
    let consecutiveLosses = 0;

    closedTrades.forEach(trade => {
      if (trade.is_win) {
        consecutiveWins++;
        consecutiveLosses = 0;
        consistencyScore += consecutiveWins;
      } else {
        consecutiveLosses++;
        consecutiveWins = 0;
        consistencyScore -= consecutiveLosses;
      }
    });

    return Math.max(0, (consistencyScore / closedTrades.length) * 10);
  };

  const calculateRiskAdjustedReturn = (netProfit: number, trades: any[]): number => {
    const closedTrades = trades.filter(t => t.is_win !== undefined);
    if (closedTrades.length === 0) return 0;

    const volatilities = closedTrades.map(trade => 
      Math.abs(trade.profit_loss_money || 0)
    );
    const avgVolatility = volatilities.reduce((a, b) => a + b, 0) / volatilities.length;
    
    return avgVolatility > 0 ? (netProfit / avgVolatility) * 100 : 0;
  };

  const calculateAverageTradeDuration = (trades: any[]): number => {
    const closedTrades = trades.filter(t => t.exit_time && t.entry_time);
    if (closedTrades.length === 0) return 0;

    const totalDuration = closedTrades.reduce((total, trade) => {
      const entry = new Date(trade.entry_time);
      const exit = new Date(trade.exit_time!);
      return total + (exit.getTime() - entry.getTime());
    }, 0);

    return totalDuration / closedTrades.length;
  };

  const findBestStrategy = (trades: any[]): string => {
    const strategyProfits: Record<string, number> = {};
    
    trades.forEach(trade => {
      if (trade.strategy_name && trade.profit_loss_money) {
        strategyProfits[trade.strategy_name] = 
          (strategyProfits[trade.strategy_name] || 0) + (trade.profit_loss_money || 0);
      }
    });

    const bestStrategy = Object.entries(strategyProfits)
      .sort(([, a], [, b]) => b - a)[0];

    return bestStrategy ? bestStrategy[0] : 'N/A';
  };

  const findWorstTradingSession = (trades: any[]): string => {
    const sessionProfits: Record<string, number> = {
      'Asian': 0,
      'European': 0,
      'US': 0,
      'Overlap': 0
    };

    trades.forEach(trade => {
      if (trade.session && trade.profit_loss_money) {
        sessionProfits[trade.session] += trade.profit_loss_money || 0;
      }
    });

    const worstSession = Object.entries(sessionProfits)
      .sort(([, a], [, b]) => a - b)[0];

    return worstSession ? worstSession[0] : 'N/A';
  };

  const calculateMaxDrawdown = (equityCurve: any[]): number => {
    if (!equityCurve || equityCurve.length === 0) return 0;

    let peak = equityCurve[0].equity;
    let maxDrawdown = 0;

    equityCurve.forEach(point => {
      if (point.equity > peak) {
        peak = point.equity;
      }
      const drawdown = ((peak - point.equity) / peak) * 100;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    });

    return maxDrawdown;
  };

  // Handle widget configuration changes
  const handleWidgetConfigChange = useCallback((widgetId: string, newConfig: Partial<WidgetConfig>) => {
    setConfig(prev => ({
      ...prev,
      widgets: {
        ...prev.widgets,
        [widgetId]: newConfig.enabled !== undefined ? newConfig.enabled : prev.widgets[widgetId as keyof typeof prev.widgets]
      }
    }));
  }, []);

  // Handle time range change
  const handleTimeRangeChange = useCallback((newTimeRange: TimeRange) => {
    setTimeRange(newTimeRange);
    setConfig(prev => ({ ...prev, timeRange: newTimeRange }));
  }, []);

  // Handle metric selection
  const handleMetricSelection = useCallback((metricId: string, selected: boolean) => {
    setSelectedMetrics(prev => {
      const newSelection = new Set(prev);
      if (selected) {
        newSelection.add(metricId);
      } else {
        newSelection.delete(metricId);
      }
      return newSelection;
    });
  }, []);

  // Quick actions
  const quickActions = useMemo(() => [
    {
      id: 'new-trade',
      label: 'New Trade',
      icon: '➕',
      action: () => window.location.href = '/add-trade',
      shortcut: 'Ctrl+N'
    },
    {
      id: 'quick-analysis',
      label: 'Quick Analysis',
      icon: '📊',
      action: () => invoke('run_quick_analysis'),
      shortcut: 'Ctrl+Q'
    },
    {
      id: 'export-data',
      label: 'Export Data',
      icon: '📤',
      action: () => tradeActions.exportTrades(),
      shortcut: 'Ctrl+E'
    },
    {
      id: 'backup-now',
      label: 'Backup Now',
      icon: '💾',
      action: () => invoke('create_backup'),
      shortcut: 'Ctrl+B'
    }
  ], [tradeActions]);

    // Loading state
    if (isLoading && !dashboardData) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Loading dashboard...</p>
          </div>
        </div>
      );
    }
  
    return (
      <div className={`dashboard-page ${isRTL ? 'rtl' : 'ltr'} min-h-screen bg-gray-50 dark:bg-gray-900`}>
        {/* Dashboard Header */}
        <DashboardHeader
          title="Trading Dashboard"
          subtitle="Overview of your trading performance and analytics"
          timeRange={timeRange}
          onTimeRangeChange={handleTimeRangeChange}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
          config={config}
          onConfigChange={setConfig}
          isRTL={isRTL}
        />
  
        <div className="container mx-auto px-4 py-6">
          {/* Key Metrics Grid */}
          {config.widgets.metrics && dashboardData && (
            <section className="mb-8">
              <MetricCards
                summary={dashboardData.summary}
                additionalMetrics={calculatedMetrics}
                selectedMetrics={selectedMetrics}
                onMetricSelection={handleMetricSelection}
                timeRange={timeRange}
                isRTL={isRTL}
              />
            </section>
          )}
  
          {/* Charts Grid */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
            {/* Equity Curve */}
            {config.widgets.equityCurve && dashboardData && (
              <ChartContainer
                title="Equity Curve"
                description="Your account growth over time"
                chartType="line"
                data={dashboardData.charts.equityCurve}
                height={400}
                config={config}
                onConfigChange={(newConfig) => handleWidgetConfigChange('equityCurve', newConfig)}
                isRTL={isRTL}
              />
            )}
  
            {/* Monthly Performance */}
            {config.widgets.monthlyPerformance && dashboardData && (
              <ChartContainer
                title="Monthly Performance"
                description="Profit/Loss by month"
                chartType="bar"
                data={dashboardData.charts.monthlyPerformance}
                height={400}
                config={config}
                onConfigChange={(newConfig) => handleWidgetConfigChange('monthlyPerformance', newConfig)}
                isRTL={isRTL}
              />
            )}
  
            {/* Strategy Breakdown */}
            {config.widgets.strategyBreakdown && dashboardData && (
              <ChartContainer
                title="Strategy Breakdown"
                description="Performance by trading strategy"
                chartType="pie"
                data={dashboardData.charts.strategyBreakdown}
                height={400}
                config={config}
                onConfigChange={(newConfig) => handleWidgetConfigChange('strategyBreakdown', newConfig)}
                isRTL={isRTL}
              />
            )}
  
            {/* Performance Widgets */}
            <PerformanceWidgets
              trades={tradeState.trades}
              timeRange={timeRange}
              isRTL={isRTL}
            />
          </div>
  
          {/* Bottom Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Recent Trades */}
            {config.widgets.recentTrades && (
              <div className="lg:col-span-2">
                <RecentTrades
                  trades={tradeState.trades.slice(0, 10)}
                  onTradeClick={(trade) => window.location.href = `/trade-details/${trade.id}`}
                  onEditTrade={(trade) => window.location.href = `/edit-trade/${trade.id}`}
                  isLoading={tradeState.loading}
                  isRTL={isRTL}
                />
              </div>
            )}
  
            {/* Sidebar Widgets */}
            <div className="space-y-6">
              {/* Trading Calendar */}
              {config.widgets.tradingCalendar && (
                <TradingCalendar
                  trades={tradeState.trades}
                  onDateSelect={(date) => {
                    // Filter trades for selected date
                    console.log('Selected date:', date);
                  }}
                  isRTL={isRTL}
                />
              )}
  
              {/* Market Overview */}
              {config.widgets.marketOverview && dashboardData && (
                <MarketOverview
                  marketData={dashboardData.marketData}
                  onSymbolSelect={(symbol) => {
                    // Show details for selected symbol
                    console.log('Selected symbol:', symbol);
                  }}
                  isRTL={isRTL}
                />
              )}
  
              {/* Quick Actions */}
              {config.widgets.quickActions && (
                <QuickActionsPanel
                  actions={quickActions}
                  isRTL={isRTL}
                />
              )}
            </div>
          </div>
  
          {/* Alerts Section */}
          {config.alerts.enabled && dashboardData?.alerts && dashboardData.alerts.length > 0 && (
            <section className="mt-8">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Trading Alerts
                </h3>
                <div className="space-y-3">
                  {dashboardData.alerts.slice(0, config.alerts.maxAlerts).map((alert, index) => (
                    <div
                      key={index}
                      className={`p-3 rounded-md border-l-4 ${
                        alert.type === 'warning' 
                          ? 'bg-yellow-50 border-yellow-400 dark:bg-yellow-900 dark:border-yellow-600' 
                          : alert.type === 'error'
                          ? 'bg-red-50 border-red-400 dark:bg-red-900 dark:border-red-600'
                          : 'bg-blue-50 border-blue-400 dark:bg-blue-900 dark:border-blue-600'
                      }`}
                    >
                      <div className="flex items-start">
                        <div className="flex-shrink-0">
                          {alert.type === 'warning' ? '⚠️' : alert.type === 'error' ? '❌' : 'ℹ️'}
                        </div>
                        <div className="ml-3 flex-1">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {alert.title}
                          </p>
                          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                            {alert.message}
                          </p>
                          {alert.action && (
                            <button
                              onClick={() => invoke(alert.action.handler, alert.action.params)}
                              className="mt-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500"
                            >
                              {alert.action.label}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}
        </div>
  
        {/* Floating Action Button */}
        <button
          onClick={() => window.location.href = '/add-trade'}
          className="fixed bottom-6 right-6 w-14 h-14 bg-blue-500 hover:bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-110"
          aria-label="Add new trade"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>
    );
  };
  
  // Export helper functions for testing
  export {
    calculateConsistency,
    calculateRiskAdjustedReturn,
    calculateAverageTradeDuration,
    findBestStrategy,
    findWorstTradingSession,
    calculateMaxDrawdown
  };
  
  export default DashboardPage;

