use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs::{self, File};
use std::io::{Write, Read};
use std::path::{Path, PathBuf};
use chrono::{DateTime, Utc};
use zip::{ZipWriter, write::SimpleFileOptions, read::ZipArchive};
use walkdir::WalkDir;
use crypto_hash::{Algorithm, hex_digest};
use tokio::task;

// Backup configuration
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BackupConfig {
    pub enabled: bool,
    pub auto_backup: bool,
    pub backup_interval_hours: u32,
    pub max_backup_files: u32,
    pub compression_level: u32,
    pub include_images: bool,
    pub include_plugins: bool,
    pub backup_locations: Vec<PathBuf>,
    pub encryption_enabled: bool,
    pub encryption_key: Option<String>,
}

impl Default for BackupConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            auto_backup: true,
            backup_interval_hours: 24,
            max_backup_files: 30,
            compression_level: 6,
            include_images: true,
            include_plugins: true,
            backup_locations: vec![PathBuf::from("backups")],
            encryption_enabled: false,
            encryption_key: None,
        }
    }
}

// Backup metadata
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BackupMetadata {
    pub version: String,
    pub created_at: DateTime<Utc>,
    pub file_count: u32,
    pub total_size: u64,
    pub checksum: String,
    pub database_schema_version: u32,
    pub application_version: String,
    pub included_components: Vec<String>,
    pub notes: Option<String>,
}

// Backup result
#[derive(Debug, Serialize, Deserialize)]
pub struct BackupResult {
    pub success: bool,
    pub backup_path: PathBuf,
    pub metadata: BackupMetadata,
    pub duration_seconds: f64,
    pub errors: Vec<String>,
}

// Backup manager
pub struct BackupManager {
    config: BackupConfig,
    backup_dir: PathBuf,
    encryption_key: Option<Vec<u8>>,
}

impl BackupManager {
    pub fn new(backup_dir: impl AsRef<Path>) -> Self {
        let backup_dir = backup_dir.as_ref().to_path_buf();
        
        Self {
            config: BackupConfig::default(),
            backup_dir,
            encryption_key: None,
        }
    }
    
    pub async fn initialize(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        log::info!("Initializing backup manager...");
        
        // Create backup directory if it doesn't exist
        if !self.backup_dir.exists() {
            fs::create_dir_all(&self.backup_dir)?;
            log::info!("Created backup directory: {:?}", self.backup_dir);
        }
        
        // Load configuration
        self.load_config().await?;
        
        // Initialize encryption if enabled
        if self.config.encryption_enabled {
            self.initialize_encryption().await?;
        }
        
        log::info!("Backup manager initialized successfully");
        Ok(())
    }
    
    async fn load_config(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        let config_path = self.backup_dir.join("backup_config.json");
        
        if config_path.exists() {
            let config_data = tokio::fs::read(&config_path).await?;
            self.config = serde_json::from_slice(&config_data)?;
            log::info!("Loaded backup configuration from: {:?}", config_path);
        } else {
            // Save default configuration
            self.save_config().await?;
            log::info!("Created default backup configuration");
        }
        
        Ok(())
    }
    
    async fn save_config(&self) -> Result<(), Box<dyn std::error::Error>> {
        let config_path = self.backup_dir.join("backup_config.json");
        let config_data = serde_json::to_vec_pretty(&self.config)?;
        tokio::fs::write(&config_path, config_data).await?;
        Ok(())
    }
    
    async fn initialize_encryption(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        if let Some(key) = &self.config.encryption_key {
            // In a real implementation, you would use proper key derivation
            self.encryption_key = Some(key.as_bytes().to_vec());
            log::info!("Encryption initialized");
        } else {
            log::warn!("Encryption enabled but no key provided");
        }
        
        Ok(())
    }
    
