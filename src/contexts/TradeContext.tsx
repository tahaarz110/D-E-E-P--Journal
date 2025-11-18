import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { useNotifications } from './NotificationContext';

// Types
export interface Trade {
  id: number;
  symbol: string;
  trade_type: 'Buy' | 'Sell';
  volume: number;
  entry_price: number;
  sl: number;
  tp: number;
  entry_time: string;
  exit_time?: string;
  exit_price?: number;
  commission?: number;
  swap?: number;
  notes?: string;
  is_win?: boolean;
  profit_loss_pips?: number;
  profit_loss_money?: number;
  risk_reward_ratio?: number;
  
  // ICT Fields
  ict_pattern?: string;
  pattern_type?: string;
  pattern_size?: number;
  pattern_timeframe?: string;
  pattern_combination?: string[];
  chart_explanation?: string;
  
  // Meta-driven fields
  strategy_name?: string;
  emotion?: string;
  confidence_level?: number;
  market_condition?: string;
  session?: string;
  
  // Image fields
  entry_image?: string;
  exit_image?: string;
  analysis_image?: string;
  
  // Technical fields
  rsi?: number;
  macd?: number;
  moving_average?: number;
  support_level?: number;
  resistance_level?: number;
  
  // Audit fields
  created_at: string;
  updated_at: string;
  version: number;
}

export interface TradeFilters {
  symbol?: string[];
  trade_type?: ('Buy' | 'Sell')[];
  date_range?: {
    start: string;
    end: string;
  };
  ict_pattern?: string[];
  strategy_name?: string[];
  is_win?: boolean;
  min_profit?: number;
  max_profit?: number;
  emotion?: string[];
  market_condition?: string[];
}

export interface TradeStats {
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  open_trades: number;
  win_rate: number;
  total_profit: number;
  total_loss: number;
  net_profit: number;
  average_profit: number;
  average_loss: number;
  largest_win: number;
  largest_loss: number;
  average_risk_reward: number;
  profit_factor: number;
  expectancy: number;
}

export interface TradeState {
  trades: Trade[];
  filteredTrades: Trade[];
  selectedTrade: Trade | null;
  filters: TradeFilters;
  stats: TradeStats;
  loading: boolean;
  error: string | null;
  lastUpdated: string | null;
  hasUnsavedChanges: boolean;
  bulkOperation: {
    inProgress: boolean;
    type: 'delete' | 'update' | 'export' | null;
    progress: number;
    total: number;
  };
}

// Actions
type TradeAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_TRADES'; payload: Trade[] }
  | { type: 'ADD_TRADE'; payload: Trade }
  | { type: 'UPDATE_TRADE'; payload: Trade }
  | { type: 'DELETE_TRADE'; payload: number }
  | { type: 'SELECT_TRADE'; payload: Trade | null }
  | { type: 'SET_FILTERS'; payload: TradeFilters }
  | { type: 'APPLY_FILTERS' }
  | { type: 'CLEAR_FILTERS' }
  | { type: 'SET_STATS'; payload: TradeStats }
  | { type: 'SET_UNSAVED_CHANGES'; payload: boolean }
  | { type: 'START_BULK_OPERATION'; payload: { type: 'delete' | 'update' | 'export'; total: number } }
  | { type: 'UPDATE_BULK_PROGRESS'; payload: number }
  | { type: 'COMPLETE_BULK_OPERATION' }
  | { type: 'REFRESH_DATA' };

// Initial state
const initialState: TradeState = {
  trades: [],
  filteredTrades: [],
  selectedTrade: null,
  filters: {},
  stats: {
    total_trades: 0,
    winning_trades: 0,
    losing_trades: 0,
    open_trades: 0,
    win_rate: 0,
    total_profit: 0,
    total_loss: 0,
    net_profit: 0,
    average_profit: 0,
    average_loss: 0,
    largest_win: 0,
    largest_loss: 0,
    average_risk_reward: 0,
    profit_factor: 0,
    expectancy: 0
  },
  loading: false,
  error: null,
  lastUpdated: null,
  hasUnsavedChanges: false,
  bulkOperation: {
    inProgress: false,
    type: null,
    progress: 0,
    total: 0
  }
};

