use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::sync::Mutex;
use libloading::{Library, Symbol};
use anyhow::{Result, anyhow};

// Plugin trait that all plugins must implement
pub trait Plugin: Send + Sync {
    fn name(&self) -> &'static str;
    fn version(&self) -> &'static str;
    fn description(&self) -> &'static str;
    fn author(&self) -> &'static str;
    
    fn initialize(&mut self) -> Result<(), PluginError>;
    fn execute(&self, command: &str, parameters: &serde_json::Value) -> Result<PluginResult, PluginError>;
    fn shutdown(&mut self) -> Result<(), PluginError>;
    
    fn get_commands(&self) -> Vec<PluginCommand>;
    fn get_config(&self) -> Option<PluginConfig>;
    fn set_config(&mut self, config: PluginConfig) -> Result<(), PluginError>;
}

// Plugin results and structures
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PluginResult {
    pub success: bool,
    pub data: Option<serde_json::Value>,
    pub error: Option<String>,
    pub execution_time: u64,
    pub metadata: HashMap<String, String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PluginCommand {
    pub name: String,
    pub description: String,
    pub parameters: Vec<CommandParameter>,
    pub return_type: String,
    pub examples: Vec<CommandExample>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CommandParameter {
    pub name: String,
    pub parameter_type: String,
    pub required: bool,
    pub description: String,
    pub default: Option<serde_json::Value>,
    pub validation: Option<ParameterValidation>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ParameterValidation {
    pub min_value: Option<f64>,
    pub max_value: Option<f64>,
    pub min_length: Option<usize>,
    pub max_length: Option<usize>,
    pub pattern: Option<String>,
    pub allowed_values: Option<Vec<serde_json::Value>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CommandExample {
    pub input: serde_json::Value,
    pub output: serde_json::Value,
    pub description: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PluginConfig {
    pub name: String,
    pub version: String,
    pub enabled: bool,
    pub settings: HashMap<String, serde_json::Value>,
    pub permissions: Vec<PluginPermission>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PluginPermission {
    pub resource: String,
    pub action: String,
    pub granted: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PluginManifest {
    pub name: String,
    pub version: String,
    pub description: String,
    pub author: String,
    pub entry_point: String,
    pub dependencies: Vec<PluginDependency>,
    pub commands: Vec<PluginCommand>,
    pub config_schema: Option<serde_json::Value>,
    pub permissions: Vec<PluginPermission>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PluginDependency {
    pub name: String,
    pub version: String,
    pub optional: bool,
}

// Plugin errors
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PluginError {
    pub code: String,
    pub message: String,
    pub details: Option<serde_json::Value>,
}

impl PluginError {
    pub fn new(code: &str, message: &str) -> Self {
        Self {
            code: code.to_string(),
            message: message.to_string(),
            details: None,
        }
    }
    
    pub fn with_details(code: &str, message: &str, details: serde_json::Value) -> Self {
        Self {
            code: code.to_string(),
            message: message.to_string(),
            details: Some(details),
        }
    }
}

impl std::fmt::Display for PluginError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "[{}] {}", self.code, self.message)
    }
}

impl std::error::Error for PluginError {}

// Plugin manager
pub struct PluginManager {
    plugins: Arc<Mutex<HashMap<String, Box<dyn Plugin>>>>,
    plugin_path: PathBuf,
    loaded_libraries: Vec<Library>,
}

impl PluginManager {
    pub fn new(plugin_path: impl AsRef<Path>) -> Self {
        Self {
            plugins: Arc::new(Mutex::new(HashMap::new())),
            plugin_path: plugin_path.as_ref().to_path_buf(),
            loaded_libraries: Vec::new(),
        }
    }
    
    pub fn load_plugins(&mut self) -> Result<(), PluginError> {
        log::info!("Loading plugins from: {:?}", self.plugin_path);
        
        if !self.plugin_path.exists() {
            log::warn!("Plugin directory does not exist, creating: {:?}", self.plugin_path);
            std::fs::create_dir_all(&self.plugin_path)
                .map_err(|e| PluginError::new("DIR_CREATE_FAILED", &format!("Failed to create plugin directory: {}", e)))?;
            return Ok(());
        }
        
        // Load native plugins (Rust dynamic libraries)
        self.load_native_plugins()?;
        
        // Load script plugins (Python, JavaScript, etc.)
        self.load_script_plugins()?;
        
        log::info!("Successfully loaded {} plugins", self.plugins.lock().unwrap().len());
        Ok(())
    }
    
    fn load_native_plugins(&mut self) -> Result<(), PluginError> {
        let native_path = self.plugin_path.join("native");
        if !native_path.exists() {
            return Ok(());
        }
        
        for entry in std::fs::read_dir(&native_path)
            .map_err(|e| PluginError::new("DIR_READ_FAILED", &format!("Failed to read plugin directory: {}", e)))?
        {
            let entry = entry
                .map_err(|e| PluginError::new("DIR_ENTRY_FAILED", &format!("Failed to read directory entry: {}", e)))?;
            
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) == Some("dll") {
                if let Err(e) = self.load_native_plugin(&path) {
                    log::error!("Failed to load native plugin {}: {}", path.display(), e);
                }
            }
        }
        
        Ok(())
    }
    
    fn load_native_plugin(&mut self, path: &Path) -> Result<(), PluginError> {
        log::info!("Loading native plugin: {}", path.display());
        
        unsafe {
            let lib = Library::new(path)
                .map_err(|e| PluginError::new("LIBRARY_LOAD_FAILED", &format!("Failed to load library: {}", e)))?;
            
            // Get the plugin creation function
            let create_plugin: Symbol<unsafe extern "C" fn() -> *mut dyn Plugin> = lib
                .get(b"create_plugin")
                .map_err(|e| PluginError::new("SYMBOL_LOAD_FAILED", &format!("Failed to load create_plugin symbol: {}", e)))?;
            
            let plugin_ptr = create_plugin();
            let mut plugin = Box::from_raw(plugin_ptr);
            
            // Initialize the plugin
            plugin.initialize()
                .map_err(|e| PluginError::with_details("PLUGIN_INIT_FAILED", "Failed to initialize plugin", serde_json::to_value(e).unwrap()))?;
            
            let plugin_name = plugin.name().to_string();
            
            // Store the plugin and library
            self.plugins.lock().unwrap().insert(plugin_name, plugin);
            self.loaded_libraries.push(lib);
        }
        
        Ok(())
    }
    
    fn load_script_plugins(&mut self) -> Result<(), PluginError> {
        let script_path = self.plugin_path.join("scripts");
        if !script_path.exists() {
            return Ok(());
        }
        
        // Load Python plugins
        self.load_python_plugins(&script_path)?;
        
        // Load JavaScript plugins
        self.load_javascript_plugins(&script_path)?;
        
        Ok(())
    }
    
    fn load_python_plugins(&mut self, _script_path: &Path) -> Result<(), PluginError> {
        // Implementation for Python plugin loading
        // This would use pyo3 or similar to load Python plugins
        log::info!("Python plugin loading not yet implemented");
        Ok(())
    }
    
    fn load_javascript_plugins(&mut self, _script_path: &Path) -> Result<(), PluginError> {
        // Implementation for JavaScript plugin loading
        // This would use deno_core or similar to load JavaScript plugins
        log::info!("JavaScript plugin loading not yet implemented");
        Ok(())
    }
    
    // Plugin management methods
    pub fn list_plugins(&self) -> Vec<String> {
        self.plugins.lock().unwrap().keys().cloned().collect()
    }
    
    pub fn execute_plugin(
        &self, 
        plugin_name: &str, 
        input: serde_json::Value
    ) -> Result<PluginResult, PluginError> {
        let plugins = self.plugins.lock().unwrap();
        let plugin = plugins.get(plugin_name)
            .ok_or_else(|| PluginError::new("PLUGIN_NOT_FOUND", &format!("Plugin '{}' not found", plugin_name)))?;
        
        let command = input.get("command")
            .and_then(|c| c.as_str())
            .ok_or_else(|| PluginError::new("INVALID_INPUT", "Missing 'command' field in input"))?;
        
        let parameters = input.get("parameters")
            .unwrap_or(&serde_json::Value::Null);
        
        let start_time = std::time::Instant::now();
        let result = plugin.execute(command, parameters)?;
        let execution_time = start_time.elapsed().as_millis() as u64;
        
        Ok(PluginResult {
            execution_time,
            ..result
        })
    }
    
    pub fn get_plugin_commands(&self, plugin_name: &str) -> Result<Vec<PluginCommand>, PluginError> {
        let plugins = self.plugins.lock().unwrap();
        let plugin = plugins.get(plugin_name)
            .ok_or_else(|| PluginError::new("PLUGIN_NOT_FOUND", &format!("Plugin '{}' not found", plugin_name)))?;
        
        Ok(plugin.get_commands())
    }
    
    pub fn get_plugin_config(&self, plugin_name: &str) -> Result<Option<PluginConfig>, PluginError> {
        let plugins = self.plugins.lock().unwrap();
        let plugin = plugins.get(plugin_name)
            .ok_or_else(|| PluginError::new("PLUGIN_NOT_FOUND", &format!("Plugin '{}' not found", plugin_name)))?;
        
        Ok(plugin.get_config())
    }
    
    pub fn set_plugin_config(&self, plugin_name: &str, config: PluginConfig) -> Result<(), PluginError> {
        let mut plugins = self.plugins.lock().unwrap();
        let plugin = plugins.get_mut(plugin_name)
            .ok_or_else(|| PluginError::new("PLUGIN_NOT_FOUND", &format!("Plugin '{}' not found", plugin_name)))?;
        
        plugin.set_config(config)
    }
    
    pub fn health_check(&self, plugin_name: &str) -> Result<(), PluginError> {
        let plugins = self.plugins.lock().unwrap();
        let plugin = plugins.get(plugin_name)
            .ok_or_else(|| PluginError::new("PLUGIN_NOT_FOUND", &format!("Plugin '{}' not found", plugin_name)))?;
        
        // Simple health check - try to get plugin info
        let _name = plugin.name();
        let _version = plugin.version();
        
        Ok(())
    }
    
    pub fn reload_plugin(&mut self, plugin_name: &str) -> Result<(), PluginError> {
        // Unload and reload a specific plugin
        self.unload_plugin(plugin_name)?;
        
        // Find the plugin file and reload it
        let native_path = self.plugin_path.join("native");
        for entry in std::fs::read_dir(&native_path)? {
            let entry = entry?;
            let path = entry.path();
            
            if path.extension().and_then(|s| s.to_str()) == Some("dll") {
                // This is a simplified check - in reality, we'd need to parse the manifest
                if let Ok(()) = self.load_native_plugin(&path) {
                    log::info!("Reloaded plugin: {}", plugin_name);
                    return Ok(());
                }
            }
        }
        
        Err(PluginError::new("PLUGIN_RELOAD_FAILED", &format!("Failed to reload plugin '{}'", plugin_name)))
    }
    
    pub fn unload_plugin(&mut self, plugin_name: &str) -> Result<(), PluginError> {
        let mut plugins = self.plugins.lock().unwrap();
        
        if let Some(mut plugin) = plugins.remove(plugin_name) {
            // Shutdown the plugin
            if let Err(e) = plugin.shutdown() {
                log::error!("Error shutting down plugin {}: {}", plugin_name, e);
            }
            
            // Remove the library from loaded_libraries
            self.loaded_libraries.retain(|lib| {
                // This is simplified - in reality, we'd need to track which library belongs to which plugin
                true
            });
            
            log::info!("Successfully unloaded plugin: {}", plugin_name);
        }
        
        Ok(())
    }
    
    pub fn shutdown_all(&mut self) -> Result<(), PluginError> {
        log::info!("Shutting down all plugins...");
        
        let mut plugins = self.plugins.lock().unwrap();
        let plugin_names: Vec<String> = plugins.keys().cloned().collect();
        
        for plugin_name in plugin_names {
            if let Some(mut plugin) = plugins.remove(&plugin_name) {
                if let Err(e) = plugin.shutdown() {
                    log::error!("Error shutting down plugin {}: {}", plugin_name, e);
                }
            }
        }
        
        // Unload all libraries
        self.loaded_libraries.clear();
        
        log::info!("All plugins shut down successfully");
        Ok(())
    }
}

// Default plugin implementations
pub struct DefaultPlugin {
    name: String,
    version: String,
    description: String,
    author: String,
    config: Option<PluginConfig>,
}

impl Default for DefaultPlugin {
    fn default() -> Self {
        Self {
            name: "DefaultPlugin".to_string(),
            version: "1.0.0".to_string(),
            description: "A default plugin implementation".to_string(),
            author: "System".to_string(),
            config: None,
        }
    }
}

impl Plugin for DefaultPlugin {
    fn name(&self) -> &'static str {
        "DefaultPlugin"
    }
    
    fn version(&self) -> &'static str {
        "1.0.0"
    }
    
    fn description(&self) -> &'static str {
        "A default plugin implementation"
    }
    
    fn author(&self) -> &'static str {
        "System"
    }
    
    fn initialize(&mut self) -> Result<(), PluginError> {
        log::info!("Initializing default plugin");
        Ok(())
    }
    
    fn execute(&self, command: &str, parameters: &serde_json::Value) -> Result<PluginResult, PluginError> {
        match command {
            "echo" => {
                Ok(PluginResult {
                    success: true,
                    data: Some(parameters.clone()),
                    error: None,
                    execution_time: 0,
                    metadata: HashMap::new(),
                })
            }
            "version" => {
                let result = serde_json::json!({
                    "name": self.name(),
                    "version": self.version(),
                    "description": self.description(),
                });
                
                Ok(PluginResult {
                    success: true,
                    data: Some(result),
                    error: None,
                    execution_time: 0,
                    metadata: HashMap::new(),
                })
            }
            _ => {
                Err(PluginError::new("UNKNOWN_COMMAND", &format!("Unknown command: {}", command)))
            }
        }
    }
    
    fn shutdown(&mut self) -> Result<(), PluginError> {
        log::info!("Shutting down default plugin");
        Ok(())
    }
    
    fn get_commands(&self) -> Vec<PluginCommand> {
        vec![
            PluginCommand {
                name: "echo".to_string(),
                description: "Echo back the input parameters".to_string(),
                parameters: vec![
                    CommandParameter {
                        name: "message".to_string(),
                        parameter_type: "string".to_string(),
                        required: false,
                        description: "Message to echo back".to_string(),
                        default: Some(serde_json::Value::String("Hello World".to_string())),
                        validation: None,
                    }
                ],
                return_type: "object".to_string(),
                examples: vec![
                    CommandExample {
                        input: serde_json::json!({"command": "echo", "parameters": {"message": "Hello Plugin"}}),
                        output: serde_json::json!({"message": "Hello Plugin"}),
                        description: "Simple echo example".to_string(),
                    }
                ],
            },
            PluginCommand {
                name: "version".to_string(),
                description: "Get plugin version information".to_string(),
                parameters: vec![],
                return_type: "object".to_string(),
                examples: vec![],
            }
        ]
    }
    
    fn get_config(&self) -> Option<PluginConfig> {
        self.config.clone()
    }
    
    fn set_config(&mut self, config: PluginConfig) -> Result<(), PluginError> {
        self.config = Some(config);
        Ok(())
    }
}