    // Main backup creation method
    pub async fn create_backup(&self) -> Result<String, Box<dyn std::error::Error>> {
        let start_time = std::time::Instant::now();
        log::info!("Starting backup creation...");
        
        // Generate backup filename with timestamp
        let timestamp = Utc::now().format("%Y%m%d_%H%M%S");
        let backup_filename = format!("trading_journal_backup_{}.zip", timestamp);
        let backup_path = self.backup_dir.join(&backack_filename);
        
        // Create backup file
        let file = File::create(&backup_path)?;
        let options = SimpleFileOptions::default()
            .compression_method(zip::CompressionMethod::Deflated)
            .compression_level(Some(self.config.compression_level as i32));
        
        let mut zip = ZipWriter::new(file);
        
        let mut included_files = Vec::new();
        let mut total_size = 0u64;
        
        // Backup database
        let db_files = self.backup_database(&mut zip, &options).await?;
        included_files.extend(db_files);
        
        // Backup images if enabled
        if self.config.include_images {
            let image_files = self.backup_images(&mut zip, &options).await?;
            included_files.extend(image_files);
        }
        
        // Backup plugins if enabled
        if self.config.include_plugins {
            let plugin_files = self.backup_plugins(&mut zip, &options).await?;
            included_files.extend(plugin_files);
        }
        
        // Backup configuration
        let config_files = self.backup_configuration(&mut zip, &options).await?;
        included_files.extend(config_files);
        
        // Calculate total size
        total_size = included_files.iter().map(|f| f.size).sum();
        
        // Create and add metadata
        let metadata = self.create_metadata(&included_files, total_size).await?;
        let metadata_json = serde_json::to_vec_pretty(&metadata)?;
        
        zip.start_file("backup_metadata.json", options)?;
        zip.write_all(&metadata_json)?;
        
        // Finalize zip file
        zip.finish()?;
        
        let duration = start_time.elapsed().as_secs_f64();
        
        log::info!("Backup created successfully: {:?}", backup_path);
        log::info!("Backup statistics: {} files, {:.2} MB, {:.2} seconds", 
                  included_files.len(), total_size as f64 / 1024.0 / 1024.0, duration);
        
        // Clean up old backups
        self.cleanup_old_backups().await?;
        
        Ok(backup_path.to_string_lossy().to_string())
    }
    
    // Backup database files
    async fn backup_database(
        &self,
        zip: &mut ZipWriter<File>,
        options: &SimpleFileOptions,
    ) -> Result<Vec<BackupFileInfo>, Box<dyn std::error::Error>> {
        let mut files = Vec::new();
        
        let db_files = vec![
            "data/trading_journal.db",
            "data/trading_journal.db-wal",
            "data/trading_journal.db-shm",
        ];
        
        for db_file in db_files {
            let path = PathBuf::from(db_file);
            if path.exists() {
                if let Ok(file_info) = self.add_file_to_zip(zip, &path, "data/", options).await {
                    files.push(file_info);
                }
            }
        }
        
        // Backup schema information
        let schema_files = self.backup_schema(zip, options).await?;
        files.extend(schema_files);
        
        Ok(files)
    }
    
    // Backup database schema
    async fn backup_schema(
        &self,
        zip: &mut ZipWriter<File>,
        options: &SimpleFileOptions,
    ) -> Result<Vec<BackupFileInfo>, Box<dyn std::error::Error>> {
        let mut files = Vec::new();
        
        // Export schema to JSON
        let schema_path = PathBuf::from("data/schema_backup.json");
        self.export_schema_to_file(&schema_path).await?;
        
        if let Ok(file_info) = self.add_file_to_zip(zip, &schema_path, "data/", options).await {
            files.push(file_info);
        }
        
        // Clean up temporary schema file
        let _ = tokio::fs::remove_file(&schema_path).await;
        
        Ok(files)
    }
    
    async fn export_schema_to_file(&self, path: &Path) -> Result<(), Box<dyn std::error::Error>> {
        // This would export the current database schema
        let schema_data = serde_json::json!({
            "exported_at": Utc::now().to_rfc3339(),
            "tables": vec!["trades", "entity_schemas", "plugin_data"],
            "version": "1.0.0"
        });
        
        let schema_json = serde_json::to_vec_pretty(&schema_data)?;
        tokio::fs::write(path, schema_json).await?;
        
        Ok(())
    }
    
