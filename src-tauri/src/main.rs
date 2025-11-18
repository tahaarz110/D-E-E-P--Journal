use tauri::{
    App, AppHandle, Builder, Manager, RunEvent, Runtime, Window, WindowEvent, 
    PhysicalPosition, PhysicalSize, SystemTray, SystemTrayMenu, SystemTrayMenuItem, 
    SystemTrayEvent, CustomMenuItem, SystemTraySubmenu, State
};
use tauri_plugin_store::StoreBuilder;
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap, 
    sync::{Arc, Mutex}, 
    time::{Duration, SystemTime}
};
use tokio::time::interval;

// Application modules
mod database;
mod plugins;
mod trading;
mod analysis;
mod backup;
mod integration;
mod utils;

// Re-exports
pub use database::{Trade, NewTrade, TradeQuery, DatabaseState};
pub use plugins::{PluginManager, Plugin, PluginResult};
pub use trading::{TradingEngine, MarketData, Order, Position};
pub use analysis::{Analyzer, TechnicalAnalysis, StatisticalAnalysis};
pub use backup::{BackupManager, BackupConfig};
pub use integration::{MetaTraderIntegration, MT4Connection, MT5Connection};
pub use utils::{Config, Logger, Error, Result};

// Application state
#[derive(Default)]
struct AppState {
    database: DatabaseState,
    plugins: PluginManager,
    trading_engine: TradingEngine,
    analyzer: Analyzer,
    backup_manager: BackupManager,
    mt_integration: MetaTraderIntegration,
    config: Config,
    is_initialized: bool,
}

// Tauri commands
#[tauri::command]
async fn create_trade(
    trade: NewTrade,
    state: State<'_, Arc<Mutex<AppState>>>,
    app_handle: AppHandle,
) -> Result<u32, String> {
    let mut state = state.lock().unwrap();
    
    if !state.is_initialized {
        return Err("Application not initialized".to_string());
    }

    match state.database.create_trade(trade).await {
        Ok(id) => {
            // Notify all windows about the new trade
            if let Err(e) = app_handle.emit_all("trade_created", id) {
                log::error!("Failed to emit trade_created event: {}", e);
            }
            
            // Trigger analysis update
            tokio::spawn(async move {
                if let Err(e) = update_analysis(&app_handle).await {
                    log::error!("Failed to update analysis: {}", e);
                }
            });
            
            Ok(id)
        }
        Err(e) => Err(format!("Failed to create trade: {}", e)),
    }
}

#[tauri::command]
async fn get_all_trades(
    state: State<'_, Arc<Mutex<AppState>>>,
) -> Result<Vec<Trade>, String> {
    let state = state.lock().unwrap();
    
    if !state.is_initialized {
        return Err("Application not initialized".to_string());
    }

    state.database.get_all_trades().await
        .map_err(|e| format!("Failed to fetch trades: {}", e))
}

#[tauri::command]
async fn delete_trade(
    id: u32,
    state: State<'_, Arc<Mutex<AppState>>>,
    app_handle: AppHandle,
) -> Result<(), String> {
    let mut state = state.lock().unwrap();
    
    if !state.is_initialized {
        return Err("Application not initialized".to_string());
    }

    match state.database.delete_trade(id).await {
        Ok(()) => {
            // Notify about deletion
            if let Err(e) = app_handle.emit_all("trade_deleted", id) {
                log::error!("Failed to emit trade_deleted event: {}", e);
            }
            
            // Update analysis
            tokio::spawn(async move {
                if let Err(e) = update_analysis(&app_handle).await {
                    log::error!("Failed to update analysis: {}", e);
                }
            });
            
            Ok(())
        }
        Err(e) => Err(format!("Failed to delete trade: {}", e)),
    }
}

#[tauri::command]
async fn update_trade(
    id: u32,
    updates: HashMap<String, serde_json::Value>,
    state: State<'_, Arc<Mutex<AppState>>>,
    app_handle: AppHandle,
) -> Result<Trade, String> {
    let mut state = state.lock().unwrap();
    
    if !state.is_initialized {
        return Err("Application not initialized".to_string());
    }

    match state.database.update_trade(id, updates).await {
        Ok(trade) => {
            // Notify about update
            if let Err(e) = app_handle.emit_all("trade_updated", &trade) {
                log::error!("Failed to emit trade_updated event: {}", e);
            }
            
            // Update analysis
            tokio::spawn(async move {
                if let Err(e) = update_analysis(&app_handle).await {
                    log::error!("Failed to update analysis: {}", e);
                }
            });
            
            Ok(trade)
        }
        Err(e) => Err(format!("Failed to update trade: {}", e)),
    }
}