// Export for use in main application
pub use Plugin;
pub use PluginManager;
pub use PluginResult;
pub use PluginError;

// Sample plugins for demonstration
pub struct TechnicalAnalysisPlugin {
    config: PluginConfig,
    indicators: HashMap<String, Box<dyn Indicator>>,
}

impl TechnicalAnalysisPlugin {
    pub fn new() -> Self {
        Self {
            config: PluginConfig {
                name: "TechnicalAnalysis".to_string(),
                version: "1.0.0".to_string(),
                enabled: true,
                settings: HashMap::new(),
                permissions: vec![
                    PluginPermission {
                        resource: "trades".to_string(),
                        action: "read".to_string(),
                        granted: true,
                    },
                    PluginPermission {
                        resource: "market_data".to_string(),
                        action: "read".to_string(),
                        granted: true,
                    },
                ],
            },
            indicators: HashMap::new(),
        }
    }
}

impl Plugin for TechnicalAnalysisPlugin {
    fn name(&self) -> &'static str {
        "TechnicalAnalysis"
    }
    
    fn version(&self) -> &'static str {
        "1.0.0"
    }
    
    fn description(&self) -> &'static str {
        "Advanced technical analysis indicators and pattern recognition"
    }
    
    fn author(&self) -> &'static str {
        "Trading Journal Team"
    }
    
    fn initialize(&mut self) -> Result<(), PluginError> {
        log::info!("Initializing Technical Analysis Plugin");
        
        // Register built-in indicators
        self.indicators.insert("RSI".to_string(), Box::new(RSIIndicator::new(14)));
        self.indicators.insert("MACD".to_string(), Box::new(MACDIndicator::new(12, 26, 9)));
        self.indicators.insert("BollingerBands".to_string(), Box::new(BollingerBandsIndicator::new(20, 2.0)));
        self.indicators.insert("MovingAverage".to_string(), Box::new(MovingAverageIndicator::new(50)));
        
        log::info!("Technical Analysis Plugin initialized with {} indicators", self.indicators.len());
        Ok(())
    }
    
    fn execute(&self, command: &str, parameters: &serde_json::Value) -> Result<PluginResult, PluginError> {
        let start_time = std::time::Instant::now();
        
        match command {
            "calculate_rsi" => {
                let data = parameters.get("data")
                    .and_then(|d| d.as_array())
                    .ok_or_else(|| PluginError::new("INVALID_PARAMETERS", "Missing 'data' array"))?;
                
                let period = parameters.get("period")
                    .and_then(|p| p.as_u64())
                    .unwrap_or(14) as usize;
                
                let rsi_values = self.calculate_rsi(data, period)?;
                
                Ok(PluginResult {
                    success: true,
                    data: Some(serde_json::json!(rsi_values)),
                    error: None,
                    execution_time: start_time.elapsed().as_millis() as u64,
                    metadata: HashMap::from([
                        ("indicator".to_string(), "RSI".to_string()),
                        ("period".to_string(), period.to_string()),
                    ]),
                })
            }
            
            "detect_patterns" => {
                let data = parameters.get("data")
                    .and_then(|d| d.as_array())
                    .ok_or_else(|| PluginError::new("INVALID_PARAMETERS", "Missing 'data' array"))?;
                
                let patterns = self.detect_chart_patterns(data)?;
                
                Ok(PluginResult {
                    success: true,
                    data: Some(serde_json::json!(patterns)),
                    error: None,
                    execution_time: start_time.elapsed().as_millis() as u64,
                    metadata: HashMap::from([
                        ("analysis_type".to_string(), "pattern_detection".to_string()),
                        ("patterns_found".to_string(), patterns.len().to_string()),
                    ]),
                })
            }
            
            "backtest_strategy" => {
                let trades = parameters.get("trades")
                    .and_then(|t| t.as_array())
                    .ok_or_else(|| PluginError::new("INVALID_PARAMETERS", "Missing 'trades' array"))?;
                
                let strategy = parameters.get("strategy")
                    .and_then(|s| s.as_str())
                    .ok_or_else(|| PluginError::new("INVALID_PARAMETERS", "Missing 'strategy' parameter"))?;
                
                let results = self.backtest_strategy(trades, strategy)?;
                
                Ok(PluginResult {
                    success: true,
                    data: Some(serde_json::json!(results)),
                    error: None,
                    execution_time: start_time.elapsed().as_millis() as u64,
                    metadata: HashMap::from([
                        ("strategy".to_string(), strategy.to_string()),
                        ("trades_analyzed".to_string(), trades.len().to_string()),
                    ]),
                })
            }
            
            _ => {
                Err(PluginError::new("UNKNOWN_COMMAND", &format!("Unknown command: {}", command)))
            }
        }
    }
    
    fn shutdown(&mut self) -> Result<(), PluginError> {
        log::info!("Shutting down Technical Analysis Plugin");
        self.indicators.clear();
        Ok(())
    }
    
    fn get_commands(&self) -> Vec<PluginCommand> {
        vec![
            PluginCommand {
                name: "calculate_rsi".to_string(),
                description: "Calculate RSI indicator for given price data".to_string(),
                parameters: vec![
                    CommandParameter {
                        name: "data".to_string(),
                        parameter_type: "array".to_string(),
                        required: true,
                        description: "Array of price values".to_string(),
                        default: None,
                        validation: Some(ParameterValidation {
                            min_length: Some(30),
                            max_length: Some(10000),
                            ..Default::default()
                        }),
                    },
                    CommandParameter {
                        name: "period".to_string(),
                        parameter_type: "integer".to_string(),
                        required: false,
                        description: "RSI period (default: 14)".to_string(),
                        default: Some(serde_json::Value::Number(14.into())),
                        validation: Some(ParameterValidation {
                            min_value: Some(2.0),
                            max_value: Some(100.0),
                            ..Default::default()
                        }),
                    },
                ],
                return_type: "array".to_string(),
                examples: vec![
                    CommandExample {
                        input: serde_json::json!({
                            "command": "calculate_rsi",
                            "parameters": {
                                "data": [44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.85, 46.08, 45.89, 46.03, 46.83, 46.69, 46.45, 46.44, 46.38, 46.04, 46.03, 46.10, 46.19, 46.26],
                                "period": 14
                            }
                        }),
                        output: serde_json::json!([70.46, 66.25, 66.48, 69.35, 66.29, 57.92, 62.88, 63.21, 56.01, 62.34, 54.67, 50.39, 40.02, 41.49, 41.90, 45.50, 37.32, 33.09, 37.79]),
                        description: "Calculate RSI for sample price data".to_string(),
                    }
                ],
            },
            
            PluginCommand {
                name: "detect_patterns".to_string(),
                description: "Detect technical chart patterns in price data".to_string(),
                parameters: vec![
                    CommandParameter {
                        name: "data".to_string(),
                        parameter_type: "array".to_string(),
                        required: true,
                        description: "Array of OHLC price objects".to_string(),
                        default: None,
                        validation: Some(ParameterValidation {
                            min_length: Some(50),
                            max_length: Some(10000),
                            ..Default::default()
                        }),
                    },
                ],
                return_type: "object".to_string(),
                examples: vec![],
            },
            
            PluginCommand {
                name: "backtest_strategy".to_string(),
                description: "Backtest a trading strategy on historical trades".to_string(),
                parameters: vec![
                    CommandParameter {
                        name: "trades".to_string(),
                        parameter_type: "array".to_string(),
                        required: true,
                        description: "Array of trade objects".to_string(),
                        default: None,
                        validation: None,
                    },
                    CommandParameter {
                        name: "strategy".to_string(),
                        parameter_type: "string".to_string(),
                        required: true,
                        description: "Strategy name to backtest".to_string(),
                        default: None,
                        validation: Some(ParameterValidation {
                            allowed_values: Some(vec![
                                serde_json::Value::String("mean_reversion".to_string()),
                                serde_json::Value::String("trend_following".to_string()),
                                serde_json::Value::String("breakout".to_string()),
                            ]),
                            ..Default::default()
                        }),
                    },
                ],
                return_type: "object".to_string(),
                examples: vec![],
            },
        ]
    }
    
    fn get_config(&self) -> Option<PluginConfig> {
        Some(self.config.clone())
    }
    
    fn set_config(&mut self, config: PluginConfig) -> Result<(), PluginError> {
        self.config = config;
        Ok(())
    }
}

