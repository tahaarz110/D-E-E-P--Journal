pub mod database;

use database::{Database, NewTrade, Trade};
use tauri::State;
use std::sync::Arc;

pub struct AppState {
    db: Arc<Database>,
}

#[tauri::command]
async fn create_trade(
    trade: NewTrade,
    state: State<'_, AppState>,
) -> Result<u32, String> {
    state.db.create_trade(trade)
        .await
        .map_err(|e| format!("Failed to create trade: {}", e))
}

#[tauri::command]
async fn get_all_trades(
    state: State<'_, AppState>,
) -> Result<Vec<Trade>, String> {
    state.db.get_all_trades()
        .await
        .map_err(|e| format!("Failed to fetch trades: {}", e))
}

#[tauri::command]
async fn delete_trade(
    id: u32,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state.db.delete_trade(id)
        .await
        .map_err(|e| format!("Failed to delete trade: {}", e))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let app_handle = app.handle();
            tauri::async_runtime::spawn(async move {
                // Initialize database
                let database = Database::new("sqlite:trading_journal.db")
                    .await
                    .expect("Failed to initialize database");
                app_handle.manage(AppState {
                    db: Arc::new(database),
                });
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            create_trade,
            get_all_trades,
            delete_trade
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}