// Schema management commands
#[tauri::command]
async fn get_schema(
    entity_name: String,
    state: State<'_, Arc<Mutex<AppState>>>,
) -> Result<serde_json::Value, String> {
    let state = state.lock().unwrap();
    
    if !state.is_initialized {
        return Err("Application not initialized".to_string());
    }

    state.database.get_schema(&entity_name).await
        .map_err(|e| format!("Failed to get schema: {}", e))
}

#[tauri::command]
async fn update_schema(
    schema: serde_json::Value,
    state: State<'_, Arc<Mutex<AppState>>>,
) -> Result<(), String> {
    let mut state = state.lock().unwrap();
    
    if !state.is_initialized {
        return Err("Application not initialized".to_string());
    }

    state.database.update_schema(schema).await
        .map_err(|e| format!("Failed to update schema: {}", e))
}

// ICT Analysis commands
#[tauri::command]
async fn get_ict_win_rates(
    state: State<'_, Arc<Mutex<AppState>>>,
) -> Result<Vec<HashMap<String, serde_json::Value>>, String> {
    let state = state.lock().unwrap();
    
    if !state.is_initialized {
        return Err("Application not initialized".to_string());
    }

    state.analyzer.calculate_ict_win_rates().await
        .map_err(|e| format!("Failed to calculate ICT win rates: {}", e))
}

#[tauri::command]
async fn get_ict_heatmap_data(
    state: State<'_, Arc<Mutex<AppState>>>,
) -> Result<Vec<HashMap<String, serde_json::Value>>, String> {
    let state = state.lock().unwrap();
    
    if !state.is_initialized {
        return Err("Application not initialized".to_string());
    }

    state.analyzer.calculate_ict_heatmap().await
        .map_err(|e| format!("Failed to calculate ICT heatmap: {}", e))
}

// Plugin system commands
#[tauri::command]
async fn list_plugins(
    state: State<'_, Arc<Mutex<AppState>>>,
) -> Result<Vec<String>, String> {
    let state = state.lock().unwrap();
    
    if !state.is_initialized {
        return Err("Application not initialized".to_string());
    }

    Ok(state.plugins.list_plugins())
}

#[tauri::command]
async fn execute_plugin(
    name: String,
    input: serde_json::Value,
    state: State<'_, Arc<Mutex<AppState>>>,
) -> Result<PluginResult, String> {
    let state = state.lock().unwrap();
    
    if !state.is_initialized {
        return Err("Application not initialized".to_string());
    }

    state.plugins.execute_plugin(&name, input)
        .map_err(|e| format!("Failed to execute plugin: {}", e))
}

// Backup and restore commands
#[tauri::command]
async fn create_backup(
    state: State<'_, Arc<Mutex<AppState>>>,
) -> Result<String, String> {
    let state = state.lock().unwrap();
    
    if !state.is_initialized {
        return Err("Application not initialized".to_string());
    }

    state.backup_manager.create_backup().await
        .map_err(|e| format!("Failed to create backup: {}", e))
}

#[tauri::command]
async fn restore_from_backup(
    zip_path: String,
    state: State<'_, Arc<Mutex<AppState>>>,
) -> Result<(), String> {
    let mut state = state.lock().unwrap();
    
    if !state.is_initialized {
        return Err("Application not initialized".to_string());
    }

    state.backup_manager.restore_backup(&zip_path).await
        .map_err(|e| format!("Failed to restore backup: {}", e))
}

// Image management
#[tauri::command]
async fn save_image(
    file_path: String,
    state: State<'_, Arc<Mutex<AppState>>>,
) -> Result<String, String> {
    let state = state.lock().unwrap();
    
    if !state.is_initialized {
        return Err("Application not initialized".to_string());
    }

    state.database.save_image(&file_path).await
        .map_err(|e| format!("Failed to save image: {}", e))
}

// Dashboard data
#[tauri::command]
async fn get_dashboard_data(
    time_range: String,
    state: State<'_, Arc<Mutex<AppState>>>,
) -> Result<serde_json::Value, String> {
    let state = state.lock().unwrap();
    
    if !state.is_initialized {
        return Err("Application not initialized".to_string());
    }

    state.analyzer.get_dashboard_data(&time_range).await
        .map_err(|e| format!("Failed to get dashboard data: {}", e))
}

// Helper function to update analysis and notify frontend
async fn update_analysis(app_handle: &AppHandle) -> Result<(), String> {
    // Recalculate all analysis
    let analysis_data = app_handle.state::<Arc<Mutex<AppState>>>()
        .lock()
        .unwrap()
        .analyzer
        .update_all_analysis()
        .await
        .map_err(|e| format!("Failed to update analysis: {}", e))?;
    
    // Notify frontend about analysis update
    app_handle.emit_all("analysis_updated", analysis_data)
        .map_err(|e| format!("Failed to emit analysis_updated event: {}", e))?;
    
    Ok(())
}

