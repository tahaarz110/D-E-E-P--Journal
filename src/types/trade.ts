export interface NewTrade {
    symbol: string;
    trade_type: string;
    volume: number;
    entry_price: number;
    sl: number;
    tp: number;
    entry_time: string;
    notes?: string;
    ict_pattern?: string;
    pattern_type?: string;
    pattern_size?: number;
    pattern_timeframe?: string;
    pattern_combination?: string;
    chart_explanation?: string;
    strategy_name?: string;
    emotion?: string;
    commission?: number;
  }
  
  export interface Trade extends NewTrade {
    id: number;
    is_win?: boolean;
    exit_price?: number;
    exit_time?: string;
    commission?: number;
  }