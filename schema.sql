-- Trading Journal Database Schema
CREATE TABLE IF NOT EXISTS trades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    trade_type TEXT NOT NULL CHECK(trade_type IN ('Buy', 'Sell')),
    volume REAL NOT NULL,
    entry_price REAL NOT NULL,
    sl REAL NOT NULL,
    tp REAL NOT NULL,
    entry_time TEXT NOT NULL,
    notes TEXT,
    is_win INTEGER,
    exit_price REAL,
    exit_time TEXT,
    commission REAL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades(symbol);
CREATE INDEX IF NOT EXISTS idx_trades_entry_time ON trades(entry_time);
CREATE INDEX IF NOT EXISTS idx_trades_type ON trades(trade_type);
CREATE INDEX IF NOT EXISTS idx_trades_is_win ON trades(is_win);