// Application initialization
async fn initialize_app(state: &mut AppState) -> Result<(), Box<dyn std::error::Error>> {
    log::info!("Initializing application...");
    
    // Initialize database
    state.database.initialize().await?;
    log::info!("Database initialized");
    
    // Load plugins
    state.plugins.load_plugins()?;
    log::info!("Plugins loaded: {}", state.plugins.list_plugins().len());
    
    // Initialize trading engine
    state.trading_engine.initialize().await?;
    log::info!("Trading engine initialized");
    
    // Initialize analyzer
    state.analyzer.initialize().await?;
    log::info!("Analyzer initialized");
    
    // Initialize backup manager
    state.backup_manager.initialize().await?;
    log::info!("Backup manager initialized");
    
    // Try to connect to MetaTrader
    if let Err(e) = state.mt_integration.initialize().await {
        log::warn!("MetaTrader integration failed: {}", e);
    } else {
        log::info!("MetaTrader integration initialized");
    }
    
    // Load configuration
    state.config.load().await?;
    log::info!("Configuration loaded");
    
    state.is_initialized = true;
    log::info!("Application initialization completed successfully");
    
    Ok(())
}

// System tray configuration
fn create_system_tray() -> SystemTray {
    let quit = CustomMenuItem::new("quit".to_string(), "Quit");
    let hide = CustomMenuItem::new("hide".to_string(), "Hide");
    let show = CustomMenuItem::new("show".to_string(), "Show");
    let dashboard = CustomMenuItem::new("dashboard".to_string(), "Dashboard");
    let new_trade = CustomMenuItem::new("new_trade".to_string(), "New Trade");
    
    let trading_submenu = SystemTraySubmenu::new(
        "Trading",
        SystemTrayMenu::new()
            .add_item(new_trade)
            .add_item(CustomMenuItem::new("trade_list".to_string(), "Trade List"))
            .add_native_item(SystemTrayMenuItem::Separator)
            .add_item(CustomMenuItem::new("quick_analysis".to_string(), "Quick Analysis")),
    );
    
    let tools_submenu = SystemTraySubmenu::new(
        "Tools",
        SystemTrayMenu::new()
            .add_item(CustomMenuItem::new("backup".to_string(), "Create Backup"))
            .add_item(CustomMenuItem::new("export".to_string(), "Export Data"))
            .add_native_item(SystemTrayMenuItem::Separator)
            .add_item(CustomMenuItem::new("settings".to_string(), "Settings")),
    );

    SystemTray::new().with_menu(
        SystemTrayMenu::new()
            .add_item(dashboard)
            .add_submenu(trading_submenu)
            .add_submenu(tools_submenu)
            .add_native_item(SystemTrayMenuItem::Separator)
            .add_item(hide)
            .add_item(show)
            .add_native_item(SystemTrayMenuItem::Separator)
            .add_item(quit)
    )
}

// Handle system tray events
fn handle_system_tray_event<R: Runtime>(
    app: &AppHandle<R>,
    event: SystemTrayEvent,
) {
    match event {
        SystemTrayEvent::LeftClick { .. } => {
            let window = app.get_window("main").unwrap();
            window.show().unwrap();
            window.set_focus().unwrap();
        }
        SystemTrayEvent::MenuItemClick { id, .. } => {
            let window = app.get_window("main").unwrap();
            
            match id.as_str() {
                "quit" => {
                    // Save state and exit
                    app.exit(0);
                }
                "hide" => {
                    window.hide().unwrap();
                }
                "show" => {
                    window.show().unwrap();
                    window.set_focus().unwrap();
                }
                "dashboard" => {
                    window.show().unwrap();
                    window.set_focus().unwrap();
                    let _ = window.eval("window.location.href = '/dashboard'");
                }
                "new_trade" => {
                    window.show().unwrap();
                    window.set_focus().unwrap();
                    let _ = window.eval("window.location.href = '/add-trade'");
                }
                "trade_list" => {
                    window.show().unwrap();
                    window.set_focus().unwrap();
                    let _ = window.eval("window.location.href = '/trades'");
                }
                "quick_analysis" => {
                    // Execute quick analysis
                    let app_handle = app.clone();
                    tauri::async_runtime::spawn(async move {
                        if let Err(e) = execute_quick_analysis(&app_handle).await {
                            log::error!("Quick analysis failed: {}", e);
                        }
                    });
                }
                "backup" => {
                    let app_handle = app.clone();
                    tauri::async_runtime::spawn(async move {
                        match create_backup_command(&app_handle).await {
                            Ok(path) => {
                                let _ = app_handle.emit_all(
                                    "backup_created", 
                                    format!("Backup created at: {}", path)
                                );
                            }
                            Err(e) => {
                                let _ = app_handle.emit_all(
                                    "backup_error", 
                                    format!("Backup failed: {}", e)
                                );
                            }
                        }
                    });
                }
                "export" => {
                    window.show().unwrap();
                    window.set_focus().unwrap();
                    let _ = window.eval("window.location.href = '/settings?tab=export'");
                }
                "settings" => {
                    window.show().unwrap();
                    window.set_focus().unwrap();
                    let _ = window.eval("window.location.href = '/settings'");
                }
                _ => {}
            }
        }
        _ => {}
    }
}