    // Backup images
    async fn backup_images(
        &self,
        zip: &mut ZipWriter<File>,
        options: &SimpleFileOptions,
    ) -> Result<Vec<BackupFileInfo>, Box<dyn std::error::Error>> {
        let mut files = Vec::new();
        
        let image_dirs = vec!["data/images", "data/thumbnails"];
        
        for image_dir in image_dirs {
            let path = PathBuf::from(image_dir);
            if path.exists() {
                let dir_files = self.backup_directory(zip, &path, "images/", options).await?;
                files.extend(dir_files);
            }
        }
        
        Ok(files)
    }
    
    // Backup plugins
    async fn backup_plugins(
        &self,
        zip: &mut ZipWriter<File>,
        options: &SimpleFileOptions,
    ) -> Result<Vec<BackupFileInfo>, Box<dyn std::error::Error>> {
        let mut files = Vec::new();
        
        let plugin_dirs = vec!["plugins/native", "plugins/scripts"];
        
        for plugin_dir in plugin_dirs {
            let path = PathBuf::from(plugin_dir);
            if path.exists() {
                let dir_files = self.backup_directory(zip, &path, "plugins/", options).await?;
                files.extend(dir_files);
            }
        }
        
        Ok(files)
    }
    
    // Backup configuration
    async fn backup_configuration(
        &self,
        zip: &mut ZipWriter<File>,
        options: &SimpleFileOptions,
    ) -> Result<Vec<BackupFileInfo>, Box<dyn std::error::Error>> {
        let mut files = Vec::new();
        
        let config_files = vec![
            "config/app_settings.json",
            "config/theme_settings.json",
            "config/window_settings.json",
            "backups/backup_config.json",
        ];
        
        for config_file in config_files {
            let path = PathBuf::from(config_file);
            if path.exists() {
                if let Ok(file_info) = self.add_file_to_zip(zip, &path, "config/", options).await {
                    files.push(file_info);
                }
            }
        }
        
        Ok(files)
    }
    
    // Backup a directory recursively
    async fn backup_directory(
        &self,
        zip: &mut ZipWriter<File>,
        dir_path: &Path,
        zip_prefix: &str,
        options: &SimpleFileOptions,
    ) -> Result<Vec<BackupFileInfo>, Box<dyn std::error::Error>> {
        let mut files = Vec::new();
        
        for entry in WalkDir::new(dir_path) {
            let entry = entry?;
            let path = entry.path();
            
            if path.is_file() {
                if let Ok(file_info) = self.add_file_to_zip(zip, path, zip_prefix, options).await {
                    files.push(file_info);
                }
            }
        }
        
        Ok(files)
    }
    
    // Add a single file to the zip archive
    async fn add_file_to_zip(
        &self,
        zip: &mut ZipWriter<File>,
        file_path: &Path,
        zip_prefix: &str,
        options: &SimpleFileOptions,
    ) -> Result<BackupFileInfo, Box<dyn std::error::Error>> {
        let file_name = file_path.file_name()
            .ok_or_else(|| std::io::Error::new(std::io::ErrorKind::InvalidInput, "Invalid file name"))?
            .to_string_lossy();
        
        let zip_path = format!("{}{}", zip_prefix, file_name);
        
        let metadata = file_path.metadata()?;
        let file_size = metadata.len();
        
        // Read file content
        let file_content = tokio::fs::read(file_path).await?;
        
        // Calculate checksum
        let checksum = hex_digest(Algorithm::SHA256, &file_content);
        
        // Encrypt if enabled
        let final_content = if let Some(key) = &self.encryption_key {
            self.encrypt_data(&file_content, key).await?
        } else {
            file_content
        };
        
        // Add to zip
        zip.start_file(&zip_path, *options)?;
        zip.write_all(&final_content)?;
        
        Ok(BackupFileInfo {
            path: file_path.to_path_buf(),
            zip_path: zip_path.to_string(),
            size: file_size,
            checksum,
            encrypted: self.encryption_key.is_some(),
        })
    }

