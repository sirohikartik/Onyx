use base64::prelude::*;
use chrono::Local;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

#[derive(Debug, Serialize, Deserialize)]
pub struct AppConfig {
    pub vault_path: String,
    pub git_remote: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileNode {
    pub name: String,
    pub path: String, // Relative to vault root
    pub is_dir: bool,
    pub children: Option<Vec<FileNode>>,
    pub extension: Option<String>,
    pub size: u64,
    pub modified: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitStatusInfo {
    pub is_repo: bool,
    pub branch: String,
    pub remote: String,
    pub modified_count: usize,
    pub untracked_count: usize,
    pub staged_count: usize,
    pub ahead_count: usize,
    pub behind_count: usize,
    pub last_commit_message: String,
    pub last_commit_time: String,
    pub details: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitCommitItem {
    pub hash: String,
    pub author: String,
    pub date: String,
    pub message: String,
}

fn get_config_dir() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
    PathBuf::from(home).join(".config").join("onyx")
}

fn get_config_file() -> PathBuf {
    get_config_dir().join("config.json")
}

fn get_default_vault_path() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
    PathBuf::from(home).join("notes-vault")
}

fn load_config() -> AppConfig {
    let cfg_path = get_config_file();
    if cfg_path.exists() {
        if let Ok(data) = fs::read_to_string(&cfg_path) {
            if let Ok(cfg) = serde_json::from_str::<AppConfig>(&data) {
                return cfg;
            }
        }
    }

    let default_vault = get_default_vault_path();
    AppConfig {
        vault_path: default_vault.to_string_lossy().to_string(),
        git_remote: Some("git@github-personal:sirohikartik/notes-vault.git".to_string()),
    }
}

fn save_config_internal(cfg: &AppConfig) -> Result<(), String> {
    let cfg_dir = get_config_dir();
    fs::create_dir_all(&cfg_dir).map_err(|e| e.to_string())?;
    let data = serde_json::to_string_pretty(cfg).map_err(|e| e.to_string())?;
    fs::write(get_config_file(), data).map_err(|e| e.to_string())?;
    Ok(())
}

fn resolve_vault_path(custom: Option<String>) -> PathBuf {
    match custom {
        Some(p) if !p.trim().is_empty() => PathBuf::from(p),
        _ => PathBuf::from(load_config().vault_path),
    }
}

fn safe_entry_path(vault: &Path, rel_path: &str) -> Result<PathBuf, String> {
    let clean_rel = rel_path.trim_start_matches('/');
    let target = vault.join(clean_rel);
    // Ensure inside vault
    let canonical_vault = match vault.canonicalize() {
        Ok(c) => c,
        Err(_) => vault.to_path_buf(),
    };

    // For files that might not exist yet, check parent
    let check_target = if target.exists() {
        target.canonicalize().map_err(|e| e.to_string())?
    } else {
        if let Some(parent) = target.parent() {
            if parent.exists() {
                let parent_canon = parent.canonicalize().map_err(|e| e.to_string())?;
                if !parent_canon.starts_with(&canonical_vault) {
                    return Err("Target path is outside the vault".to_string());
                }
            }
        }
        target.clone()
    };

    if target.exists() && !check_target.starts_with(&canonical_vault) {
        return Err("Target path is outside the vault".to_string());
    }

    Ok(target)
}

// ─── Tauri Commands ──────────────────────────────────────────────────────────

#[tauri::command]
fn get_vault_path() -> Result<String, String> {
    let cfg = load_config();
    let path = PathBuf::from(&cfg.vault_path);
    if !path.exists() {
        let _ = fs::create_dir_all(&path);
    }
    Ok(cfg.vault_path)
}

#[tauri::command]
fn set_vault_path(new_path: String) -> Result<String, String> {
    let p = PathBuf::from(&new_path);
    if !p.exists() {
        fs::create_dir_all(&p).map_err(|e| format!("Failed to create directory: {}", e))?;
    }
    let mut cfg = load_config();
    cfg.vault_path = new_path.clone();
    save_config_internal(&cfg)?;
    Ok(new_path)
}

fn build_tree_recursive(dir: &Path, base: &Path) -> Result<Vec<FileNode>, String> {
    let mut entries = Vec::new();
    let read_dir = match fs::read_dir(dir) {
        Ok(r) => r,
        Err(e) => return Err(e.to_string()),
    };

    for item in read_dir.flatten() {
        let file_name = item.file_name().to_string_lossy().to_string();
        // Ignore dotfiles / hidden files except attachments if needed
        if file_name.starts_with('.') {
            continue;
        }

        let path = item.path();
        let rel_path = path
            .strip_prefix(base)
            .unwrap_or(&path)
            .to_string_lossy()
            .to_string();

        let metadata = match item.metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };

        let is_dir = metadata.is_dir();
        let size = metadata.len();
        let modified = metadata
            .modified()
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_secs())
            .unwrap_or(0);