// Backup command for system tray
async fn create_backup_command<R: Runtime>(app_handle: &AppHandle<R>) -> Result<String, String> {
    let state = app_handle.state::<Arc<Mutex<AppState>>>();
    let state = state.lock().unwrap();
    
    if !state.is_initialized {
        return Err("Application not initialized".to_string());
    }

    state.backup_manager.create_backup().await
        .map_err(|e| format!("Failed to create backup: {}", e))
}

// Quick analysis function
async fn execute_quick_analysis<R: Runtime>(app_handle: &AppHandle<R>) -> Result<(), String> {
    let state = app_handle.state::<Arc<Mutex<AppState>>>();
    let state = state.lock().unwrap();
    
    if !state.is_initialized {
        return Err("Application not initialized".to_string());
    }

    let analysis = state.analyzer.quick_analysis().await
        .map_err(|e| format!("Quick analysis failed: {}", e))?;
    
    app_handle.emit_all("quick_analysis_complete", analysis)
        .map_err(|e| format!("Failed to emit analysis result: {}", e))?;
    
    Ok(())
}

// Window event handlers
fn handle_window_events<R: Runtime>(window: &Window<R>) {
    let window = window.clone();
    
    // Handle window close event
    window.on_window_event(move |event| {
        if let WindowEvent::CloseRequested { api, .. } = event {
            // Instead of closing, hide to tray
            api.prevent_close();
            window.hide().unwrap();
        }
    });
}

// Background tasks
async fn start_background_tasks<R: Runtime>(app_handle: AppHandle<R>) -> Result<(), Box<dyn std::error::Error>> {
    let app_handle_clone = app_handle.clone();
    
    // Auto-backup task (every 6 hours)
    let backup_handle = app_handle.clone();
    tokio::spawn(async move {
        let mut interval = interval(Duration::from_secs(6 * 60 * 60)); // 6 hours
        loop {
            interval.tick().await;
            
            let state = backup_handle.state::<Arc<Mutex<AppState>>>();
            let state = state.lock().unwrap();
            
            if state.is_initialized && state.config.auto_backup_enabled {
                if let Err(e) = state.backup_manager.create_backup().await {
                    log::error!("Auto-backup failed: {}", e);
                } else {
                    log::info!("Auto-backup completed successfully");
                }
            }
        }
    });
    
    // Data sync task (every 5 minutes)
    let sync_handle = app_handle.clone();
    tokio::spawn(async move {
        let mut interval = interval(Duration::from_secs(5 * 60)); // 5 minutes
        loop {
            interval.tick().await;
            
            let state = sync_handle.state::<Arc<Mutex<AppState>>>();
            let state = state.lock().unwrap();
            
            if state.is_initialized {
                // Sync with MetaTrader if connected
                if state.mt_integration.is_connected() {
                    if let Err(e) = state.mt_integration.sync_trades().await {
                        log::warn!("MetaTrader sync failed: {}", e);
                    }
                }
                
                // Update analysis cache
                if let Err(e) = state.analyzer.update_cache().await {
                    log::warn!("Analysis cache update failed: {}", e);
                }
            }
        }
    });
    
    // Health monitoring task (every minute)
    let health_handle = app_handle_clone;
    tokio::spawn(async move {
        let mut interval = interval(Duration::from_secs(60)); // 1 minute
        loop {
            interval.tick().await;
            
            let state = health_handle.state::<Arc<Mutex<AppState>>>();
            let state = state.lock().unwrap();
            
            if state.is_initialized {
                // Check database health
                if let Err(e) = state.database.health_check().await {
                    log::error!("Database health check failed: {}", e);
                    let _ = health_handle.emit_all("database_error", e.to_string());
                }
                
                // Check disk space
                if let Err(e) = state.backup_manager.check_disk_space().await {
                    log::warn!("Disk space check failed: {}", e);
                }
                
                // Check plugin health
                for plugin in state.plugins.list_plugins() {
                    if let Err(e) = state.plugins.health_check(&plugin) {
                        log::warn!("Plugin {} health check failed: {}", plugin, e);
                    }
                }
            }
        }
    });
    
    Ok(())
}