        // Create backup metadata
        async fn create_metadata(
            &self,
            files: &[BackupFileInfo],
            total_size: u64,
        ) -> Result<BackupMetadata, Box<dyn std::error::Error>> {
            let file_checksums: Vec<String> = files.iter().map(|f| f.checksum.clone()).collect();
            let combined_checksum = hex_digest(Algorithm::SHA256, &file_checksums.join("").as_bytes());
            
            let included_components = self.get_included_components(files);
            
            Ok(BackupMetadata {
                version: "1.0.0".to_string(),
                created_at: Utc::now(),
                file_count: files.len() as u32,
                total_size,
                checksum: combined_checksum,
                database_schema_version: 1,
                application_version: env!("CARGO_PKG_VERSION").to_string(),
                included_components,
                notes: Some("Automated backup".to_string()),
            })
        }
        
        fn get_included_components(&self, files: &[BackupFileInfo]) -> Vec<String> {
            let mut components = Vec::new();
            
            if files.iter().any(|f| f.zip_path.starts_with("data/") && f.path.extension().map(|e| e == "db").unwrap_or(false)) {
                components.push("database".to_string());
            }
            
            if files.iter().any(|f| f.zip_path.starts_with("images/")) {
                components.push("images".to_string());
            }
            
            if files.iter().any(|f| f.zip_path.starts_with("plugins/")) {
                components.push("plugins".to_string());
            }
            
            if files.iter().any(|f| f.zip_path.starts_with("config/")) {
                components.push("configuration".to_string());
            }
            
            components
        }
        
        // Restore from backup
        pub async fn restore_backup(&self, backup_path: &str) -> Result<(), Box<dyn std::error::Error>> {
            let start_time = std::time::Instant::now();
            log::info!("Starting backup restoration from: {}", backup_path);
            
            let backup_file = File::open(backup_path)?;
            let mut zip = ZipArchive::new(backup_file)?;
            
            // Read and validate metadata
            let metadata = self.read_backup_metadata(&mut zip).await?;
            log::info!("Backup metadata: version {}, {} files, {:.2} MB", 
                      metadata.version, metadata.file_count, metadata.total_size as f64 / 1024.0 / 1024.0);
            
            // Validate backup integrity
            self.validate_backup_integrity(&mut zip, &metadata).await?;
            
            // Create restore directory
            let restore_dir = self.create_restore_directory().await?;
            
            // Extract files
            let extracted_files = self.extract_backup_files(&mut zip, &restore_dir).await?;
            
            // Restore database
            self.restore_database(&extracted_files, &restore_dir).await?;
            
            // Restore images
            self.restore_images(&extracted_files, &restore_dir).await?;
            
            // Restore plugins
            self.restore_plugins(&extracted_files, &restore_dir).await?;
            
            // Restore configuration
            self.restore_configuration(&extracted_files, &restore_dir).await?;
            
            // Clean up restore directory
            self.cleanup_restore_directory(&restore_dir).await?;
            
            let duration = start_time.elapsed().as_secs_f64();
            log::info!("Backup restoration completed successfully in {:.2} seconds", duration);
            
            Ok(())
        }
        
        async fn read_backup_metadata(&self, zip: &mut ZipArchive<File>) -> Result<BackupMetadata, Box<dyn std::error::Error>> {
            let mut metadata_file = zip.by_name("backup_metadata.json")?;
            let mut metadata_json = String::new();
            metadata_file.read_to_string(&mut metadata_json)?;
            
            let metadata: BackupMetadata = serde_json::from_str(&metadata_json)?;
            Ok(metadata)
        }
        
