use sqlx::{sqlite::SqlitePoolOptions, SqlitePool, Row, Error as SqlxError};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use chrono::{DateTime, Utc};
use uuid::Uuid;
use tokio::fs;
use std::path::PathBuf;
use image::{ImageFormat, imageops::FilterType};

// Trade structures
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NewTrade {
    pub symbol: String,
    pub trade_type: String,
    pub volume: f64,
    pub entry_price: f64,
    pub sl: f64,
    pub tp: f64,
    pub entry_time: String,
    pub notes: Option<String>,
    pub commission: Option<f64>,
    pub swap: Option<f64>,
    
    // ICT Fields
    pub ict_pattern: Option<String>,
    pub pattern_type: Option<String>,
    pub pattern_size: Option<f64>,
    pub pattern_timeframe: Option<String>,
    pub pattern_combination: Option<Vec<String>>,
    pub chart_explanation: Option<String>,
    
    // Meta-driven fields
    pub strategy_name: Option<String>,
    pub emotion: Option<String>,
    pub confidence_level: Option<f64>,
    pub market_condition: Option<String>,
    pub session: Option<String>,
    
    // Image fields
    pub entry_image: Option<String>,
    pub exit_image: Option<String>,
    pub analysis_image: Option<String>,
    
    // Technical fields
    pub rsi: Option<f64>,
    pub macd: Option<f64>,
    pub moving_average: Option<f64>,
    pub support_level: Option<f64>,
    pub resistance_level: Option<f64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Trade {
    pub id: u32,
    #[serde(flatten)]
    pub new_trade: NewTrade,
    pub is_win: Option<bool>,
    pub exit_price: Option<f64>,
    pub exit_time: Option<String>,
    pub profit_loss_pips: Option<f64>,
    pub profit_loss_money: Option<f64>,
    pub risk_reward_ratio: Option<f64>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub version: u32,
}

// Database query parameters
#[derive(Debug, Clone)]
pub struct TradeQuery {
    pub symbol: Option<Vec<String>>,
    pub trade_type: Option<Vec<String>>,
    pub date_range: Option<(DateTime<Utc>, DateTime<Utc>)>,
    pub ict_pattern: Option<Vec<String>>,
    pub strategy_name: Option<Vec<String>>,
    pub is_win: Option<bool>,
    pub min_profit: Option<f64>,
    pub max_profit: Option<f64>,
    pub emotion: Option<Vec<String>>,
    pub market_condition: Option<Vec<String>>,
    pub limit: Option<u32>,
    pub offset: Option<u32>,
    pub sort_by: Option<String>,
    pub sort_order: Option<String>,
}

// Schema management
#[derive(Debug, Serialize, Deserialize)]
pub struct EntitySchema {
    pub name: String,
    pub fields: Vec<FieldSchema>,
    pub indexes: Vec<IndexSchema>,
    pub relationships: Vec<RelationshipSchema>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FieldSchema {
    pub name: String,
    pub data_type: String,
    pub constraints: Vec<String>,
    pub ui: FieldUI,
    pub validation: Option<FieldValidation>,
    pub dependencies: Option<Vec<FieldDependency>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FieldUI {
    pub label: String,
    pub component: String,
    pub order: u32,
    pub col_span: u32,
    pub hidden: bool,
    pub readonly: bool,
    pub options: Option<Vec<FieldOption>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FieldOption {
    pub label: String,
    pub value: String,
    pub color: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FieldValidation {
    pub required: bool,
    pub min_length: Option<usize>,
    pub max_length: Option<usize>,
    pub min_value: Option<f64>,
    pub max_value: Option<f64>,
    pub pattern: Option<String>,
    pub custom_validator: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FieldDependency {
    pub field: String,
    pub condition: DependencyCondition,
    pub action: DependencyAction,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DependencyCondition {
    pub operator: String,
    pub value: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DependencyAction {
    pub action_type: String,
    pub target_field: String,
    pub value: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct IndexSchema {
    pub name: String,
    pub fields: Vec<String>,
    pub unique: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RelationshipSchema {
    pub name: String,
    pub target_entity: String,
    pub relationship_type: String,
    pub foreign_key: String,
}

// Database state
pub struct DatabaseState {
    pool: SqlitePool,
    schema_cache: HashMap<String, EntitySchema>,
    image_storage_path: PathBuf,
}

impl DatabaseState {
    // Initialize database
    pub async fn initialize(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        log::info!("Initializing database...");
        
        // Create necessary directories
        self.create_directories().await?;
        
        // Run migrations
        self.run_migrations().await?;
        
        // Load default schemas
        self.load_default_schemas().await?;
        
        // Create indexes
        self.create_indexes().await?;
        
        log::info!("Database initialized successfully");
        Ok(())
    }
    
    // Create necessary directories
    async fn create_directories(&self) -> Result<(), Box<dyn std::error::Error>> {
        let directories = [
            "data",
            "data/images",
            "data/thumbnails",
            "data/backups",
            "data/exports",
            "config",
            "logs"
        ];
        
        for dir in directories.iter() {
            fs::create_dir_all(dir).await?;
        }
        
        Ok(())
    }
    
    // Run database migrations
    async fn run_migrations(&self) -> Result<(), Box<dyn std::error::Error>> {
        log::info!("Running database migrations...");
        
        // Main trades table
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS trades (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                symbol TEXT NOT NULL,
                trade_type TEXT NOT NULL CHECK(trade_type IN ('Buy', 'Sell')),
                volume REAL NOT NULL,
                entry_price REAL NOT NULL,
                sl REAL NOT NULL,
                tp REAL NOT NULL,
                entry_time TEXT NOT NULL,
                exit_time TEXT,
                exit_price REAL,
                commission REAL,
                swap REAL,
                notes TEXT,
                
                -- ICT Fields
                ict_pattern TEXT,
                pattern_type TEXT,
                pattern_size REAL,
                pattern_timeframe TEXT,
                pattern_combination TEXT,
                chart_explanation TEXT,
                
                -- Meta-driven fields
                strategy_name TEXT,
                emotion TEXT,
                confidence_level REAL,
                market_condition TEXT,
                session TEXT,
                
                -- Image fields
                entry_image TEXT,
                exit_image TEXT,
                analysis_image TEXT,
                
                -- Technical fields
                rsi REAL,
                macd REAL,
                moving_average REAL,
                support_level REAL,
                resistance_level REAL,
                
                -- Calculated fields
                is_win INTEGER,
                profit_loss_pips REAL,
                profit_loss_money REAL,
                risk_reward_ratio REAL,
                
                -- Audit fields
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                version INTEGER NOT NULL DEFAULT 1
            )
            "#
        ).execute(&self.pool).await?;
        
        // Schema version table
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS schema_versions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                version INTEGER NOT NULL,
                applied_at TEXT NOT NULL,
                description TEXT NOT NULL
            )
            "#
        ).execute(&self.pool).await?;
        
        // Entity schemas table
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS entity_schemas (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                entity_name TEXT UNIQUE NOT NULL,
                schema_json TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            "#
        ).execute(&self.pool).await?;
        
        // Plugin data table
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS plugin_data (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                plugin_name TEXT NOT NULL,
                data_key TEXT NOT NULL,
                data_value TEXT NOT NULL,
                data_type TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                UNIQUE(plugin_name, data_key)
            )
            "#
        ).execute(&self.pool).await?;
        
        // Trade statistics table (for performance)
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS trade_statistics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                statistic_type TEXT NOT NULL,
                statistic_key TEXT NOT NULL,
                statistic_value REAL NOT NULL,
                calculation_date TEXT NOT NULL,
                time_period TEXT NOT NULL,
                UNIQUE(statistic_type, statistic_key, calculation_date, time_period)
            )
            "#
        ).execute(&self.pool).await?;
        
        log::info!("Database migrations completed successfully");
        Ok(())
    }
    
    // Create indexes for performance
    async fn create_indexes(&self) -> Result<(), Box<dyn std::error::Error>> {
        log::info!("Creating database indexes...");
        
        let indexes = [
            "CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades(symbol)",
            "CREATE INDEX IF NOT EXISTS idx_trades_entry_time ON trades(entry_time)",
            "CREATE INDEX IF NOT EXISTS idx_trades_trade_type ON trades(trade_type)",
            "CREATE INDEX IF NOT EXISTS idx_trades_ict_pattern ON trades(ict_pattern)",
            "CREATE INDEX IF NOT EXISTS idx_trades_strategy_name ON trades(strategy_name)",
            "CREATE INDEX IF NOT EXISTS idx_trades_is_win ON trades(is_win)",
            "CREATE INDEX IF NOT EXISTS idx_trades_emotion ON trades(emotion)",
            "CREATE INDEX IF NOT EXISTS idx_trades_market_condition ON trades(market_condition)",
            "CREATE INDEX IF NOT EXISTS idx_trades_session ON trades(session)",
            "CREATE INDEX IF NOT EXISTS idx_trades_created_at ON trades(created_at)",
            "CREATE INDEX IF NOT EXISTS idx_trade_stats_type_key ON trade_statistics(statistic_type, statistic_key)",
            "CREATE INDEX IF NOT EXISTS idx_plugin_data_name_key ON plugin_data(plugin_name, data_key)",
        ];
        
        for index_sql in indexes.iter() {
            sqlx::query(index_sql).execute(&self.pool).await?;
        }
        
        log::info!("Database indexes created successfully");
        Ok(())
    }
    
    // Load default schemas
    async fn load_default_schemas(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        log::info!("Loading default schemas...");
        
        let default_trade_schema = EntitySchema {
            name: "Trade".to_string(),
            fields: vec![
                FieldSchema {
                    name: "id".to_string(),
                    data_type: "integer".to_string(),
                    constraints: vec!["PRIMARY KEY".to_string(), "AUTOINCREMENT".to_string()],
                    ui: FieldUI {
                        label: "ID".to_string(),
                        component: "text".to_string(),
                        order: 0,
                        col_span: 1,
                        hidden: false,
                        readonly: true,
                        options: None,
                    },
                    validation: None,
                    dependencies: None,
                },
                FieldSchema {
                    name: "symbol".to_string(),
                    data_type: "string".to_string(),
                    constraints: vec!["NOT NULL".to_string()],
                    ui: FieldUI {
                        label: "Symbol".to_string(),
                        component: "select".to_string(),
                        order: 1,
                        col_span: 1,
                        hidden: false,
                        readonly: false,
                        options: Some(vec![
                            FieldOption { label: "EUR/USD".to_string(), value: "EURUSD".to_string(), color: Some("#3B82F6".to_string()) },
                            FieldOption { label: "GBP/USD".to_string(), value: "GBPUSD".to_string(), color: Some("#EF4444".to_string()) },
                            FieldOption { label: "USD/JPY".to_string(), value: "USDJPY".to_string(), color: Some("#10B981".to_string()) },
                            FieldOption { label: "AUD/USD".to_string(), value: "AUDUSD".to_string(), color: Some("#F59E0B".to_string()) },
                            FieldOption { label: "USD/CAD".to_string(), value: "USDCAD".to_string(), color: Some("#8B5CF6".to_string()) },
                            FieldOption { label: "XAU/USD".to_string(), value: "XAUUSD".to_string(), color: Some("#F97316".to_string()) },
                        ]),
                    },
                    validation: Some(FieldValidation {
                        required: true,
                        min_length: Some(1),
                        max_length: Some(20),
                        min_value: None,
                        max_value: None,
                        pattern: None,
                        custom_validator: None,
                    }),
                    dependencies: None,
                },
                // ... more fields would be defined here
            ],
            indexes: vec![
                IndexSchema {
                    name: "idx_trades_symbol".to_string(),
                    fields: vec!["symbol".to_string()],
                    unique: false,
                },
                IndexSchema {
                    name: "idx_trades_entry_time".to_string(),
                    fields: vec!["entry_time".to_string()],
                    unique: false,
                },
            ],
            relationships: vec![],
        };
        
        // Save default schema to database
        self.save_schema(&default_trade_schema).await?;
        self.schema_cache.insert("Trade".to_string(), default_trade_schema);
        
        log::info!("Default schemas loaded successfully");
        Ok(())
    }

        // Trade operations
        pub async fn create_trade(&self, trade: NewTrade) -> Result<u32, SqlxError> {
            let now = Utc::now().to_rfc3339();
            
            // Calculate derived fields
            let (is_win, profit_loss_pips, profit_loss_money, risk_reward_ratio) = 
                self.calculate_trade_metrics(&trade).await;
            
            // Serialize pattern combination to JSON
            let pattern_combination_json = trade.pattern_combination
                .as_ref()
                .and_then(|patterns| serde_json::to_string(patterns).ok());
            
            let result = sqlx::query(
                r#"
                INSERT INTO trades (
                    symbol, trade_type, volume, entry_price, sl, tp, entry_time, notes,
                    commission, swap, ict_pattern, pattern_type, pattern_size, pattern_timeframe,
                    pattern_combination, chart_explanation, strategy_name, emotion, confidence_level,
                    market_condition, session, entry_image, exit_image, analysis_image, rsi, macd,
                    moving_average, support_level, resistance_level, is_win, profit_loss_pips,
                    profit_loss_money, risk_reward_ratio, created_at, updated_at, version
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                "#
            )
            .bind(&trade.symbol)
            .bind(&trade.trade_type)
            .bind(trade.volume)
            .bind(trade.entry_price)
            .bind(trade.sl)
            .bind(trade.tp)
            .bind(&trade.entry_time)
            .bind(&trade.notes)
            .bind(trade.commission)
            .bind(trade.swap)
            .bind(&trade.ict_pattern)
            .bind(&trade.pattern_type)
            .bind(trade.pattern_size)
            .bind(&trade.pattern_timeframe)
            .bind(pattern_combination_json)
            .bind(&trade.chart_explanation)
            .bind(&trade.strategy_name)
            .bind(&trade.emotion)
            .bind(trade.confidence_level)
            .bind(&trade.market_condition)
            .bind(&trade.session)
            .bind(&trade.entry_image)
            .bind(&trade.exit_image)
            .bind(&trade.analysis_image)
            .bind(trade.rsi)
            .bind(trade.macd)
            .bind(trade.moving_average)
            .bind(trade.support_level)
            .bind(trade.resistance_level)
            .bind(is_win)
            .bind(profit_loss_pips)
            .bind(profit_loss_money)
            .bind(risk_reward_ratio)
            .bind(&now)
            .bind(&now)
            .bind(1)
            .execute(&self.pool)
            .await?;
            
            Ok(result.last_insert_rowid() as u32)
        }
        
        pub async fn get_all_trades(&self) -> Result<Vec<Trade>, SqlxError> {
            let trades = sqlx::query_as::<_, Trade>(
                r#"
                SELECT * FROM trades ORDER BY entry_time DESC
                "#
            )
            .fetch_all(&self.pool)
            .await?;
            
            Ok(trades)
        }
        
        pub async fn get_trades_with_query(&self, query: TradeQuery) -> Result<Vec<Trade>, SqlxError> {
            let mut sql = "SELECT * FROM trades WHERE 1=1".to_string();
            let mut params: Vec<String> = Vec::new();
            
            // Build WHERE clause based on query parameters
            if let Some(symbols) = &query.symbol {
                if !symbols.is_empty() {
                    let placeholders = symbols.iter().map(|_| "?").collect::<Vec<_>>().join(",");
                    sql.push_str(&format!(" AND symbol IN ({})", placeholders));
                    params.extend(symbols.clone());
                }
            }
            
            if let Some(trade_types) = &query.trade_type {
                if !trade_types.is_empty() {
                    let placeholders = trade_types.iter().map(|_| "?").collect::<Vec<_>>().join(",");
                    sql.push_str(&format!(" AND trade_type IN ({})", placeholders));
                    params.extend(trade_types.clone());
                }
            }
            
            if let Some((start_date, end_date)) = &query.date_range {
                sql.push_str(" AND entry_time BETWEEN ? AND ?");
                params.push(start_date.to_rfc3339());
                params.push(end_date.to_rfc3339());
            }
            
            if let Some(ict_patterns) = &query.ict_pattern {
                if !ict_patterns.is_empty() {
                    let placeholders = ict_patterns.iter().map(|_| "?").collect::<Vec<_>>().join(",");
                    sql.push_str(&format!(" AND ict_pattern IN ({})", placeholders));
                    params.extend(ict_patterns.clone());
                }
            }
            
            if let Some(is_win) = query.is_win {
                sql.push_str(" AND is_win = ?");
                params.push(if is_win { "1".to_string() } else { "0".to_string() });
            }
            
            // Add sorting
            if let Some(sort_by) = &query.sort_by {
                let order = query.sort_order.as_deref().unwrap_or("DESC");
                sql.push_str(&format!(" ORDER BY {} {}", sort_by, order));
            } else {
                sql.push_str(" ORDER BY entry_time DESC");
            }
            
            // Add pagination
            if let (Some(limit), Some(offset)) = (query.limit, query.offset) {
                sql.push_str(&format!(" LIMIT {} OFFSET {}", limit, offset));
            }
            
            // Execute query
            let mut query_builder = sqlx::query_as::<_, Trade>(&sql);
            
            for param in params {
                query_builder = query_builder.bind(param);
            }
            
            let trades = query_builder.fetch_all(&self.pool).await?;
            
            Ok(trades)
        }
        
        pub async fn update_trade(
            &self, 
            id: u32, 
            updates: HashMap<String, serde_json::Value>
        ) -> Result<Trade, SqlxError> {
            let now = Utc::now().to_rfc3339();
            
            // Build dynamic update query
            let mut set_clauses = Vec::new();
            let mut params: Vec<serde_json::Value> = Vec::new();
            
            for (key, value) in updates {
                set_clauses.push(format!("{} = ?", key));
                params.push(value);
            }
            
            // Always update updated_at and version
            set_clauses.push("updated_at = ?".to_string());
            params.push(serde_json::Value::String(now.clone()));
            set_clauses.push("version = version + 1".to_string());
            
            let set_clause = set_clauses.join(", ");
            
            let sql = format!("UPDATE trades SET {} WHERE id = ?", set_clause);
            
            let mut query_builder = sqlx::query(&sql);
            
            for param in params {
                query_builder = query_builder.bind(param);
            }
            
            query_builder.bind(id).execute(&self.pool).await?;
            
            // Return updated trade
            self.get_trade_by_id(id).await
        }
        
        pub async fn delete_trade(&self, id: u32) -> Result<(), SqlxError> {
            sqlx::query("DELETE FROM trades WHERE id = ?")
                .bind(id)
                .execute(&self.pool)
                .await?;
            
            Ok(())
        }
        
        pub async fn get_trade_by_id(&self, id: u32) -> Result<Trade, SqlxError> {
            sqlx::query_as::<_, Trade>("SELECT * FROM trades WHERE id = ?")
                .bind(id)
                .fetch_one(&self.pool)
                .await
        }
        
        // Schema operations
        pub async fn get_schema(&self, entity_name: &str) -> Result<serde_json::Value, SqlxError> {
            // Check cache first
            if let Some(schema) = self.schema_cache.get(entity_name) {
                return Ok(serde_json::to_value(schema).unwrap());
            }
            
            // Load from database
            let row = sqlx::query(
                "SELECT schema_json FROM entity_schemas WHERE entity_name = ?"
            )
            .bind(entity_name)
            .fetch_one(&self.pool)
            .await?;
            
            let schema_json: String = row.get("schema_json");
            let schema: EntitySchema = serde_json::from_str(&schema_json)
                .map_err(|e| SqlxError::ColumnDecode { 
                    index: "schema_json".to_string(), 
                    source: e.into() 
                })?;
            
            // Cache the schema
            self.schema_cache.insert(entity_name.to_string(), schema.clone());
            
            Ok(serde_json::to_value(schema).unwrap())
        }
        
        pub async fn update_schema(&mut self, schema: serde_json::Value) -> Result<(), SqlxError> {
            let entity_schema: EntitySchema = serde_json::from_value(schema)
                .map_err(|e| SqlxError::ColumnDecode { 
                    index: "schema".to_string(), 
                    source: e.into() 
                })?;
            
            let now = Utc::now().to_rfc3339();
            let schema_json = serde_json::to_string(&entity_schema).unwrap();
            
            sqlx::query(
                r#"
                INSERT OR REPLACE INTO entity_schemas (entity_name, schema_json, created_at, updated_at)
                VALUES (?, ?, COALESCE((SELECT created_at FROM entity_schemas WHERE entity_name = ?), ?), ?)
                "#
            )
            .bind(&entity_schema.name)
            .bind(&schema_json)
            .bind(&entity_schema.name)
            .bind(&now)
            .bind(&now)
            .execute(&self.pool)
            .await?;
            
            // Update cache
            self.schema_cache.insert(entity_schema.name, entity_schema);
            
            Ok(())
        }
        
        // Image management
        pub async fn save_image(&self, file_path: &str) -> Result<String, Box<dyn std::error::Error>> {
            let original_path = PathBuf::from(file_path);
            
            if !original_path.exists() {
                return Err("Source file does not exist".into());
            }
            
            // Generate unique filename
            let file_extension = original_path.extension()
                .and_then(|ext| ext.to_str())
                .unwrap_or("webp");
            
            let unique_filename = format!("{}.{}", Uuid::new_v4(), file_extension);
            let target_path = self.image_storage_path.join("images").join(&unique_filename);
            let thumbnail_path = self.image_storage_path.join("thumbnails").join(&unique_filename);
            
            // Copy original image
            fs::copy(&original_path, &target_path).await?;
            
            // Create thumbnail
            self.create_thumbnail(&original_path, &thumbnail_path).await?;
            
            // Return relative path for database storage
            Ok(format!("images/{}", unique_filename))
        }
        
        async fn create_thumbnail(
            &self, 
            source_path: &PathBuf, 
            target_path: &PathBuf
        ) -> Result<(), Box<dyn std::error::Error>> {
            let image_data = fs::read(source_path).await?;
            let image_format = ImageFormat::from_path(source_path)?;
            
            let image = image::load_from_memory_with_format(&image_data, image_format)?;
            let thumbnail = image.resize(200, 200, FilterType::Lanczos3);
            
            thumbnail.save_with_format(target_path, ImageFormat::WebP)?;
            
            Ok(())
        }
        
        // Calculate trade metrics
        async fn calculate_trade_metrics(
            &self, 
            trade: &NewTrade
        ) -> (Option<bool>, Option<f64>, Option<f64>, Option<f64>) {
            // If trade is not closed, return None for calculated fields
            if trade.exit_price.is_none() {
                return (None, None, None, None);
            }
            
            let entry_price = trade.entry_price;
            let exit_price = trade.exit_price.unwrap();
            let volume = trade.volume;
            
            // Calculate P/L in pips
            let price_diff = exit_price - entry_price;
            let profit_loss_pips = if trade.symbol.contains("JPY") {
                price_diff * 100.0 // For JPY pairs
            } else {
                price_diff * 10000.0 // For other pairs
            };
            
            // Calculate P/L in money (simplified calculation)
            let profit_loss_money = price_diff * volume * 100000.0; // Standard lot size
            
            // Determine if trade is win
            let is_win = if trade.trade_type == "Buy" {
                profit_loss_money > 0.0
            } else {
                profit_loss_money < 0.0
            };
            
            // Calculate risk/reward ratio
            let risk = (entry_price - trade.sl).abs();
            let reward = (trade.tp - entry_price).abs();
            let risk_reward_ratio = if risk > 0.0 { reward / risk } else { 0.0 };
            
            (Some(is_win), Some(profit_loss_pips), Some(profit_loss_money), Some(risk_reward_ratio))
        }
        
        // Health check
        pub async fn health_check(&self) -> Result<(), SqlxError> {
            sqlx::query("SELECT 1").execute(&self.pool).await?;
            Ok(())
        }
        
        // Close database connections
        pub async fn close(&self) -> Result<(), SqlxError> {
            self.pool.close().await;
            Ok(())
        }
    }
    
    // Implementation of Default for DatabaseState
    impl Default for DatabaseState {
        fn default() -> Self {
            // This will be properly initialized in the setup phase
            Self {
                pool: SqlitePoolOptions::new()
                    .connect_lazy("sqlite:data/trading_journal.db")
                    .expect("Failed to create database pool"),
                schema_cache: HashMap::new(),
                image_storage_path: PathBuf::from("."),
            }
        }
    }
    
    // Utility functions for trade analysis
    impl DatabaseState {
        pub async fn calculate_trade_statistics(&self) -> Result<HashMap<String, f64>, SqlxError> {
            let stats = sqlx::query(
                r#"
                SELECT 
                    COUNT(*) as total_trades,
                    SUM(CASE WHEN is_win = 1 THEN 1 ELSE 0 END) as winning_trades,
                    SUM(CASE WHEN is_win = 0 THEN 1 ELSE 0 END) as losing_trades,
                    SUM(CASE WHEN is_win IS NULL THEN 1 ELSE 0 END) as open_trades,
                    AVG(CASE WHEN is_win = 1 THEN profit_loss_money ELSE NULL END) as avg_win,
                    AVG(CASE WHEN is_win = 0 THEN profit_loss_money ELSE NULL END) as avg_loss,
                    SUM(profit_loss_money) as net_profit,
                    MAX(profit_loss_money) as largest_win,
                    MIN(profit_loss_money) as largest_loss
                FROM trades
                "#
            )
            .fetch_one(&self.pool)
            .await?;
            
            let mut statistics = HashMap::new();
            statistics.insert("total_trades".to_string(), stats.get::<i64, _>("total_trades") as f64);
            statistics.insert("winning_trades".to_string(), stats.get::<i64, _>("winning_trades") as f64);
            statistics.insert("losing_trades".to_string(), stats.get::<i64, _>("losing_trades") as f64);
            statistics.insert("open_trades".to_string(), stats.get::<i64, _>("open_trades") as f64);
            statistics.insert("avg_win".to_string(), stats.get::<Option<f64>, _>("avg_win").unwrap_or(0.0));
            statistics.insert("avg_loss".to_string(), stats.get::<Option<f64>, _>("avg_loss").unwrap_or(0.0));
            statistics.insert("net_profit".to_string(), stats.get::<Option<f64>, _>("net_profit").unwrap_or(0.0));
            statistics.insert("largest_win".to_string(), stats.get::<Option<f64>, _>("largest_win").unwrap_or(0.0));
            statistics.insert("largest_loss".to_string(), stats.get::<Option<f64>, _>("largest_loss").unwrap_or(0.0));
            
            // Calculate derived statistics
            let win_rate = if statistics["total_trades"] > 0.0 {
                statistics["winning_trades"] / statistics["total_trades"] * 100.0
            } else {
                0.0
            };
            statistics.insert("win_rate".to_string(), win_rate);
            
            let profit_factor = if statistics["avg_loss"].abs() > 0.0 {
                statistics["avg_win"] / statistics["avg_loss"].abs()
            } else {
                f64::INFINITY
            };
            statistics.insert("profit_factor".to_string(), profit_factor);
            
            Ok(statistics)
        }
    }
    
    // Export for use in other modules
    pub use Trade;
    pub use NewTrade;
    pub use TradeQuery;
    pub use EntitySchema;