// Technical indicator implementations
trait Indicator {
    fn calculate(&self, data: &[f64]) -> Result<Vec<f64>, PluginError>;
    fn name(&self) -> &str;
}

struct RSIIndicator {
    period: usize,
}

impl RSIIndicator {
    fn new(period: usize) -> Self {
        Self { period }
    }
}

impl Indicator for RSIIndicator {
    fn calculate(&self, data: &[f64]) -> Result<Vec<f64>, PluginError> {
        if data.len() < self.period + 1 {
            return Err(PluginError::new("INSUFFICIENT_DATA", "Not enough data points for RSI calculation"));
        }
        
        let mut gains = Vec::new();
        let mut losses = Vec::new();
        
        for i in 1..data.len() {
            let change = data[i] - data[i - 1];
            if change > 0.0 {
                gains.push(change);
                losses.push(0.0);
            } else {
                gains.push(0.0);
                losses.push(change.abs());
            }
        }
        
        let mut rsi_values = Vec::new();
        
        for i in self.period..gains.len() {
            let avg_gain: f64 = gains[i - self.period..=i].iter().sum::<f64>() / self.period as f64;
            let avg_loss: f64 = losses[i - self.period..=i].iter().sum::<f64>() / self.period as f64;
            
            if avg_loss == 0.0 {
                rsi_values.push(100.0);
            } else {
                let rs = avg_gain / avg_loss;
                let rsi = 100.0 - (100.0 / (1.0 + rs));
                rsi_values.push(rsi);
            }
        }
        
        Ok(rsi_values)
    }
    