        let extension = if is_dir {
            None
        } else {
            path.extension().map(|e| e.to_string_lossy().to_string().to_lowercase())
        };

        let children = if is_dir {
            Some(build_tree_recursive(&path, base)?)
        } else {
            None
        };

        entries.push(FileNode {
            name: file_name,
            path: rel_path,
            is_dir,
            children,
            extension,
            size,
            modified,
        });
    }

    // Sort: directories first, then alphabetical by name
    entries.sort_by(|a, b| {
        match (a.is_dir, b.is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        }
    });

    Ok(entries)
}

#[tauri::command]
fn get_file_tree(vault_path: Option<String>) -> Result<Vec<FileNode>, String> {
    let vault = resolve_vault_path(vault_path);
    if !vault.exists() {
        fs::create_dir_all(&vault).map_err(|e| e.to_string())?;
    }
    build_tree_recursive(&vault, &vault)
}

#[tauri::command]
fn read_file(relative_path: String, vault_path: Option<String>) -> Result<String, String> {
    let vault = resolve_vault_path(vault_path);
    let full_path = safe_entry_path(&vault, &relative_path)?;
    fs::read_to_string(&full_path).map_err(|e| format!("Could not read file {}: {}", relative_path, e))
}

#[tauri::command]
fn write_file(relative_path: String, content: String, vault_path: Option<String>) -> Result<(), String> {
    let vault = resolve_vault_path(vault_path);
    let full_path = safe_entry_path(&vault, &relative_path)?;
    if let Some(parent) = full_path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
    }
    fs::write(&full_path, content).map_err(|e| format!("Could not write file: {}", e))?;
    Ok(())
}

#[tauri::command]
fn create_file(relative_path: String, vault_path: Option<String>) -> Result<String, String> {
    let vault = resolve_vault_path(vault_path);
    let mut clean = relative_path.trim().to_string();
    if !clean.ends_with(".md") && !clean.contains('.') {
        clean.push_str(".md");
    }
    let full_path = safe_entry_path(&vault, &clean)?;
    if let Some(parent) = full_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    if !full_path.exists() {
        let base_name = full_path.file_stem().unwrap_or_default().to_string_lossy();
        let initial_content = format!("# {}\n\n", base_name);
        fs::write(&full_path, initial_content).map_err(|e| e.to_string())?;
    }
    Ok(clean)
}

#[tauri::command]
fn create_folder(relative_path: String, vault_path: Option<String>) -> Result<(), String> {
    let vault = resolve_vault_path(vault_path);
    let full_path = safe_entry_path(&vault, &relative_path)?;
    fs::create_dir_all(&full_path).map_err(|e| format!("Could not create folder: {}", e))?;
    Ok(())
}

#[tauri::command]
fn rename_entry(old_path: String, new_path: String, vault_path: Option<String>) -> Result<(), String> {
    let vault = resolve_vault_path(vault_path);
    let full_old = safe_entry_path(&vault, &old_path)?;
    let full_new = safe_entry_path(&vault, &new_path)?;
    if let Some(parent) = full_new.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::rename(&full_old, &full_new).map_err(|e| format!("Could not rename: {}", e))?;
    Ok(())
}

