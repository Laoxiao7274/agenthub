use std::fs::{self, File, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::process::Command;
use std::sync::Mutex;

use chrono::Local;
use log::{Level, LevelFilter, Metadata, Record};

/// Log file path: ~/AppData/Roaming/agenthub/logs/agenthub.log
fn log_dir() -> PathBuf {
    let base = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
    base.join("agenthub").join("logs")
}

fn log_file_path() -> PathBuf {
    log_dir().join("agenthub.log")
}

/// Custom logger that writes to a rotating file
struct FileLogger {
    file: Mutex<File>,
}

impl FileLogger {
    fn init() -> Result<Self, String> {
        let dir = log_dir();
        fs::create_dir_all(&dir).map_err(|e| format!("Create log dir failed: {}", e))?;
        let path = log_file_path();
        // Rotate: if file > 5MB, rename to .log.old
        if path.exists() {
            if let Ok(meta) = fs::metadata(&path) {
                if meta.len() > 5 * 1024 * 1024 {
                    let old = log_dir().join("agenthub.log.old");
                    let _ = fs::rename(&path, old);
                }
            }
        }
        let file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&path)
            .map_err(|e| format!("Open log file failed: {}", e))?;
        Ok(Self { file: Mutex::new(file) })
    }
}

impl log::Log for FileLogger {
    fn enabled(&self, metadata: &Metadata) -> bool {
        metadata.level() <= Level::Info
    }

    fn log(&self, record: &Record) {
        if !self.enabled(record.metadata()) {
            return;
        }
        let ts = Local::now().format("%Y-%m-%d %H:%M:%S%.3f");
        let line = format!("[{}] {:5} {} | {}\n", ts, record.level(), record.target(), record.args());
        if let Ok(mut f) = self.file.lock() {
            let _ = f.write_all(line.as_bytes());
        }
    }

    fn flush(&self) {
        if let Ok(mut f) = self.file.lock() {
            let _ = f.flush();
        }
    }
}

/// Initialize the file logger. Call once at app startup.
pub fn init() {
    match FileLogger::init() {
        Ok(logger) => {
            let _ = log::set_boxed_logger(Box::new(logger));
            log::set_max_level(LevelFilter::Info);
            log::info!("Logger initialized — log file: {}", log_file_path().display());
        }
        Err(e) => {
            eprintln!("Logger init failed: {}", e);
        }
    }
}

/// Read recent log lines from the log file
#[tauri::command]
pub fn get_logs(lines: Option<usize>) -> Result<String, String> {
    let path = log_file_path();
    if !path.exists() {
        return Ok(String::new());
    }
    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Read log file failed: {}", e))?;
    let n = lines.unwrap_or(500);
    let all: Vec<&str> = content.lines().collect();
    let start = if all.len() > n { all.len() - n } else { 0 };
    Ok(all[start..].join("\n"))
}

/// Clear the log file
#[tauri::command]
pub fn clear_logs() -> Result<String, String> {
    let path = log_file_path();
    if path.exists() {
        File::create(&path).map_err(|e| format!("Clear log file failed: {}", e))?;
    }
    Ok("cleared".into())
}

/// Receive a log entry from the frontend
#[tauri::command]
pub fn frontend_log(level: String, message: String) -> Result<(), String> {
    match level.as_str() {
        "error" => log::error!("[frontend] {}", message),
        "warn" => log::warn!("[frontend] {}", message),
        "info" => log::info!("[frontend] {}", message),
        _ => log::debug!("[frontend] {}", message),
    }
    Ok(())
}

/// Open the log directory in file explorer
#[tauri::command]
pub fn open_log_dir() -> Result<String, String> {
    let dir = log_dir();
    fs::create_dir_all(&dir).map_err(|e| format!("Create log dir failed: {}", e))?;
    Command::new("explorer.exe")
        .arg(&dir)
        .spawn()
        .map_err(|e| format!("Open log dir failed: {}", e))?;
    Ok("opened".into())
}