        async fn validate_backup_integrity(
            &self,
            zip: &mut ZipArchive<File>,
            metadata: &BackupMetadata,
        ) -> Result<(), Box<dyn std::error::Error>> {
            log::info!("Validating backup integrity...");
            
            // Check file count
            if zip.len() != metadata.file_count as usize + 1 { // +1 for metadata file
                return Err("Backup file count mismatch".into());
            }
            
            // Verify checksum (simplified)
            let mut file_checksums = Vec::new();
            
            for i in 0..zip.len() {
                let mut file = zip.by_index(i)?;
                if file.name() == "backup_metadata.json" {
                    continue;
                }
                
                let mut content = Vec::new();
                file.read_to_end(&mut content)?;
                
                let checksum = hex_digest(Algorithm::SHA256, &content);
                file_checksums.push(checksum);
            }
            
            let combined_checksum = hex_digest(Algorithm::SHA256, &file_checksums.join("").as_bytes());
            
            if combined_checksum != metadata.checksum {
                return Err("Backup checksum validation failed".into());
            }
            
            log::info!("Backup integrity validation passed");
            Ok(())
        }
        
        async fn create_restore_directory(&self) -> Result<PathBuf, Box<dyn std::error::Error>> {
            let timestamp = Utc::now().format("%Y%m%d_%H%M%S");
            let restore_dir = self.backup_dir.join(format!("restore_{}", timestamp));
            
            tokio::fs::create_dir_all(&restore_dir).await?;
            log::info!("Created restore directory: {:?}", restore_dir);
            
            Ok(restore_dir)
        }
        
        async fn extract_backup_files(
            &self,
            zip: &mut ZipArchive<File>,
            restore_dir: &Path,
        ) -> Result<Vec<RestoredFile>, Box<dyn std::error::Error>> {
            let mut restored_files = Vec::new();
            
            for i in 0..zip.len() {
                let mut file = zip.by_index(i)?;
                let file_path = restore_dir.join(file.name());
                
                // Create parent directories if needed
                if let Some(parent) = file_path.parent() {
                    tokio::fs::create_dir_all(parent).await?;
                }
                
                let mut content = Vec::new();
                file.read_to_end(&mut content)?;
                
                // Decrypt if encrypted
                let final_content = if self.is_file_encrypted(&content) {
                    if let Some(key) = &self.encryption_key {
                        self.decrypt_data(&content, key).await?
                    } else {
                        return Err("Encrypted backup but no decryption key available".into());
                    }
                } else {
                    content
                };
                
                tokio::fs::write(&file_path, &final_content).await?;
                
                restored_files.push(RestoredFile {
                    original_path: file.name().to_string(),
                    restore_path: file_path,
                    size: final_content.len() as u64,
                });
            }
            
            log::info!("Extracted {} files to restore directory", restored_files.len());
            Ok(restored_files)
        }
        
        async fn restore_database(
            &self,
            files: &[RestoredFile],
            restore_dir: &Path,
        ) -> Result<(), Box<dyn std::error::Error>> {
            log::info!("Restoring database...");
            
            let db_files: Vec<&RestoredFile> = files.iter()
                .filter(|f| f.original_path.starts_with("data/") && 
                          (f.original_path.ends_with(".db") || 
                           f.original_path.ends_with(".db-wal") || 
                           f.original_path.ends_with(".db-shm")))
                .collect();
            
            for db_file in db_files {
                let target_path = PathBuf::from(&db_file.original_path);
                if let Some(parent) = target_path.parent() {
                    tokio::fs::create_dir_all(parent).await?;
                }
                
                tokio::fs::copy(&db_file.restore_path, &target_path).await?;
                log::debug!("Restored database file: {:?}", target_path);
            }
            
            log::info!("Database restoration completed");
            Ok(())
        }
        
        async fn restore_images(
            &self,
            files: &[RestoredFile],
            restore_dir: &Path,
        ) -> Result<(), Box<dyn std::error::Error>> {
            if !self.config.include_images {
                return Ok(());
            }
            
            log::info!("Restoring images...");
            
            let image_files: Vec<&RestoredFile> = files.iter()
                .filter(|f| f.original_path.starts_with("images/"))
                .collect();
            
            for image_file in image_files {
                let target_path = PathBuf::from(&image_file.original_path);
                if let Some(parent) = target_path.parent() {
                    tokio::fs::create_dir_all(parent).await?;
                }
                
                tokio::fs::copy(&image_file.restore_path, &target_path).await?;
            }
            
            log::info!("Restored {} image files", image_files.len());
            Ok(())
        }
        