// Reducer
const tradeReducer = (state: TradeState, action: TradeAction): TradeState => {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    
    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false };
    
    case 'SET_TRADES':
      return { 
        ...state, 
        trades: action.payload,
        filteredTrades: action.payload,
        loading: false,
        lastUpdated: new Date().toISOString()
      };
    
    case 'ADD_TRADE':
      const newTrades = [action.payload, ...state.trades];
      return {
        ...state,
        trades: newTrades,
        filteredTrades: newTrades,
        hasUnsavedChanges: true
      };
    
    case 'UPDATE_TRADE':
      const updatedTrades = state.trades.map(trade =>
        trade.id === action.payload.id ? action.payload : trade
      );
      return {
        ...state,
        trades: updatedTrades,
        filteredTrades: updatedTrades,
        selectedTrade: state.selectedTrade?.id === action.payload.id ? action.payload : state.selectedTrade,
        hasUnsavedChanges: true
      };
    
    case 'DELETE_TRADE':
      const filteredTrades = state.trades.filter(trade => trade.id !== action.payload);
      return {
        ...state,
        trades: filteredTrades,
        filteredTrades: filteredTrades,
        selectedTrade: state.selectedTrade?.id === action.payload ? null : state.selectedTrade,
        hasUnsavedChanges: true
      };
    
    case 'SELECT_TRADE':
      return { ...state, selectedTrade: action.payload };
    
    case 'SET_FILTERS':
      return { ...state, filters: { ...state.filters, ...action.payload } };
    
    case 'APPLY_FILTERS':
      const filtered = applyFilters(state.trades, state.filters);
      return { ...state, filteredTrades: filtered };
    
    case 'CLEAR_FILTERS':
      return { 
        ...state, 
        filters: {},
        filteredTrades: state.trades 
      };
    
    case 'SET_STATS':
      return { ...state, stats: action.payload };
    
    case 'SET_UNSAVED_CHANGES':
      return { ...state, hasUnsavedChanges: action.payload };
    
    case 'START_BULK_OPERATION':
      return {
        ...state,
        bulkOperation: {
          inProgress: true,
          type: action.payload.type,
          progress: 0,
          total: action.payload.total
        }
      };
    
    case 'UPDATE_BULK_PROGRESS':
      return {
        ...state,
        bulkOperation: {
          ...state.bulkOperation,
          progress: action.payload
        }
      };
    
    case 'COMPLETE_BULK_OPERATION':
      return {
        ...state,
        bulkOperation: {
          inProgress: false,
          type: null,
          progress: 0,
          total: 0
        }
      };
    
    case 'REFRESH_DATA':
      return { ...state, lastUpdated: new Date().toISOString() };
    
    default:
      return state;
  }
};

// Filter function
const applyFilters = (trades: Trade[], filters: TradeFilters): Trade[] => {
  return trades.filter(trade => {
    // Symbol filter
    if (filters.symbol && filters.symbol.length > 0 && !filters.symbol.includes(trade.symbol)) {
      return false;
    }
    
    // Trade type filter
    if (filters.trade_type && filters.trade_type.length > 0 && !filters.trade_type.includes(trade.trade_type)) {
      return false;
    }
    
    // Date range filter
    if (filters.date_range) {
      const tradeDate = new Date(trade.entry_time);
      const startDate = new Date(filters.date_range.start);
      const endDate = new Date(filters.date_range.end);
      
      if (tradeDate < startDate || tradeDate > endDate) {
        return false;
      }
    }
    
    // ICT Pattern filter
    if (filters.ict_pattern && filters.ict_pattern.length > 0) {
      if (!trade.ict_pattern || !filters.ict_pattern.includes(trade.ict_pattern)) {
        return false;
      }
    }
    
    // Strategy filter
    if (filters.strategy_name && filters.strategy_name.length > 0) {
      if (!trade.strategy_name || !filters.strategy_name.includes(trade.strategy_name)) {
        return false;
      }
    }
    
    // Win/Loss filter
    if (filters.is_win !== undefined && trade.is_win !== filters.is_win) {
      return false;
    }
    
    // Profit filter
    if (filters.min_profit !== undefined && (trade.profit_loss_money || 0) < filters.min_profit) {
      return false;
    }
    
    if (filters.max_profit !== undefined && (trade.profit_loss_money || 0) > filters.max_profit) {
      return false;
    }
    
    // Emotion filter
    if (filters.emotion && filters.emotion.length > 0) {
      if (!trade.emotion || !filters.emotion.includes(trade.emotion)) {
        return false;
      }
    }
    
    // Market condition filter
    if (filters.market_condition && filters.market_condition.length > 0) {
      if (!trade.market_condition || !filters.market_condition.includes(trade.market_condition)) {
        return false;
      }
    }
    
    return true;
  });
};