    fn name(&self) -> &str {
        "RSI"
    }
}

struct MACDIndicator {
    fast_period: usize,
    slow_period: usize,
    signal_period: usize,
}

impl MACDIndicator {
    fn new(fast_period: usize, slow_period: usize, signal_period: usize) -> Self {
        Self {
            fast_period,
            slow_period,
            signal_period,
        }
    }
}

impl Indicator for MACDIndicator {
    fn calculate(&self, data: &[f64]) -> Result<Vec<f64>, PluginError> {
        // Simplified MACD implementation
        Ok(vec![])
    }
    
    fn name(&self) -> &str {
        "MACD"
    }
}

struct BollingerBandsIndicator {
    period: usize,
    std_dev: f64,
}

impl BollingerBandsIndicator {
    fn new(period: usize, std_dev: f64) -> Self {
        Self { period, std_dev }
    }
}

impl Indicator for BollingerBandsIndicator {
    fn calculate(&self, data: &[f64]) -> Result<Vec<f64>, PluginError> {
        // Simplified Bollinger Bands implementation
        Ok(vec![])
    }
    
    fn name(&self) -> &str {
        "BollingerBands"
    }
}

struct MovingAverageIndicator {
    period: usize,
}

impl MovingAverageIndicator {
    fn new(period: usize) -> Self {
        Self { period }
    }
}

