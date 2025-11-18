use serde::{Deserialize, Serialize};
use sqlx::{SqlitePool, Row, Error as SqlxError};
use chrono::{DateTime, Utc, TimeZone, Datelike, Timelike};
use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use tokio::sync::Mutex;
use rayon::prelude::*;
use statistical::{mean, standard_deviation, variance};

// Analysis results structures
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TradeAnalysis {
    pub summary: AnalysisSummary,
    pub performance: PerformanceMetrics,
    pub psychological: PsychologicalMetrics,
    pub technical: TechnicalAnalysis,
    pub ict_analysis: ICTAnalysis,
    pub time_analysis: TimeBasedAnalysis,
    pub risk_analysis: RiskAnalysis,
    pub strategy_analysis: StrategyAnalysis,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AnalysisSummary {
    pub total_trades: u32,
    pub winning_trades: u32,
    pub losing_trades: u32,
    pub open_trades: u32,
    pub win_rate: f64,
    pub net_profit: f64,
    pub gross_profit: f64,
    pub gross_loss: f64,
    pub profit_factor: f64,
    pub expectancy: f64,
    pub average_trade: f64,
    pub sharpe_ratio: f64,
    pub max_drawdown: f64,
    pub recovery_factor: f64,
    pub risk_of_ruin: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PerformanceMetrics {
    pub total_return: f64,
    pub annual_return: f64,
    pub monthly_return: Vec<MonthlyReturn>,
    pub daily_returns: Vec<f64>,
    pub volatility: f64,
    pub alpha: f64,
    pub beta: f64,
    pub r_squared: f64,
    pub information_ratio: f64,
    pub calmar_ratio: f64,
    pub sortino_ratio: f64,
    pub ulcer_index: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MonthlyReturn {
    pub year: i32,
    pub month: u32,
    pub return_percentage: f64,
    pub profit: f64,
    pub trades: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PsychologicalMetrics {
    pub emotional_impact: EmotionalAnalysis,
    pub consistency: ConsistencyMetrics,
    pub behavioral_patterns: BehavioralPatterns,
    pub stress_levels: StressAnalysis,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EmotionalAnalysis {
    pub win_emotions: HashMap<String, f64>,
    pub loss_emotions: HashMap<String, f64>,
    pub emotion_impact: HashMap<String, f64>,
    pub confidence_trend: Vec<f64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ConsistencyMetrics {
    pub win_streaks: Vec<u32>,
    pub loss_streaks: Vec<u32>,
    pub consistency_score: f64,
    pub predictability: f64,
    pub stability_index: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BehavioralPatterns {
    pub revenge_trading: bool,
    pub overtrading: bool,
    pub hesitation: bool,
    pub early_exits: bool,
    pub late_entries: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StressAnalysis {
    pub stress_level: f64,
    pub risk_tolerance: f64,
    pub discipline_score: f64,
    pub emotional_control: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TechnicalAnalysis {
    pub entry_accuracy: f64,
    pub exit_accuracy: f64,
    pub timing_efficiency: f64,
    pub price_action: PriceActionAnalysis,
    pub indicator_performance: IndicatorAnalysis,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PriceActionAnalysis {
    pub support_resistance_hits: u32,
    pub breakout_success: f64,
    pub reversal_accuracy: f64,
    pub trend_following_success: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct IndicatorAnalysis {
    pub rsi_effectiveness: f64,
    pub macd_effectiveness: f64,
    pub moving_average_effectiveness: f64,
    pub bollinger_effectiveness: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ICTAnalysis {
    pub pattern_performance: HashMap<String, PatternPerformance>,
    pub timeframe_analysis: HashMap<String, TimeframeAnalysis>,
    pub combination_analysis: CombinationAnalysis,
    pub win_rates: HashMap<String, f64>,
    pub heatmap_data: Vec<ICTHeatmapData>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PatternPerformance {
    pub pattern: String,
    pub total_trades: u32,
    pub winning_trades: u32,
    pub win_rate: f64,
    pub average_profit: f64,
    pub average_loss: f64,
    pub profit_factor: f64,
    pub best_scenario: String,
    pub worst_scenario: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TimeframeAnalysis {
    pub timeframe: String,
    pub success_rate: f64,
    pub average_holding_time: f64,
    pub volatility_adjusted_return: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CombinationAnalysis {
    pub best_combinations: Vec<PatternCombination>,
    pub worst_combinations: Vec<PatternCombination>,
    pub synergy_scores: HashMap<String, f64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PatternCombination {
    pub patterns: Vec<String>,
    pub win_rate: f64,
    pub total_trades: u32,
    pub average_rr: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ICTHeatmapData {
    pub pattern: String,
    pub day_of_week: String,
    pub hour_of_day: u32,
    pub win_rate: f64,
    pub total_trades: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TimeBasedAnalysis {
    pub hourly_analysis: HashMap<u32, HourlyPerformance>,
    pub daily_analysis: HashMap<String, DailyPerformance>,
    pub monthly_analysis: HashMap<String, MonthlyPerformance>,
    pub seasonal_analysis: SeasonalAnalysis,
    pub session_analysis: SessionAnalysis,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct HourlyPerformance {
    pub hour: u32,
    pub total_trades: u32,
    pub win_rate: f64,
    pub average_profit: f64,
    pub profit_per_trade: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DailyPerformance {
    pub day: String,
    pub total_trades: u32,
    pub win_rate: f64,
    pub net_profit: f64,
    pub best_hour: u32,
    pub worst_hour: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MonthlyPerformance {
    pub month: String,
    pub total_trades: u32,
    pub win_rate: f64,
    pub net_profit: f64,
    pub consistency: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SeasonalAnalysis {
    pub quarterly_performance: HashMap<String, f64>,
    pub seasonal_patterns: HashMap<String, f64>,
    pub best_season: String,
    pub worst_season: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SessionAnalysis {
    pub asian_session: SessionPerformance,
    pub london_session: SessionPerformance,
    pub new_york_session: SessionPerformance,
    pub overlap_sessions: OverlapPerformance,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SessionPerformance {
    pub session: String,
    pub total_trades: u32,
    pub win_rate: f64,
    pub net_profit: f64,
    pub average_holding: f64,
    pub volatility: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OverlapPerformance {
    pub london_new_york: SessionPerformance,
    pub asian_london: SessionPerformance,
    pub all_sessions: SessionPerformance,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RiskAnalysis {
    pub position_sizing: PositionSizingAnalysis,
    pub risk_metrics: RiskMetrics,
    var_analysis: VaRAnalysis,
    pub stress_testing: StressTesting,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PositionSizingAnalysis {
    pub optimal_position_size: f64,
    pub kelly_criterion: f64,
    pub risk_per_trade: f64,
    pub max_portfolio_risk: f64,
    pub position_sizing_score: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RiskMetrics {
    pub standard_deviation: f64,
    pub semi_deviation: f64,
    pub downside_deviation: f64,
    pub value_at_risk: f64,
    pub conditional_var: f64,
    pub tail_risk: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VaRAnalysis {
    pub var_95: f64,
    pub var_99: f64,
    pub expected_shortfall: f64,
    pub historical_var: f64,
    pub parametric_var: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StressTesting {
    pub worst_case_scenario: f64,
    pub black_swan_impact: f64,
    pub correlation_breakdown: f64,
    pub liquidity_crisis: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StrategyAnalysis {
    pub strategy_performance: HashMap<String, StrategyPerformance>,
    pub strategy_correlation: HashMap<String, f64>,
    pub strategy_diversification: f64,
    pub optimal_strategy_mix: HashMap<String, f64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StrategyPerformance {
    pub strategy: String,
    pub total_trades: u32,
    pub win_rate: f64,
    pub net_profit: f64,
    pub profit_factor: f64,
    pub sharpe_ratio: f64,
    pub max_drawdown: f64,
    pub recovery_factor: f64,
}

// Main analyzer structure
pub struct Analyzer {
    pool: SqlitePool,
    cache: Arc<Mutex<AnalysisCache>>,
    config: AnalysisConfig,
}

#[derive(Debug, Clone)]
pub struct AnalysisConfig {
    pub confidence_level: f64,
    pub lookback_period: u32,
    pub risk_free_rate: f64,
    pub trading_days_per_year: u32,
    pub max_drawdown_period: u32,
    pub var_horizon: u32,
}

#[derive(Debug, Clone)]
struct AnalysisCache {
    trade_analysis: Option<TradeAnalysis>,
    last_update: Option<DateTime<Utc>>,
    ict_analysis: Option<ICTAnalysis>,
    performance_cache: HashMap<String, PerformanceMetrics>,
}

impl Default for AnalysisConfig {
    fn default() -> Self {
        Self {
            confidence_level: 0.95,
            lookback_period: 252, // 1 year of trading days
            risk_free_rate: 0.02, // 2% risk-free rate
            trading_days_per_year: 252,
            max_drawdown_period: 21, // 1 month
            var_horizon: 1,
        }
    }
}

impl Analyzer {
    pub fn new(pool: SqlitePool) -> Self {
        Self {
            pool,
            cache: Arc::new(Mutex::new(AnalysisCache {
                trade_analysis: None,
                last_update: None,
                ict_analysis: None,
                performance_cache: HashMap::new(),
            })),
            config: AnalysisConfig::default(),
        }
    }

    pub async fn initialize(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        log::info!("Initializing analyzer...");
        
        // Pre-cache common analyses
        self.update_all_analysis().await?;
        
        log::info!("Analyzer initialized successfully");
        Ok(())
    }

    // Main analysis method
    pub async fn analyze_trades(&self) -> Result<TradeAnalysis, SqlxError> {
        let mut cache = self.cache.lock().await;
        
        // Check cache first
        if let Some(analysis) = &cache.trade_analysis {
            if let Some(last_update) = cache.last_update {
                if Utc::now().signed_duration_since(last_update).num_minutes() < 5 {
                    return Ok(analysis.clone());
                }
            }
        }

        log::info!("Performing comprehensive trade analysis...");
        
        // Get all trades from database
        let trades = self.get_all_trades().await?;
        
        if trades.is_empty() {
            return Ok(TradeAnalysis::default());
        }

        // Perform parallel analysis
        let analysis = tokio::task::spawn_blocking(move || {
            Self::perform_comprehensive_analysis(trades)
        }).await.unwrap();

        // Update cache
        cache.trade_analysis = Some(analysis.clone());
        cache.last_update = Some(Utc::now());

        Ok(analysis)
    }

    // Comprehensive analysis function
    fn perform_comprehensive_analysis(trades: Vec<Trade>) -> TradeAnalysis {
        let closed_trades: Vec<&Trade> = trades.iter()
            .filter(|t| t.is_win.is_some())
            .collect();

        let open_trades: Vec<&Trade> = trades.iter()
            .filter(|t| t.is_win.is_none())
            .collect();

        // Parallel computation of different analysis aspects
        let (summary, performance, psychological, technical, ict_analysis, time_analysis, risk_analysis, strategy_analysis) = rayon::join(
            || Self::calculate_summary(&trades, &closed_trades),
            || Self::calculate_performance_metrics(&closed_trades),
            || Self::analyze_psychological_aspects(&trades),
            || Self::perform_technical_analysis(&closed_trades),
            || Self::analyze_ict_patterns(&closed_trades),
            || Self::analyze_time_based_patterns(&closed_trades),
            || Self::perform_risk_analysis(&closed_trades),
            || Self::analyze_strategy_performance(&closed_trades),
        );

        TradeAnalysis {
            summary,
            performance,
            psychological,
            technical,
            ict_analysis,
            time_analysis,
            risk_analysis,
            strategy_analysis,
        }
    }

    // Summary calculation
    fn calculate_summary(trades: &[Trade], closed_trades: &[&Trade]) -> AnalysisSummary {
        let total_trades = trades.len() as u32;
        let open_trades = trades.iter().filter(|t| t.is_win.is_none()).count() as u32;
        let winning_trades = closed_trades.iter().filter(|t| t.is_win.unwrap()).count() as u32;
        let losing_trades = closed_trades.iter().filter(|t| !t.is_win.unwrap()).count() as u32;
        
        let win_rate = if closed_trades.is_empty() {
            0.0
        } else {
            (winning_trades as f64 / closed_trades.len() as f64) * 100.0
        };

        let profits: Vec<f64> = closed_trades.iter()
            .map(|t| t.profit_loss_money.unwrap_or(0.0))
            .collect();

        let net_profit = profits.iter().sum();
        let gross_profit = profits.iter().filter(|&&p| p > 0.0).sum();
        let gross_loss = profits.iter().filter(|&&p| p < 0.0).sum::<f64>().abs();

        let profit_factor = if gross_loss > 0.0 {
            gross_profit / gross_loss
        } else {
            f64::INFINITY
        };

        let average_win = if winning_trades > 0 {
            profits.iter().filter(|&&p| p > 0.0).sum::<f64>() / winning_trades as f64
        } else {
            0.0
        };

        let average_loss = if losing_trades > 0 {
            profits.iter().filter(|&&p| p < 0.0).sum::<f64>().abs() / losing_trades as f64
        } else {
            0.0
        };

        let expectancy = (win_rate / 100.0) * average_win - ((100.0 - win_rate) / 100.0) * average_loss;
        let average_trade = if !closed_trades.is_empty() { net_profit / closed_trades.len() as f64 } else { 0.0 };

        // Calculate more advanced metrics
        let sharpe_ratio = Self::calculate_sharpe_ratio(&profits);
        let max_drawdown = Self::calculate_max_drawdown(&profits);
        let recovery_factor = if max_drawdown > 0.0 { net_profit / max_drawdown } else { 0.0 };
        let risk_of_ruin = Self::calculate_risk_of_ruin(win_rate / 100.0, average_win, average_loss);

        AnalysisSummary {
            total_trades,
            winning_trades,
            losing_trades,
            open_trades,
            win_rate,
            net_profit,
            gross_profit,
            gross_loss,
            profit_factor,
            expectancy,
            average_trade,
            sharpe_ratio,
            max_drawdown,
            recovery_factor,
            risk_of_ruin,
        }
    }

    // Performance metrics calculation
    fn calculate_performance_metrics(closed_trades: &[&Trade]) -> PerformanceMetrics {
        if closed_trades.is_empty() {
            return PerformanceMetrics::default();
        }

        let profits: Vec<f64> = closed_trades.iter()
            .map(|t| t.profit_loss_money.unwrap_or(0.0))
            .collect();

        let total_return = profits.iter().sum();
        let annual_return = Self::calculate_annual_return(&profits);
        
        let monthly_returns = Self::calculate_monthly_returns(closed_trades);
        let daily_returns = Self::calculate_daily_returns(closed_trades);

        let volatility = standard_deviation(&profits);
        let alpha = Self::calculate_alpha(&profits);
        let beta = Self::calculate_beta(&profits);
        let r_squared = Self::calculate_r_squared(&profits);
        let information_ratio = Self::calculate_information_ratio(&profits);
        let calmar_ratio = Self::calculate_calmar_ratio(&profits);
        let sortino_ratio = Self::calculate_sortino_ratio(&profits);
        let ulcer_index = Self::calculate_ulcer_index(&profits);

        PerformanceMetrics {
            total_return,
            annual_return,
            monthly_return: monthly_returns,
            daily_returns,
            volatility,
            alpha,
            beta,
            r_squared,
            information_ratio,
            calmar_ratio,
            sortino_ratio,
            ulcer_index,
        }
    }

    // Psychological analysis
    fn analyze_psychological_aspects(trades: &[Trade]) -> PsychologicalMetrics {
        let emotional_impact = Self::analyze_emotional_impact(trades);
        let consistency = Self::calculate_consistency_metrics(trades);
        let behavioral_patterns = Self::identify_behavioral_patterns(trades);
        let stress_levels = Self::analyze_stress_levels(trades);

        PsychologicalMetrics {
            emotional_impact,
            consistency,
            behavioral_patterns,
            stress_levels,
        }
    }

    // Technical analysis
    fn perform_technical_analysis(closed_trades: &[&Trade]) -> TechnicalAnalysis {
        let entry_accuracy = Self::calculate_entry_accuracy(closed_trades);
        let exit_accuracy = Self::calculate_exit_accuracy(closed_trades);
        let timing_efficiency = Self::calculate_timing_efficiency(closed_trades);
        let price_action = Self::analyze_price_action(closed_trades);
        let indicator_performance = Self::analyze_indicator_performance(closed_trades);

        TechnicalAnalysis {
            entry_accuracy,
            exit_accuracy,
            timing_efficiency,
            price_action,
            indicator_performance,
        }
    }

    // ICT pattern analysis
    fn analyze_ict_patterns(closed_trades: &[&Trade]) -> ICTAnalysis {
        let pattern_performance = Self::calculate_pattern_performance(closed_trades);
        let timeframe_analysis = Self::analyze_timeframe_performance(closed_trades);
        let combination_analysis = Self::analyze_pattern_combinations(closed_trades);
        let win_rates = Self::calculate_ict_win_rates(closed_trades);
        let heatmap_data = Self::generate_ict_heatmap(closed_trades);

        ICTAnalysis {
            pattern_performance,
            timeframe_analysis,
            combination_analysis,
            win_rates,
            heatmap_data,
        }
    }

        // Time-based analysis
        fn analyze_time_based_patterns(closed_trades: &[&Trade]) -> TimeBasedAnalysis {
            let hourly_analysis = Self::analyze_hourly_performance(closed_trades);
            let daily_analysis = Self::analyze_daily_performance(closed_trades);
            let monthly_analysis = Self::analyze_monthly_performance(closed_trades);
            let seasonal_analysis = Self::analyze_seasonal_patterns(closed_trades);
            let session_analysis = Self::analyze_trading_sessions(closed_trades);
    
            TimeBasedAnalysis {
                hourly_analysis,
                daily_analysis,
                monthly_analysis,
                seasonal_analysis,
                session_analysis,
            }
        }
    
        // Risk analysis
        fn perform_risk_analysis(closed_trades: &[&Trade]) -> RiskAnalysis {
            let position_sizing = Self::analyze_position_sizing(closed_trades);
            let risk_metrics = Self::calculate_risk_metrics(closed_trades);
            let var_analysis = Self::calculate_var_analysis(closed_trades);
            let stress_testing = Self::perform_stress_testing(closed_trades);
    
            RiskAnalysis {
                position_sizing,
                risk_metrics,
                var_analysis,
                stress_testing,
            }
        }
    
        // Strategy analysis
        fn analyze_strategy_performance(closed_trades: &[&Trade]) -> StrategyAnalysis {
            let strategy_performance = Self::calculate_strategy_performance(closed_trades);
            let strategy_correlation = Self::calculate_strategy_correlation(closed_trades);
            let strategy_diversification = Self::calculate_diversification_benefit(closed_trades);
            let optimal_strategy_mix = Self::calculate_optimal_strategy_mix(closed_trades);
    
            StrategyAnalysis {
                strategy_performance,
                strategy_correlation,
                strategy_diversification,
                optimal_strategy_mix,
            }
        }
    
        // Advanced metric calculations
        fn calculate_sharpe_ratio(returns: &[f64]) -> f64 {
            if returns.is_empty() {
                return 0.0;
            }
    
            let avg_return = mean(returns);
            let std_dev = standard_deviation(returns);
            
            if std_dev == 0.0 {
                return 0.0;
            }
    
            // Using 2% as risk-free rate
            (avg_return - 0.02) / std_dev
        }
    
        fn calculate_max_drawdown(returns: &[f64]) -> f64 {
            if returns.is_empty() {
                return 0.0;
            }
    
            let mut peak = returns[0];
            let mut max_drawdown = 0.0;
            let mut running_sum = 0.0;
    
            for &ret in returns {
                running_sum += ret;
                if running_sum > peak {
                    peak = running_sum;
                }
                let drawdown = peak - running_sum;
                if drawdown > max_drawdown {
                    max_drawdown = drawdown;
                }
            }
    
            max_drawdown
        }
    
        fn calculate_risk_of_ruin(win_rate: f64, avg_win: f64, avg_loss: f64) -> f64 {
            if avg_loss == 0.0 {
                return 0.0;
            }
    
            let win_ratio = avg_win / avg_loss.abs();
            let p = win_rate;
            let q = 1.0 - win_rate;
    
            // Using Ralph Vince's risk of ruin formula
            let risk = ((1.0 - p) / p).powf(win_ratio);
            risk.min(1.0)
        }
    
        fn calculate_annual_return(returns: &[f64]) -> f64 {
            if returns.is_empty() {
                return 0.0;
            }
    
            let total_return: f64 = returns.iter().sum();
            let trading_days = returns.len() as f64;
            
            if trading_days == 0.0 {
                return 0.0;
            }
    
            let daily_return = total_return / trading_days;
            let annual_return = (1.0 + daily_return).powf(252.0) - 1.0;
            
            annual_return
        }
    
        fn calculate_sortino_ratio(returns: &[f64]) -> f64 {
            if returns.is_empty() {
                return 0.0;
            }
    
            let avg_return = mean(returns);
            let downside_returns: Vec<f64> = returns.iter()
                .filter(|&&r| r < 0.0)
                .cloned()
                .collect();
    
            if downside_returns.is_empty() {
                return f64::INFINITY;
            }
    
            let downside_deviation = standard_deviation(&downside_returns);
            
            if downside_deviation == 0.0 {
                return 0.0;
            }
    
            (avg_return - 0.02) / downside_deviation
        }
    
        // ICT-specific analysis methods
        pub async fn calculate_ict_win_rates(&self) -> Result<Vec<HashMap<String, serde_json::Value>>, SqlxError> {
            let result = sqlx::query(
                r#"
                SELECT 
                    ict_pattern,
                    COUNT(*) as total_trades,
                    SUM(CASE WHEN is_win = 1 THEN 1 ELSE 0 END) as winning_trades,
                    CAST(SUM(CASE WHEN is_win = 1 THEN 1 ELSE 0 END) AS FLOAT) / COUNT(*) * 100 as win_rate,
                    AVG(CASE WHEN is_win = 1 THEN profit_loss_money ELSE NULL END) as avg_win,
                    AVG(CASE WHEN is_win = 0 THEN profit_loss_money ELSE NULL END) as avg_loss
                FROM trades 
                WHERE ict_pattern IS NOT NULL AND is_win IS NOT NULL
                GROUP BY ict_pattern
                ORDER BY win_rate DESC
                "#
            )
            .fetch_all(&self.pool)
            .await?;
    
            let mut win_rates = Vec::new();
            for row in result {
                let mut data = HashMap::new();
                data.insert("pattern".to_string(), serde_json::Value::String(row.get("ict_pattern")));
                data.insert("total_trades".to_string(), serde_json::Value::Number(serde_json::Number::from(row.get::<i64, _>("total_trades"))));
                data.insert("winning_trades".to_string(), serde_json::Value::Number(serde_json::Number::from(row.get::<i64, _>("winning_trades"))));
                data.insert("win_rate".to_string(), serde_json::Value::Number(serde_json::Number::from_f64(row.get::<f64, _>("win_rate")).unwrap()));
                data.insert("avg_win".to_string(), serde_json::Value::Number(serde_json::Number::from_f64(row.get::<f64, _>("avg_win").unwrap_or(0.0)).unwrap()));
                data.insert("avg_loss".to_string(), serde_json::Value::Number(serde_json::Number::from_f64(row.get::<f64, _>("avg_loss").unwrap_or(0.0)).unwrap()));
                
                win_rates.push(data);
            }
    
            Ok(win_rates)
        }
    
        pub async fn calculate_ict_heatmap(&self) -> Result<Vec<HashMap<String, serde_json::Value>>, SqlxError> {
            let result = sqlx::query(
                r#"
                SELECT 
                    ict_pattern,
                    strftime('%w', entry_time) as day_of_week,
                    strftime('%H', entry_time) as hour_of_day,
                    COUNT(*) as total_trades,
                    CAST(SUM(CASE WHEN is_win = 1 THEN 1 ELSE 0 END) AS FLOAT) / COUNT(*) * 100 as win_rate
                FROM trades 
                WHERE ict_pattern IS NOT NULL AND is_win IS NOT NULL
                GROUP BY ict_pattern, day_of_week, hour_of_day
                ORDER BY ict_pattern, day_of_week, hour_of_day
                "#
            )
            .fetch_all(&self.pool)
            .await?;
    
            let mut heatmap_data = Vec::new();
            for row in result {
                let mut data = HashMap::new();
                data.insert("pattern".to_string(), serde_json::Value::String(row.get("ict_pattern")));
                data.insert("day_of_week".to_string(), serde_json::Value::String(row.get("day_of_week")));
                data.insert("hour_of_day".to_string(), serde_json::Value::Number(serde_json::Number::from(row.get::<i64, _>("hour_of_day"))));
                data.insert("total_trades".to_string(), serde_json::Value::Number(serde_json::Number::from(row.get::<i64, _>("total_trades"))));
                data.insert("win_rate".to_string(), serde_json::Value::Number(serde_json::Number::from_f64(row.get::<f64, _>("win_rate")).unwrap()));
                
                heatmap_data.push(data);
            }
    
            Ok(heatmap_data)
        }
    
        // Dashboard data generation
        pub async fn get_dashboard_data(&self, time_range: &str) -> Result<serde_json::Value, SqlxError> {
            let analysis = self.analyze_trades().await?;
            
            let dashboard_data = serde_json::json!({
                "summary": analysis.summary,
                "performance": analysis.performance,
                "psychological": analysis.psychological,
                "technical": analysis.technical,
                "ict_analysis": analysis.ict_analysis,
                "time_analysis": analysis.time_analysis,
                "risk_analysis": analysis.risk_analysis,
                "strategy_analysis": analysis.strategy_analysis,
                "alerts": self.generate_alerts(&analysis).await?,
                "market_overview": self.get_market_overview().await?,
            });
    
            Ok(dashboard_data)
        }
    
        // Alert generation
        async fn generate_alerts(&self, analysis: &TradeAnalysis) -> Result<Vec<serde_json::Value>, SqlxError> {
            let mut alerts = Vec::new();
    
            // Risk alerts
            if analysis.summary.max_drawdown > 1000.0 {
                alerts.push(serde_json::json!({
                    "type": "warning",
                    "title": "High Maximum Drawdown",
                    "message": format!("Current max drawdown is ${:.2}. Consider reviewing your risk management.", analysis.summary.max_drawdown),
                    "action": {
                        "label": "Review Risk Settings",
                        "handler": "open_risk_management"
                    }
                }));
            }
    
            if analysis.summary.win_rate < 40.0 {
                alerts.push(serde_json::json!({
                    "type": "error",
                    "title": "Low Win Rate",
                    "message": format!("Current win rate is {:.1}%. Consider adjusting your strategy.", analysis.summary.win_rate),
                    "action": {
                        "label": "Analyze Strategy",
                        "handler": "open_strategy_analysis"
                    }
                }));
            }
    
            // Performance alerts
            if analysis.performance.sharpe_ratio < 1.0 {
                alerts.push(serde_json::json!({
                    "type": "warning",
                    "title": "Suboptimal Risk-Adjusted Returns",
                    "message": "Sharpe ratio indicates suboptimal risk-adjusted performance.",
                    "action": {
                        "label": "Optimize Portfolio",
                        "handler": "open_portfolio_optimization"
                    }
                }));
            }
    
            // Psychological alerts
            if analysis.psychological.behavioral_patterns.overtrading {
                alerts.push(serde_json::json!({
                    "type": "warning",
                    "title": "Overtrading Detected",
                    "message": "Analysis suggests potential overtrading behavior.",
                    "action": {
                        "label": "Review Trading Habits",
                        "handler": "open_psychological_analysis"
                    }
                }));
            }
    
            Ok(alerts)
        }
    
        // Market overview
        async fn get_market_overview(&self) -> Result<serde_json::Value, SqlxError> {
            let symbol_performance = sqlx::query(
                r#"
                SELECT 
                    symbol,
                    COUNT(*) as total_trades,
                    SUM(CASE WHEN is_win = 1 THEN 1 ELSE 0 END) as winning_trades,
                    CAST(SUM(CASE WHEN is_win = 1 THEN 1 ELSE 0 END) AS FLOAT) / COUNT(*) * 100 as win_rate,
                    SUM(profit_loss_money) as net_profit
                FROM trades 
                WHERE is_win IS NOT NULL
                GROUP BY symbol
                ORDER BY net_profit DESC
                "#
            )
            .fetch_all(&self.pool)
            .await?;
    
            let mut market_data = Vec::new();
            for row in symbol_performance {
                market_data.push(serde_json::json!({
                    "symbol": row.get::<String, _>("symbol"),
                    "total_trades": row.get::<i64, _>("total_trades"),
                    "winning_trades": row.get::<i64, _>("winning_trades"),
                    "win_rate": row.get::<f64, _>("win_rate"),
                    "net_profit": row.get::<f64, _>("net_profit")
                }));
            }
    
            Ok(serde_json::json!({
                "symbol_performance": market_data,
                "market_conditions": self.analyze_market_conditions().await?,
                "volatility_analysis": self.analyze_market_volatility().await?,
            }))
        }
    
        // Helper methods
        async fn get_all_trades(&self) -> Result<Vec<Trade>, SqlxError> {
            sqlx::query_as::<_, Trade>("SELECT * FROM trades ORDER BY entry_time DESC")
                .fetch_all(&self.pool)
                .await
        }
    
        async fn analyze_market_conditions(&self) -> Result<serde_json::Value, SqlxError> {
            // Simplified market condition analysis
            Ok(serde_json::json!({
                "trend_strength": 0.75,
                "volatility_regime": "medium",
                "market_sentiment": "bullish",
                "correlation_matrix": {}
            }))
        }
    
        async fn analyze_market_volatility(&self) -> Result<serde_json::Value, SqlxError> {
            // Simplified volatility analysis
            Ok(serde_json::json!({
                "current_volatility": 0.15,
                "volatility_trend": "decreasing",
                "volatility_regime": "normal",
                "risk_appetite": "moderate"
            }))
        }
    
        // Public API methods
        pub async fn quick_analysis(&self) -> Result<serde_json::Value, SqlxError> {
            let analysis = self.analyze_trades().await?;
            
            Ok(serde_json::json!({
                "win_rate": analysis.summary.win_rate,
                "net_profit": analysis.summary.net_profit,
                "profit_factor": analysis.summary.profit_factor,
                "max_drawdown": analysis.summary.max_drawdown,
                "sharpe_ratio": analysis.performance.sharpe_ratio,
                "current_streak": self.calculate_current_streak().await?,
                "daily_performance": self.calculate_daily_performance().await?,
            }))
        }
    
        pub async fn update_all_analysis(&self) -> Result<serde_json::Value, SqlxError> {
            let analysis = self.analyze_trades().await?;
            Ok(serde_json::to_value(analysis).unwrap())
        }
    
        pub async fn update_cache(&self) -> Result<(), SqlxError> {
            // Force cache update
            let _ = self.analyze_trades().await?;
            Ok(())
        }
    
        async fn calculate_current_streak(&self) -> Result<i32, SqlxError> {
            let recent_trades = sqlx::query(
                "SELECT is_win FROM trades WHERE is_win IS NOT NULL ORDER BY entry_time DESC LIMIT 10"
            )
            .fetch_all(&self.pool)
            .await?;
    
            let mut streak = 0;
            for row in recent_trades {
                let is_win: bool = row.get("is_win");
                if (streak >= 0 && is_win) || (streak <= 0 && !is_win) {
                    streak += if is_win { 1 } else { -1 };
                } else {
                    break;
                }
            }
    
            Ok(streak)
        }
    
        async fn calculate_daily_performance(&self) -> Result<serde_json::Value, SqlxError> {
            let today = Utc::now().format("%Y-%m-%d").to_string();
            
            let daily_stats = sqlx::query(
                r#"
                SELECT 
                    COUNT(*) as total_trades,
                    SUM(CASE WHEN is_win = 1 THEN 1 ELSE 0 END) as winning_trades,
                    SUM(profit_loss_money) as net_profit
                FROM trades 
                WHERE DATE(entry_time) = ? AND is_win IS NOT NULL
                "#
            )
            .bind(&today)
            .fetch_one(&self.pool)
            .await?;
    
            Ok(serde_json::json!({
                "date": today,
                "total_trades": daily_stats.get::<i64, _>("total_trades"),
                "winning_trades": daily_stats.get::<i64, _>("winning_trades"),
                "net_profit": daily_stats.get::<f64, _>("net_profit")
            }))
        }
    
        // Placeholder implementations for analysis methods
        fn calculate_alpha(_returns: &[f64]) -> f64 { 0.0 }
        fn calculate_beta(_returns: &[f64]) -> f64 { 1.0 }
        fn calculate_r_squared(_returns: &[f64]) -> f64 { 0.0 }
        fn calculate_information_ratio(_returns: &[f64]) -> f64 { 0.0 }
        fn calculate_calmar_ratio(_returns: &[f64]) -> f64 { 0.0 }
        fn calculate_ulcer_index(_returns: &[f64]) -> f64 { 0.0 }
        
        fn calculate_monthly_returns(_trades: &[&Trade]) -> Vec<MonthlyReturn> { vec![] }
        fn calculate_daily_returns(_trades: &[&Trade]) -> Vec<f64> { vec![] }
        
        fn analyze_emotional_impact(_trades: &[Trade]) -> EmotionalAnalysis { EmotionalAnalysis::default() }
        fn calculate_consistency_metrics(_trades: &[Trade]) -> ConsistencyMetrics { ConsistencyMetrics::default() }
        fn identify_behavioral_patterns(_trades: &[Trade]) -> BehavioralPatterns { BehavioralPatterns::default() }
        fn analyze_stress_levels(_trades: &[Trade]) -> StressAnalysis { StressAnalysis::default() }
        
        fn calculate_entry_accuracy(_trades: &[&Trade]) -> f64 { 0.0 }
        fn calculate_exit_accuracy(_trades: &[&Trade]) -> f64 { 0.0 }
        fn calculate_timing_efficiency(_trades: &[&Trade]) -> f64 { 0.0 }
        fn analyze_price_action(_trades: &[&Trade]) -> PriceActionAnalysis { PriceActionAnalysis::default() }
        fn analyze_indicator_performance(_trades: &[&Trade]) -> IndicatorAnalysis { IndicatorAnalysis::default() }
        
        fn calculate_pattern_performance(_trades: &[&Trade]) -> HashMap<String, PatternPerformance> { HashMap::new() }
        fn analyze_timeframe_performance(_trades: &[&Trade]) -> HashMap<String, TimeframeAnalysis> { HashMap::new() }
        fn analyze_pattern_combinations(_trades: &[&Trade]) -> CombinationAnalysis { CombinationAnalysis::default() }
        fn calculate_ict_win_rates(_trades: &[&Trade]) -> HashMap<String, f64> { HashMap::new() }
        fn generate_ict_heatmap(_trades: &[&Trade]) -> Vec<ICTHeatmapData> { vec![] }
        
        fn analyze_hourly_performance(_trades: &[&Trade]) -> HashMap<u32, HourlyPerformance> { HashMap::new() }
        fn analyze_daily_performance(_trades: &[&Trade]) -> HashMap<String, DailyPerformance> { HashMap::new() }
        fn analyze_monthly_performance(_trades: &[&Trade]) -> HashMap<String, MonthlyPerformance> { HashMap::new() }
        fn analyze_seasonal_patterns(_trades: &[&Trade]) -> SeasonalAnalysis { SeasonalAnalysis::default() }
        fn analyze_trading_sessions(_trades: &[&Trade]) -> SessionAnalysis { SessionAnalysis::default() }
        
        fn analyze_position_sizing(_trades: &[&Trade]) -> PositionSizingAnalysis { PositionSizingAnalysis::default() }
        fn calculate_risk_metrics(_trades: &[&Trade]) -> RiskMetrics { RiskMetrics::default() }
        fn calculate_var_analysis(_trades: &[&Trade]) -> VaRAnalysis { VaRAnalysis::default() }
        fn perform_stress_testing(_trades: &[&Trade]) -> StressTesting { StressTesting::default() }
        
        fn calculate_strategy_performance(_trades: &[&Trade]) -> HashMap<String, StrategyPerformance> { HashMap::new() }
        fn calculate_strategy_correlation(_trades: &[&Trade]) -> HashMap<String, f64> { HashMap::new() }
        fn calculate_diversification_benefit(_trades: &[&Trade]) -> f64 { 0.0 }
        fn calculate_optimal_strategy_mix(_trades: &[&Trade]) -> HashMap<String, f64> { HashMap::new() }
    }
    
    // Default implementations
    impl Default for TradeAnalysis {
        fn default() -> Self {
            Self {
                summary: AnalysisSummary::default(),
                performance: PerformanceMetrics::default(),
                psychological: PsychologicalMetrics::default(),
                technical: TechnicalAnalysis::default(),
                ict_analysis: ICTAnalysis::default(),
                time_analysis: TimeBasedAnalysis::default(),
                risk_analysis: RiskAnalysis::default(),
                strategy_analysis: StrategyAnalysis::default(),
            }
        }
    }
    
    impl Default for AnalysisSummary {
        fn default() -> Self {
            Self {
                total_trades: 0,
                winning_trades: 0,
                losing_trades: 0,
                open_trades: 0,
                win_rate: 0.0,
                net_profit: 0.0,
                gross_profit: 0.0,
                gross_loss: 0.0,
                profit_factor: 0.0,
                expectancy: 0.0,
                average_trade: 0.0,
                sharpe_ratio: 0.0,
                max_drawdown: 0.0,
                recovery_factor: 0.0,
                risk_of_ruin: 0.0,
            }
        }
    }
    
    // ... Additional default implementations for all structs
    
    // Export for use in main application
    pub use TradeAnalysis;
    pub use AnalysisSummary;
    pub use PerformanceMetrics;