// Application setup
fn setup_app<R: Runtime>(app: &AppHandle<R>) -> Result<(), Box<dyn std::error::Error>> {
    let app_handle = app.clone();
    
    // Initialize application state
    tauri::async_runtime::block_on(async move {
        let state = app_handle.state::<Arc<Mutex<AppState>>>();
        let mut state = state.lock().unwrap();
        
        if let Err(e) = initialize_app(&mut state).await {
            log::error!("Application initialization failed: {}", e);
            // Notify frontend about initialization failure
            let _ = app_handle.emit_all("initialization_failed", e.to_string());
        } else {
            // Notify frontend about successful initialization
            let _ = app_handle.emit_all("initialization_complete", ());
            
            // Start background tasks
            if let Err(e) = start_background_tasks(app_handle.clone()).await {
                log::error!("Failed to start background tasks: {}", e);
            }
        }
    });
    
    Ok(())
}

// Main function
fn main() {
    // Initialize logger
    env_logger::init();
    
    // Build Tauri application
    let app = Builder::default()
        .setup(|app| {
            let app_handle = app.handle();
            
            // Initialize application state
            let app_state = Arc::new(Mutex::new(AppState::default()));
            app_handle.manage(app_state);
            
            // Setup application
            setup_app(app_handle)?;
            
            // Configure main window
            let window = app.get_window("main").unwrap();
            handle_window_events(&window);
            
            // Set window position and size from config
            if let Ok(config) = std::fs::read_to_string("config/window.json") {
                if let Ok(window_config) = serde_json::from_str::<HashMap<String, serde_json::Value>>(&config) {
                    if let (Some(x), Some(y), Some(width), Some(height)) = (
                        window_config.get("x").and_then(|v| v.as_u64()),
                        window_config.get("y").and_then(|v| v.as_u64()),
                        window_config.get("width").and_then(|v| v.as_u64()),
                        window_config.get("height").and_then(|v| v.as_u64()),
                    ) {
                        let _ = window.set_position(PhysicalPosition::new(x as i32, y as i32));
                        let _ = window.set_size(PhysicalSize::new(width as f64, height as f64));
                    }
                }
            }
            
            Ok(())
        })
        .system_tray(create_system_tray())
        .on_system_tray_event(handle_system_tray_event)
        .invoke_handler(tauri::generate_handler![
            create_trade,
            get_all_trades,
            delete_trade,
            update_trade,
            get_schema,
            update_schema,
            get_ict_win_rates,
            get_ict_heatmap_data,
            list_plugins,
            execute_plugin,
            create_backup,
            restore_from_backup,
            save_image,
            get_dashboard_data
        ])
        .build(tauri::generate_context!())
        .expect("Error while building Tauri application");

    // Run application
    app.run(|app_handle, event| {
        match event {
            RunEvent::Ready => {
                log::info!("Application is ready");
            }
            RunEvent::ExitRequested { api, .. } => {
                // Save application state before exit
                let state = app_handle.state::<Arc<Mutex<AppState>>>();
                let state = state.lock().unwrap();
                
                if state.is_initialized {
                    // Save window position and size
                    if let Some(window) = app_handle.get_window("main") {
                        if let (Ok(position), Ok(size)) = (window.outer_position(), window.outer_size()) {
                            let window_config = serde_json::json!({
                                "x": position.x,
                                "y": position.y,
                                "width": size.width,
                                "height": size.height
                            });
                            
                            if let Ok(config_str) = serde_json::to_string_pretty(&window_config) {
                                let _ = std::fs::create_dir_all("config");
                                let _ = std::fs::write("config/window.json", config_str);
                            }
                        }
                    }
                    
                    // Close database connections
                    if let Err(e) = tauri::async_runtime::block_on(state.database.close()) {
                        log::error!("Failed to close database: {}", e);
                    }
                }
                
                api.prevent_exit();
            }
            RunEvent::Exit => {
                log::info!("Application is shutting down");
            }
            _ => {}
        }
    });
}

// Export for testing
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_system_tray_creation() {
        let tray = create_system_tray();
        assert!(tray.get_menu().is_some());
    }

    #[tokio::test]
    async fn test_trade_creation() {
        // Test trade creation logic
    }
}