        async fn restore_plugins(
            &self,
            files: &[RestoredFile],
            restore_dir: &Path,
        ) -> Result<(), Box<dyn std::error::Error>> {
            if !self.config.include_plugins {
                return Ok(());
            }
            
            log::info!("Restoring plugins...");
            
            let plugin_files: Vec<&RestoredFile> = files.iter()
                .filter(|f| f.original_path.starts_with("plugins/"))
                .collect();
            
            for plugin_file in plugin_files {
                let target_path = PathBuf::from(&plugin_file.original_path);
                if let Some(parent) = target_path.parent() {
                    tokio::fs::create_dir_all(parent).await?;
                }
                
                tokio::fs::copy(&plugin_file.restore_path, &target_path).await?;
            }
            
            log::info!("Restored {} plugin files", plugin_files.len());
            Ok(())
        }
        
        async fn restore_configuration(
            &self,
            files: &[RestoredFile],
            restore_dir: &Path,
        ) -> Result<(), Box<dyn std::error::Error>> {
            log::info!("Restoring configuration...");
            
            let config_files: Vec<&RestoredFile> = files.iter()
                .filter(|f| f.original_path.starts_with("config/"))
                .collect();
            
            for config_file in config_files {
                let target_path = PathBuf::from(&config_file.original_path);
                if let Some(parent) = target_path.parent() {
                    tokio::fs::create_dir_all(parent).await?;
                }
                
                tokio::fs::copy(&config_file.restore_path, &target_path).await?;
            }
            
            log::info!("Restored {} configuration files", config_files.len());
            Ok(())
        }
        
        async fn cleanup_restore_directory(&self, restore_dir: &Path) -> Result<(), Box<dyn std::error::Error>> {
            tokio::fs::remove_dir_all(restore_dir).await?;
            log::info!("Cleaned up restore directory: {:?}", restore_dir);
            Ok(())
        }
        
        // Clean up old backups
        async fn cleanup_old_backups(&self) -> Result<(), Box<dyn std::error::Error>> {
            let mut backup_files: Vec<PathBuf> = Vec::new();
            
            for entry in fs::read_dir(&self.backup_dir)? {
                let entry = entry?;
                let path = entry.path();
                
                if path.is_file() && path.extension().map(|e| e == "zip").unwrap_or(false) {
                    if let Ok(metadata) = path.metadata() {
                        backup_files.push(path);
                    }
                }
            }
            
            // Sort by modification time (newest first)
            backup_files.sort_by(|a, b| {
                b.metadata().unwrap().modified().unwrap()
                    .cmp(&a.metadata().unwrap().modified().unwrap())
            });
            
            // Remove backups beyond the maximum count
            if backup_files.len() > self.config.max_backup_files as usize {
                for old_backup in backup_files.into_iter().skip(self.config.max_backup_files as usize) {
                    if let Err(e) = fs::remove_file(&old_backup) {
                        log::warn!("Failed to remove old backup {:?}: {}", old_backup, e);
                    } else {
                        log::info!("Removed old backup: {:?}", old_backup);
                    }
                }
            }
            
            Ok(())
        }
        
        // Encryption/decryption methods
        async fn encrypt_data(&self, data: &[u8], key: &[u8]) -> Result<Vec<u8>, Box<dyn std::error::Error>> {
            // In a real implementation, use proper encryption like AES-GCM
            // This is a simplified example
            let mut encrypted = Vec::with_capacity(data.len());
            for (i, &byte) in data.iter().enumerate() {
                encrypted.push(byte ^ key[i % key.len()]);
            }
            Ok(encrypted)
        }
        
        async fn decrypt_data(&self, data: &[u8], key: &[u8]) -> Result<Vec<u8>, Box<dyn std::error::Error>> {
            // Same as encryption for XOR
            self.encrypt_data(data, key).await
        }
        
        fn is_file_encrypted(&self, _data: &[u8]) -> bool {
            // In a real implementation, check for encryption markers
            self.encryption_key.is_some()
        }
        