#[tauri::command]
fn delete_entry(relative_path: String, vault_path: Option<String>) -> Result<(), String> {
    let vault = resolve_vault_path(vault_path);
    let full_path = safe_entry_path(&vault, &relative_path)?;
    if full_path.is_dir() {
        fs::remove_dir_all(&full_path).map_err(|e| format!("Could not delete folder: {}", e))?;
    } else if full_path.is_file() {
        fs::remove_file(&full_path).map_err(|e| format!("Could not delete file: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
fn save_pasted_image(
    image_base64: String,
    filename_hint: Option<String>,
    vault_path: Option<String>,
) -> Result<String, String> {
    let vault = resolve_vault_path(vault_path);
    let attachments_dir = vault.join("attachments");
    fs::create_dir_all(&attachments_dir).map_err(|e| e.to_string())?;

    // Clean base64 prefix if present
    let raw_b64 = if let Some(idx) = image_base64.find(";base64,") {
        &image_base64[idx + 8..]
    } else {
        &image_base64
    };

    let bytes = BASE64_STANDARD
        .decode(raw_b64.trim())
        .map_err(|e| format!("Base64 decode error: {}", e))?;

    let now_str = Local::now().format("%Y%m%d_%H%M%S").to_string();
    let ext = if raw_b64.starts_with("/9j/") {
        "jpg"
    } else if raw_b64.starts_with("R0lGOD") {
        "gif"
    } else if raw_b64.starts_with("UklGR") {
        "webp"
    } else {
        "png"
    };

    let filename = match filename_hint {
        Some(hint) if !hint.trim().is_empty() => {
            let mut h = hint.trim().to_string();
            if !h.contains('.') {
                h.push_str(&format!(".{}", ext));
            }
            h
        }
        _ => format!("Pasted image {}.{}", now_str, ext),
    };

    let target_file = attachments_dir.join(&filename);
    fs::write(&target_file, bytes).map_err(|e| format!("Failed to save image: {}", e))?;

    Ok(format!("attachments/{}", filename))
}

#[tauri::command]
fn read_image_base64(relative_path: String, vault_path: Option<String>) -> Result<String, String> {
    let vault = resolve_vault_path(vault_path);
    let full_path = safe_entry_path(&vault, &relative_path)?;
    if !full_path.exists() {
        return Err(format!("Image not found: {}", relative_path));
    }
    let bytes = fs::read(&full_path).map_err(|e| e.to_string())?;
    let ext = full_path
        .extension()
        .map(|e| e.to_string_lossy().to_string().to_lowercase())
        .unwrap_or_else(|| "png".to_string());

    let mime = match ext.as_str() {
        "jpg" | "jpeg" => "image/jpeg",
        "png" => "image/png",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        _ => "application/octet-stream",
    };

    let encoded = BASE64_STANDARD.encode(&bytes);
    Ok(format!("data:{};base64,{}", mime, encoded))
}

// ─── Git Operations ──────────────────────────────────────────────────────────

#[tauri::command]
fn git_status(vault_path: Option<String>) -> Result<GitStatusInfo, String> {
    let vault = resolve_vault_path(vault_path);
    let git_dir = vault.join(".git");
    if !git_dir.exists() {
        return Ok(GitStatusInfo {
            is_repo: false,
            branch: "".to_string(),
            remote: "".to_string(),
            modified_count: 0,
            untracked_count: 0,
            staged_count: 0,
            ahead_count: 0,
            behind_count: 0,
            last_commit_message: "No git repository".to_string(),
            last_commit_time: "".to_string(),
            details: vec![],
        });
    }

    // Branch
    let branch_out = Command::new("git")
        .args(["rev-parse", "--abbrev-ref", "HEAD"])
        .current_dir(&vault)
        .output()
        .map_err(|e| e.to_string())?;
    let branch = String::from_utf8_lossy(&branch_out.stdout).trim().to_string();

    // Remote
    let remote_out = Command::new("git")
        .args(["remote", "get-url", "origin"])
        .current_dir(&vault)
        .output();
    let remote = match remote_out {
        Ok(out) if out.status.success() => {
            String::from_utf8_lossy(&out.stdout).trim().to_string()
        }
        _ => "".to_string(),
    };

    // Status porcelain
    let status_out = Command::new("git")
        .args(["status", "--porcelain"])
        .current_dir(&vault)
        .output()
        .map_err(|e| e.to_string())?;
    let status_text = String::from_utf8_lossy(&status_out.stdout);

    let mut modified_count = 0;
    let mut untracked_count = 0;
    let mut staged_count = 0;
    let mut details = Vec::new();

    for line in status_text.lines() {
        if line.len() >= 2 {
            details.push(line.to_string());
            let x = line.chars().next().unwrap_or(' ');
            let y = line.chars().nth(1).unwrap_or(' ');
            if x == '?' && y == '?' {
                untracked_count += 1;
            } else {
                if x != ' ' && x != '?' {
                    staged_count += 1;
                }
                if y != ' ' {
                    modified_count += 1;
                }
            }
        }
    }

    // Ahead / Behind
    let ahead_behind_out = Command::new("git")
        .args(["rev-list", "--left-right", "--count", "origin/HEAD...HEAD"])
        .current_dir(&vault)
        .output();

    let (behind_count, ahead_count) = match ahead_behind_out {
        Ok(out) if out.status.success() => {
            let out_str = String::from_utf8_lossy(&out.stdout);
            let parts: Vec<&str> = out_str.trim().split_whitespace().collect();
            if parts.len() == 2 {
                (
                    parts[0].parse::<usize>().unwrap_or(0),
                    parts[1].parse::<usize>().unwrap_or(0),
                )
            } else {
                (0, 0)
            }
        }
        _ => (0, 0),
    };

    // Last commit
    let log_out = Command::new("git")
        .args(["log", "-1", "--pretty=format:%s|%cr"])
        .current_dir(&vault)
        .output();
    let (last_commit_message, last_commit_time) = match log_out {
        Ok(out) if out.status.success() => {
            let log_str = String::from_utf8_lossy(&out.stdout);
            let parts: Vec<&str> = log_str.split('|').collect();
            if parts.len() == 2 {
                (parts[0].to_string(), parts[1].to_string())
            } else {
                (log_str.to_string(), "".to_string())
            }
        }
        _ => ("No commits yet".to_string(), "".to_string()),
    };

    Ok(GitStatusInfo {
        is_repo: true,
        branch,
        remote,
        modified_count,
        untracked_count,
        staged_count,
        ahead_count,
        behind_count,
        last_commit_message,
        last_commit_time,
        details,
    })
}

#[tauri::command]
fn git_init_and_setup(repo_url: String, vault_path: Option<String>) -> Result<String, String> {
    let vault = resolve_vault_path(vault_path);
    if !vault.exists() {
        fs::create_dir_all(&vault).map_err(|e| e.to_string())?;
    }

    // 1. git init
    let init_res = Command::new("git")
        .args(["init", "-b", "main"])
        .current_dir(&vault)
        .output()
        .map_err(|e| format!("git init failed: {}", e))?;
    if !init_res.status.success() {
        // Fallback for older git without -b
        let _ = Command::new("git")
            .args(["init"])
            .current_dir(&vault)
            .output();
        let _ = Command::new("git")
            .args(["branch", "-M", "main"])
            .current_dir(&vault)
            .output();
    }

    // 2. Set remote
    let _ = Command::new("git")
        .args(["remote", "remove", "origin"])
        .current_dir(&vault)
        .output();

    let remote_res = Command::new("git")
        .args(["remote", "add", "origin", &repo_url])
        .current_dir(&vault)
        .output()
        .map_err(|e| format!("git remote add failed: {}", e))?;
    if !remote_res.status.success() {
        return Err(String::from_utf8_lossy(&remote_res.stderr).to_string());
    }

    // 3. Save remote to config
    let mut cfg = load_config();
    cfg.git_remote = Some(repo_url.clone());
    let _ = save_config_internal(&cfg);

    Ok(format!("Repository initialized and linked to {}", repo_url))
}

#[tauri::command]
fn git_sync(message: Option<String>, vault_path: Option<String>) -> Result<String, String> {
    let vault = resolve_vault_path(vault_path);
    let git_dir = vault.join(".git");
    if !git_dir.exists() {
        return Err("Vault is not a Git repository. Initialize Git first.".to_string());
    }

    // 1. git add -A
    let add_res = Command::new("git")
        .args(["add", "-A"])
        .current_dir(&vault)
        .output()
        .map_err(|e| format!("git add failed: {}", e))?;
    if !add_res.status.success() {
        return Err(String::from_utf8_lossy(&add_res.stderr).to_string());
    }

    // 2. Check if anything to commit
    let status_out = Command::new("git")
        .args(["status", "--porcelain"])
        .current_dir(&vault)
        .output()
        .map_err(|e| e.to_string())?;
    let status_text = String::from_utf8_lossy(&status_out.stdout);

    let mut committed = false;
    if !status_text.trim().is_empty() {
        let commit_msg = match message {
            Some(m) if !m.trim().is_empty() => m.trim().to_string(),
            _ => format!("Vault sync: {}", Local::now().format("%Y-%m-%d %H:%M:%S")),
        };

        let commit_res = Command::new("git")
            .args(["commit", "-m", &commit_msg])
            .current_dir(&vault)
            .output()
            .map_err(|e| format!("git commit failed: {}", e))?;
        if !commit_res.status.success() {
            let err_msg = String::from_utf8_lossy(&commit_res.stderr).to_string();
            if !err_msg.contains("nothing to commit") {
                return Err(err_msg);
            }
        } else {
            committed = true;
        }
    }

    // 3. Pull with rebase
    let _pull_res = Command::new("git")
        .args(["pull", "--rebase", "origin", "main"])
        .current_dir(&vault)
        .output();

    // 4. Push to origin main
    let push_res = Command::new("git")
        .args(["push", "-u", "origin", "main"])
        .current_dir(&vault)
        .output()
        .map_err(|e| format!("git push failed: {}", e))?;

    if !push_res.status.success() {
        let err_str = String::from_utf8_lossy(&push_res.stderr).to_string();
        // Try push without -u or standard push
        let push_retry = Command::new("git")
            .args(["push", "origin", "HEAD"])
            .current_dir(&vault)
            .output();
        if let Ok(retry) = push_retry {
            if !retry.status.success() {
                return Err(format!("git push error: {}", err_str));
            }
        } else {
            return Err(format!("git push error: {}", err_str));
        }
    }

    let summary = if committed {
        "Committed changes and pushed to GitHub successfully!".to_string()
    } else {
        "Vault is up-to-date with GitHub!".to_string()
    };

    Ok(summary)
}

#[tauri::command]
fn git_log_history(limit: Option<usize>, vault_path: Option<String>) -> Result<Vec<GitCommitItem>, String> {
    let vault = resolve_vault_path(vault_path);
    let n = limit.unwrap_or(20);
    let log_res = Command::new("git")
        .args([
            "log",
            &format!("-{}", n),
            "--pretty=format:%h|%an|%cr|%s",
        ])
        .current_dir(&vault)
        .output()
        .map_err(|e| e.to_string())?;

    if !log_res.status.success() {
        return Ok(vec![]);
    }

    let log_str = String::from_utf8_lossy(&log_res.stdout);
    let mut items = Vec::new();
    for line in log_str.lines() {
        let parts: Vec<&str> = line.split('|').collect();
        if parts.len() >= 4 {
            items.push(GitCommitItem {
                hash: parts[0].to_string(),
                author: parts[1].to_string(),
                date: parts[2].to_string(),
                message: parts[3..].join("|"),
            });
        }
    }

    Ok(items)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_vault_path,
            set_vault_path,
            get_file_tree,
            read_file,
            write_file,
            create_file,
            create_folder,
            rename_entry,
            delete_entry,
            save_pasted_image,
            read_image_base64,
            git_status,
            git_init_and_setup,
            git_sync,
            git_log_history
        ])
        .run(tauri::generate_context!())
        .expect("error while running onyx application");
}
