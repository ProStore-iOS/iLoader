// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use isideload::{developer_session::DeveloperSession, AnisetteConfiguration, AppleAccount};
use keyring::Entry;
use once_cell::sync::OnceCell;
use serde_json::Value;
use std::{
    sync::{mpsc::RecvTimeoutError, Arc, Mutex},
    time::Duration,
};
use tauri::{AppHandle, Emitter, Listener, Manager, Window};
use tauri_plugin_store::StoreExt;

pub static APPLE_ACCOUNT: OnceCell<Mutex<Option<Arc<AppleAccount>>>> = OnceCell::new();

#[tauri::command]
async fn login_email_pass(
    handle: AppHandle,
    window: Window,
    email: String,
    password: String,
    anisette_server: String,
    save_credentials: bool,
) -> Result<String, String> {
    let cell = APPLE_ACCOUNT.get_or_init(|| Mutex::new(None));
    let account = login(&handle, &window, email, password.clone(), anisette_server).await?;
    let mut account_guard = cell.lock().unwrap();
    *account_guard = Some(account.clone());

    if save_credentials {
        println!("Saving credentials to keyring: '{}'", &account.apple_id);
        let pass_entry = Entry::new("iloader", &account.apple_id)
            .map_err(|e| format!("Failed to create keyring entry for credentials: {:?}.", e))?;
        pass_entry
            .set_password(&password)
            .map_err(|e| format!("Failed to save credentials to keyring: {:?}", e))?;
        let store = handle
            .store("data.json")
            .map_err(|e| format!("Failed to get store: {:?}", e))?;
        let mut existing_ids = store
            .get("ids")
            .unwrap_or_else(|| Value::Array(vec![]))
            .as_array()
            .cloned()
            .unwrap_or_else(|| vec![]);
        let value = Value::String(account.apple_id.clone());
        if !existing_ids.contains(&value) {
            existing_ids.push(value);
        }
        store.set("ids", Value::Array(existing_ids));
    }
    return Ok(account.apple_id.clone());
}

#[tauri::command]
async fn login_stored_pass(
    handle: AppHandle,
    window: Window,
    email: String,
    anisette_server: String,
) -> Result<String, String> {
    let cell = APPLE_ACCOUNT.get_or_init(|| Mutex::new(None));
    println!("Accessing credentials from keyring: '{}'", &email);
    let pass_entry = Entry::new("iloader", &email)
        .map_err(|e| format!("Failed to create keyring entry for credentials: {:?}.", e))?;
    let password = pass_entry
        .get_password()
        .map_err(|e| format!("Failed to get credentials: {:?}", e))?;
    let account = login(&handle, &window, email, password, anisette_server).await?;
    let mut account_guard = cell.lock().unwrap();
    *account_guard = Some(account.clone());

    return Ok(account.apple_id.clone());
}

#[tauri::command]
fn list_stored_ids(handle: AppHandle) -> Result<Vec<String>, String> {
    let store = handle
        .store("data.json")
        .map_err(|e| format!("Failed to get store: {:?}", e))?;
    let existing_ids = store
        .get("ids")
        .unwrap_or_else(|| Value::Array(vec![]))
        .as_array()
        .cloned()
        .unwrap_or_else(|| vec![]);
    let ids: Vec<String> = existing_ids
        .into_iter()
        .filter_map(|v| v.as_str().map(|s| s.to_string()))
        .collect();
    Ok(ids)
}

#[tauri::command]
fn delete_account(handle: AppHandle, email: String) -> Result<(), String> {
    let pass_entry = Entry::new("iloader", &email)
        .map_err(|e| format!("Failed to create keyring entry for credentials: {:?}.", e))?;
    pass_entry
        .delete_credential()
        .map_err(|e| format!("Failed to delete credentials: {:?}", e))?;
    let store = handle
        .store("data.json")
        .map_err(|e| format!("Failed to get store: {:?}", e))?;
    let mut existing_ids = store
        .get("ids")
        .unwrap_or_else(|| Value::Array(vec![]))
        .as_array()
        .cloned()
        .unwrap_or_else(|| vec![]);
    existing_ids.retain(|v| v.as_str().map_or(true, |s| s != email));
    store.set("ids", Value::Array(existing_ids));
    Ok(())
}