        // Utility methods
        pub async fn list_backups(&self) -> Result<Vec<BackupInfo>, Box<dyn std::error::Error>> {
            let mut backups = Vec::new();
            
            for entry in fs::read_dir(&self.backup_dir)? {
                let entry = entry?;
                let path = entry.path();
                
                if path.is_file() && path.extension().map(|e| e == "zip").unwrap_or(false) {
                    if let Ok(metadata) = self.get_backup_info(&path).await {
                        backups.push(metadata);
                    }
                }
            }
            
            // Sort by creation time (newest first)
            backups.sort_by(|a, b| b.created_at.cmp(&a.created_at));
            
            Ok(backups)
        }
        
        async fn get_backup_info(&self, backup_path: &Path) -> Result<BackupInfo, Box<dyn std::error::Error>> {
            let file = File::open(backup_path)?;
            let mut zip = ZipArchive::new(file)?;
            
            let metadata = self.read_backup_metadata(&mut zip).await?;
            let file_metadata = backup_path.metadata()?;
            
            Ok(BackupInfo {
                path: backup_path.to_path_buf(),
                size: file_metadata.len(),
                created_at: metadata.created_at,
                file_count: metadata.file_count,
                total_size: metadata.total_size,
                application_version: metadata.application_version,
            })
        }
        
        pub async fn verify_backup(&self, backup_path: &str) -> Result<bool, Box<dyn std::error::Error>> {
            let backup_file = File::open(backup_path)?;
            let mut zip = ZipArchive::new(backup_file)?;
            
            match self.read_backup_metadata(&mut zip).await {
                Ok(metadata) => {
                    log::info!("Backup verification successful: {}", backup_path);
                    log::info!("Backup details: version {}, {} files, created {}", 
                              metadata.version, metadata.file_count, metadata.created_at);
                    Ok(true)
                }
                Err(e) => {
                    log::error!("Backup verification failed: {}", e);
                    Ok(false)
                }
            }
        }
        
        pub async fn get_disk_space_info(&self) -> Result<DiskSpaceInfo, Box<dyn std::error::Error>> {
            #[cfg(unix)]
            {
                use std::os::unix::fs::MetadataExt;
                
                let metadata = fs::metadata(&self.backup_dir)?;
                let statvfs = nix::sys::statvfs::statvfs(&self.backup_dir)?;
                
                let total_space = statvfs.blocks() * statvfs.block_size();
                let free_space = statvfs.blocks_available() * statvfs.block_size();
                let used_space = total_space - free_space;
                
                Ok(DiskSpaceInfo {
                    total_space,
                    used_space,
                    free_space,
                    usage_percentage: (used_space as f64 / total_space as f64) * 100.0,
                })
            }
            
            #[cfg(windows)]
            {
                // Windows implementation would go here
                Ok(DiskSpaceInfo::default())
            }
            
            #[cfg(not(any(unix, windows)))]
            {
                Ok(DiskSpaceInfo::default())
            }
        }
    }
    
    // Supporting structures
    #[derive(Debug, Clone)]
    struct BackupFileInfo {
        path: PathBuf,
        zip_path: String,
        size: u64,
        checksum: String,
        encrypted: bool,
    }
    
    #[derive(Debug)]
    struct RestoredFile {
        original_path: String,
        restore_path: PathBuf,
        size: u64,
    }
    
    #[derive(Debug, Serialize)]
    pub struct BackupInfo {
        path: PathBuf,
        size: u64,
        created_at: DateTime<Utc>,
        file_count: u32,
        total_size: u64,
        application_version: String,
    }
    
    #[derive(Debug, Serialize)]
    pub struct DiskSpaceInfo {
        total_space: u64,
        used_space: u64,
        free_space: u64,
        usage_percentage: f64,
    }
    
    impl Default for DiskSpaceInfo {
        fn default() -> Self {
            Self {
                total_space: 0,
                used_space: 0,
                free_space: 0,
                usage_percentage: 0.0,
            }
        }
    }
    
    // Export for use in main application
    pub use BackupManager;
    pub use BackupConfig;
    pub use BackupResult;