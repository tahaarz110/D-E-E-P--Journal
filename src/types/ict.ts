export interface IctWinRate {
    pattern: string;
    win_rate: number;
    total_trades: number;
    winning_trades: number;
  }
  
  export interface IctHeatmapData {
    pattern: string;
    day_of_week: string;
    win_rate: number;
    total_trades: number;
  }
  
  export interface IctPatternStats {
    pattern: string;
    totalTrades: number;
    winRate: number;
    avgRiskReward: number;
    bestDay: string;
    worstDay: string;
  }