#[tauri::command]
fn logged_in_as() -> Option<String> {
    let account = get_account();
    if let Ok(account) = account {
        return Some(account.apple_id.clone());
    }
    None
}

#[tauri::command]
fn invalidate_account() {
    let cell = APPLE_ACCOUNT.get();
    if let Some(account) = cell {
        let mut account_guard = account.lock().unwrap();
        *account_guard = None;
    }
}

pub fn get_account() -> Result<Arc<AppleAccount>, String> {
    let cell = APPLE_ACCOUNT.get_or_init(|| Mutex::new(None));
    {
        let account_guard = cell.lock().unwrap();
        if let Some(account) = &*account_guard {
            return Ok(account.clone());
        }
    }

    return Err("Not logged in".to_string());
}

pub async fn get_developer_session() -> Result<DeveloperSession, String> {
    let account = get_account()?;

    let mut dev_session = DeveloperSession::new(account);

    let teams = match dev_session.list_teams().await {
        Ok(t) => t,
        Err(e) => {
            // This code means we have been logged in for too long and we must relogin again
            let is_22411 = match &e {
                isideload::Error::Auth(code, _) => *code == -22411,
                isideload::Error::DeveloperSession(code, _) => *code == -22411,
                _ => false,
            };
            if is_22411 {
                invalidate_account();
                return Err(format!("Session timed out, please try again: {:?}", e));
            } else {
                return Err(format!("Failed to list teams: {:?}", e));
            }
        }
    };

    dev_session.set_team(teams[0].clone());

    Ok(dev_session)
}

pub async fn login(
    handle: &AppHandle,
    window: &Window,
    email: String,
    password: String,
    anisette_server: String,
) -> Result<Arc<AppleAccount>, String> {
    let (tx, rx) = std::sync::mpsc::channel::<String>();
    let window_clone = window.clone();
    let tfa_closure = move || -> Result<String, String> {
        window_clone
            .emit("2fa-required", ())
            .expect("Failed to emit 2fa-required event");

        let tx = tx.clone();
        let handler_id = window_clone.listen("2fa-recieved", move |event| {
            let code = event.payload();
            let _ = tx.send(code.to_string());
        });

        let result = rx.recv_timeout(Duration::from_secs(120));
        window_clone.unlisten(handler_id);

        match result {
            Ok(code) => {
                let code = code.trim_matches('"').to_string();
                Ok(code)
            }
            Err(RecvTimeoutError::Timeout) => Err("2FA cancelled or timed out".to_string()),
            Err(RecvTimeoutError::Disconnected) => Err("2FA disconnected".to_string()),
        }
    };

    let config = AnisetteConfiguration::default();
    let config =
        config.set_configuration_path(handle.path().app_config_dir().map_err(|e| e.to_string())?);
    let config = config.set_anisette_url(format!("https://{}", anisette_server));
    window
        .emit("build-output", "Logging in...")
        .map_err(|e| e.to_string())?;

    let account = AppleAccount::login(
        || Ok((email.clone(), password.clone())),
        tfa_closure,
        config,
    )
    .await;
    if let Err(e) = account {
        window
            .emit("build-output", "Login failed or cancelled".to_string())
            .ok();
        window.emit("build-output", format!("{:?}", e)).ok();
        return Err(format!("{:?}", e));
    }
    let account = Arc::new(account.unwrap());
    window
        .emit("build-output", "Successfully logged in".to_string())
        .map_err(|e| e.to_string())?;

    Ok(account)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .setup(|app| {
            app.store("data.json")?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            login_email_pass,
            invalidate_account,
            logged_in_as,
            login_stored_pass,
            list_stored_ids,
            delete_account
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