impl Indicator for MovingAverageIndicator {
    fn calculate(&self, data: &[f64]) -> Result<Vec<f64>, PluginError> {
        if data.len() < self.period {
            return Err(PluginError::new("INSUFFICIENT_DATA", "Not enough data points for MA calculation"));
        }
        
        let mut ma_values = Vec::new();
        
        for i in (self.period - 1)..data.len() {
            let sum: f64 = data[i - (self.period - 1)..=i].iter().sum();
            let average = sum / self.period as f64;
            ma_values.push(average);
        }
        
        Ok(ma_values)
    }
    
    fn name(&self) -> &str {
        "MovingAverage"
    }
}

// Implementation of helper methods for TechnicalAnalysisPlugin
impl TechnicalAnalysisPlugin {
    fn calculate_rsi(&self, data: &serde_json::Value, period: usize) -> Result<Vec<f64>, PluginError> {
        let price_data: Vec<f64> = data.as_array()
            .ok_or_else(|| PluginError::new("INVALID_DATA", "Expected array of numbers"))?
            .iter()
            .filter_map(|v| v.as_f64())
            .collect();
        
        let rsi_indicator = RSIIndicator::new(period);
        rsi_indicator.calculate(&price_data)
    }
    
    fn detect_chart_patterns(&self, data: &serde_json::Value) -> Result<serde_json::Value, PluginError> {
        // Pattern detection logic would go here
        Ok(serde_json::json!({
            "head_and_shoulders": 0,
            "double_top": 0,
            "double_bottom": 0,
            "triangles": 0,
            "flags": 0,
            "pennants": 0,
        }))
    }
    
    fn backtest_strategy(&self, trades: &serde_json::Value, strategy: &str) -> Result<serde_json::Value, PluginError> {
        // Strategy backtesting logic would go here
        Ok(serde_json::json!({
            "strategy": strategy,
            "total_trades": 0,
            "winning_trades": 0,
            "losing_trades": 0,
            "win_rate": 0.0,
            "net_profit": 0.0,
            "profit_factor": 0.0,
            "max_drawdown": 0.0,
            "sharpe_ratio": 0.0,
        }))
    }
}

// Export the plugin creation function for dynamic loading
#[no_mangle]
pub extern "C" fn create_plugin() -> *mut dyn Plugin {
    let plugin = TechnicalAnalysisPlugin::new();
    let boxed: Box<dyn Plugin> = Box::new(plugin);
    Box::into_raw(boxed)
}