// Context
const TradeContext = createContext<{
    state: TradeState;
    dispatch: React.Dispatch<TradeAction>;
    actions: {
      loadTrades: () => Promise<void>;
      createTrade: (trade: Omit<Trade, 'id' | 'created_at' | 'updated_at' | 'version'>) => Promise<number>;
      updateTrade: (id: number, updates: Partial<Trade>) => Promise<void>;
      deleteTrade: (id: number) => Promise<void>;
      duplicateTrade: (id: number) => Promise<number>;
      exportTrades: (filters?: TradeFilters) => Promise<string>;
      importTrades: (filePath: string) => Promise<number>;
      calculateStats: (trades?: Trade[]) => TradeStats;
      applyAdvancedFilters: (filters: TradeFilters) => void;
      bulkDeleteTrades: (ids: number[]) => Promise<void>;
      bulkUpdateTrades: (ids: number[], updates: Partial<Trade>) => Promise<void>;
      refreshTrades: () => Promise<void>;
      saveUnsavedChanges: () => Promise<void>;
      discardUnsavedChanges: () => void;
    };
  } | undefined>(undefined);
  
  // Provider component
  export const TradeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, dispatch] = useReducer(tradeReducer, initialState);
    const { showNotification } = useNotifications();
  
    // Load all trades
    const loadTrades = useCallback(async () => {
      try {
        dispatch({ type: 'SET_LOADING', payload: true });
        const trades = await invoke<Trade[]>('get_all_trades');
        dispatch({ type: 'SET_TRADES', payload: trades });
        
        // Calculate stats
        const stats = calculateStats(trades);
        dispatch({ type: 'SET_STATS', payload: stats });
        
      } catch (error) {
        const errorMessage = `Failed to load trades: ${error}`;
        dispatch({ type: 'SET_ERROR', payload: errorMessage });
        showNotification('error', errorMessage);
      }
    }, [showNotification]);
  
    // Create new trade
    const createTrade = useCallback(async (tradeData: Omit<Trade, 'id' | 'created_at' | 'updated_at' | 'version'>): Promise<number> => {
      try {
        const newTradeId = await invoke<number>('create_trade', { trade: tradeData });
        
        // Load the created trade to get full data
        const createdTrade = await invoke<Trade>('get_trade_by_id', { id: newTradeId });
        dispatch({ type: 'ADD_TRADE', payload: createdTrade });
        
        // Recalculate stats
        const stats = calculateStats([createdTrade, ...state.trades]);
        dispatch({ type: 'SET_STATS', payload: stats });
        
        showNotification('success', 'Trade created successfully');
        return newTradeId;
        
      } catch (error) {
        const errorMessage = `Failed to create trade: ${error}`;
        showNotification('error', errorMessage);
        throw error;
      }
    }, [state.trades, showNotification]);
  
    // Update existing trade
    const updateTrade = useCallback(async (id: number, updates: Partial<Trade>) => {
      try {
        const updatedTrade = await invoke<Trade>('update_trade', { id, updates });
        dispatch({ type: 'UPDATE_TRADE', payload: updatedTrade });
        
        // Recalculate stats
        const stats = calculateStats(state.trades.map(t => t.id === id ? updatedTrade : t));
        dispatch({ type: 'SET_STATS', payload: stats });
        
        showNotification('success', 'Trade updated successfully');
        
      } catch (error) {
        const errorMessage = `Failed to update trade: ${error}`;
        showNotification('error', errorMessage);
        throw error;
      }
    }, [state.trades, showNotification]);
  
    // Delete trade
    const deleteTrade = useCallback(async (id: number) => {
      try {
        await invoke('delete_trade', { id });
        dispatch({ type: 'DELETE_TRADE', payload: id });
        
        // Recalculate stats
        const stats = calculateStats(state.trades.filter(t => t.id !== id));
        dispatch({ type: 'SET_STATS', payload: stats });
        
        showNotification('success', 'Trade deleted successfully');
        
      } catch (error) {
        const errorMessage = `Failed to delete trade: ${error}`;
        showNotification('error', errorMessage);
        throw error;
      }
    }, [state.trades, showNotification]);
  
    // Duplicate trade
    const duplicateTrade = useCallback(async (id: number): Promise<number> => {
      try {
        const originalTrade = state.trades.find(t => t.id === id);
        if (!originalTrade) {
          throw new Error('Trade not found');
        }
  
        // Create copy without ID and with new timestamps
        const { id: _, created_at: __, updated_at: ___, version: ____, ...tradeData } = originalTrade;
        const duplicatedTrade = {
          ...tradeData,
          entry_time: new Date().toISOString(),
          notes: `Duplicated from trade #${id} - ${originalTrade.notes || ''}`
        };
  
        return await createTrade(duplicatedTrade);
        
      } catch (error) {
        const errorMessage = `Failed to duplicate trade: ${error}`;
        showNotification('error', errorMessage);
        throw error;
      }
    }, [state.trades, createTrade, showNotification]);
  
    // Export trades
    const exportTrades = useCallback(async (filters?: TradeFilters): Promise<string> => {
      try {
        const tradesToExport = filters ? applyFilters(state.trades, filters) : state.trades;
        const exportPath = await invoke<string>('export_trades', { 
          trades: tradesToExport,
          format: 'csv' // or 'json', 'excel'
        });
        
        showNotification('success', `Trades exported successfully to ${exportPath}`);
        return exportPath;
        
      } catch (error) {
        const errorMessage = `Failed to export trades: ${error}`;
        showNotification('error', errorMessage);
        throw error;
      }
    }, [state.trades]);
  
    // Import trades
    const importTrades = useCallback(async (filePath: string): Promise<number> => {
      try {
        dispatch({ type: 'START_BULK_OPERATION', payload: { type: 'update', total: 100 } });
        
        const importResult = await invoke<{ imported: number; errors: string[] }>('import_trades', { filePath });
        
        if (importResult.errors.length > 0) {
          showNotification('warning', `Imported ${importResult.imported} trades with ${importResult.errors.length} errors`);
        } else {
          showNotification('success', `Successfully imported ${importResult.imported} trades`);
        }
        
        // Reload all trades
        await loadTrades();
        dispatch({ type: 'COMPLETE_BULK_OPERATION' });
        
        return importResult.imported;
        
      } catch (error) {
        dispatch({ type: 'COMPLETE_BULK_OPERATION' });
        const errorMessage = `Failed to import trades: ${error}`;
        showNotification('error', errorMessage);
        throw error;
      }
    }, [loadTrades, showNotification]);
  
    // Calculate statistics
    const calculateStats = useCallback((trades: Trade[] = state.trades): TradeStats => {
      const closedTrades = trades.filter(t => t.is_win !== undefined);
      const winningTrades = closedTrades.filter(t => t.is_win === true);
      const losingTrades = closedTrades.filter(t => t.is_win === false);
      const openTrades = trades.filter(t => t.is_win === undefined);
      
      const totalProfit = winningTrades.reduce((sum, t) => sum + (t.profit_loss_money || 0), 0);
      const totalLoss = Math.abs(losingTrades.reduce((sum, t) => sum + (t.profit_loss_money || 0), 0));
      const netProfit = totalProfit - totalLoss;
      
      const averageProfit = winningTrades.length > 0 ? totalProfit / winningTrades.length : 0;
      const averageLoss = losingTrades.length > 0 ? totalLoss / losingTrades.length : 0;
      
      const largestWin = winningTrades.length > 0 ? 
        Math.max(...winningTrades.map(t => t.profit_loss_money || 0)) : 0;
      const largestLoss = losingTrades.length > 0 ? 
        Math.min(...losingTrades.map(t => t.profit_loss_money || 0)) : 0;
      
      const averageRiskReward = closedTrades.length > 0 ? 
        closedTrades.reduce((sum, t) => sum + (t.risk_reward_ratio || 0), 0) / closedTrades.length : 0;
      
      const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? Infinity : 0;
      
      const winRate = closedTrades.length > 0 ? (winningTrades.length / closedTrades.length) * 100 : 0;
      const expectancy = (winRate / 100) * averageProfit - ((100 - winRate) / 100) * averageLoss;
  
      return {
        total_trades: trades.length,
        winning_trades: winningTrades.length,
        losing_trades: losingTrades.length,
        open_trades: openTrades.length,
        win_rate: winRate,
        total_profit: totalProfit,
        total_loss: totalLoss,
        net_profit: netProfit,
        average_profit: averageProfit,
        average_loss: averageLoss,
        largest_win: largestWin,
        largest_loss: Math.abs(largestLoss),
        average_risk_reward: averageRiskReward,
        profit_factor: profitFactor,
        expectancy
      };
    }, [state.trades]);
  
    // Apply advanced filters
    const applyAdvancedFilters = useCallback((filters: TradeFilters) => {
      dispatch({ type: 'SET_FILTERS', payload: filters });
      dispatch({ type: 'APPLY_FILTERS' });
      
      // Calculate stats for filtered trades
      const filtered = applyFilters(state.trades, filters);
      const filteredStats = calculateStats(filtered);
      dispatch({ type: 'SET_STATS', payload: filteredStats });
    }, [state.trades, calculateStats]);
  
    // Bulk operations
    const bulkDeleteTrades = useCallback(async (ids: number[]) => {
      try {
        dispatch({ type: 'START_BULK_OPERATION', payload: { type: 'delete', total: ids.length } });
        
        for (let i = 0; i < ids.length; i++) {
          await invoke('delete_trade', { id: ids[i] });
          dispatch({ type: 'UPDATE_BULK_PROGRESS', payload: i + 1 });
        }
        
        // Reload trades
        await loadTrades();
        dispatch({ type: 'COMPLETE_BULK_OPERATION' });
        showNotification('success', `Successfully deleted ${ids.length} trades`);
        
      } catch (error) {
        dispatch({ type: 'COMPLETE_BULK_OPERATION' });
        const errorMessage = `Failed to delete trades: ${error}`;
        showNotification('error', errorMessage);
        throw error;
      }
    }, [loadTrades, showNotification]);
  
    const bulkUpdateTrades = useCallback(async (ids: number[], updates: Partial<Trade>) => {
      try {
        dispatch({ type: 'START_BULK_OPERATION', payload: { type: 'update', total: ids.length } });
        
        for (let i = 0; i < ids.length; i++) {
          await invoke('update_trade', { id: ids[i], updates });
          dispatch({ type: 'UPDATE_BULK_PROGRESS', payload: i + 1 });
        }
        
        // Reload trades
        await loadTrades();
        dispatch({ type: 'COMPLETE_BULK_OPERATION' });
        showNotification('success', `Successfully updated ${ids.length} trades`);
        
      } catch (error) {
        dispatch({ type: 'COMPLETE_BULK_OPERATION' });
        const errorMessage = `Failed to update trades: ${error}`;
        showNotification('error', errorMessage);
        throw error;
      }
    }, [loadTrades, showNotification]);
  
    // Refresh data
    const refreshTrades = useCallback(async () => {
      await loadTrades();
      dispatch({ type: 'REFRESH_DATA' });
    }, [loadTrades]);
  
    // Save unsaved changes
    const saveUnsavedChanges = useCallback(async () => {
      // In a real implementation, this would sync with backend
      dispatch({ type: 'SET_UNSAVED_CHANGES', payload: false });
      showNotification('success', 'All changes saved successfully');
    }, [showNotification]);
  
    // Discard unsaved changes
    const discardUnsavedChanges = useCallback(() => {
      // Reload original data
      loadTrades();
      dispatch({ type: 'SET_UNSAVED_CHANGES', payload: false });
      showNotification('info', 'Changes discarded');
    }, [loadTrades, showNotification]);
  
    // Load trades on mount
    useEffect(() => {
      loadTrades();
    }, [loadTrades]);
  
    // Context value
    const contextValue = {
      state,
      dispatch,
      actions: {
        loadTrades,
        createTrade,
        updateTrade,
        deleteTrade,
        duplicateTrade,
        exportTrades,
        importTrades,
        calculateStats,
        applyAdvancedFilters,
        bulkDeleteTrades,
        bulkUpdateTrades,
        refreshTrades,
        saveUnsavedChanges,
        discardUnsavedChanges
      }
    };
  
    return (
      <TradeContext.Provider value={contextValue}>
        {children}
      </TradeContext.Provider>
    );
  };
  
  // Custom hook
  export const useTrade = () => {
    const context = useContext(TradeContext);
    if (context === undefined) {
      throw new Error('useTrade must be used within a TradeProvider');
    }
    return context;
  };
  
  // Export types and utilities
  export type { TradeFilters, TradeStats };
  export { applyFilters, calculateStats };