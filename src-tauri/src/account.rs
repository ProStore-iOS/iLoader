use isideload::{
    developer_session::{DeveloperDeviceType, DeveloperSession, ListAppIdsResponse},
    AnisetteConfiguration, AppleAccount,
};
use keyring::Entry;
use once_cell::sync::OnceCell;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    sync::{mpsc::RecvTimeoutError, Arc, Mutex},
    time::Duration,
};
use tauri::{AppHandle, Emitter, Listener, Manager, Window};
use tauri_plugin_store::StoreExt;

pub static APPLE_ACCOUNT: OnceCell<Mutex<Option<Arc<AppleAccount>>>> = OnceCell::new();

#[tauri::command]
pub async fn login_email_pass(
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
pub async fn login_stored_pass(
    handle: AppHandle,
    window: Window,
    email: String,
    anisette_server: String,
) -> Result<String, String> {
    let cell = APPLE_ACCOUNT.get_or_init(|| Mutex::new(None));
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
pub fn delete_account(handle: AppHandle, email: String) -> Result<(), String> {
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
pub fn logged_in_as() -> Option<String> {
    let account = get_account();
    if let Ok(account) = account {
        return Some(account.apple_id.clone());
    }
    None
}

#[tauri::command]
pub fn invalidate_account() {
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

async fn login(
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
    let config = config.set_anisette_url_v3(format!("https://{}", anisette_server));

    let account = AppleAccount::login(
        || Ok((email.clone(), password.clone())),
        tfa_closure,
        config,
    )
    .await;
    if let Err(e) = account {
        return Err(e.to_string());
    }
    let account = Arc::new(account.unwrap());

    Ok(account)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CertificateInfo {
    pub name: String,
    pub certificate_id: String,
    pub serial_number: String,
    pub machine_name: String,
}

#[tauri::command]
pub async fn get_certificates() -> Result<Vec<CertificateInfo>, String> {
    let dev_session = get_developer_session().await?;
    let team = dev_session
        .get_team()
        .await
        .map_err(|e| format!("Failed to get developer team: {:?}", e))?;
    let certificates = dev_session
        .list_all_development_certs(DeveloperDeviceType::Ios, &team)
        .await
        .map_err(|e| format!("Failed to get development certificates: {:?}", e))?;
    Ok(certificates
        .into_iter()
        .map(|cert| CertificateInfo {
            name: cert.name,
            certificate_id: cert.certificate_id,
            serial_number: cert.serial_number,
            machine_name: cert.machine_name,
        })
        .collect())
}

#[tauri::command]
pub async fn revoke_certificate(serial_number: String) -> Result<(), String> {
    let dev_session = get_developer_session().await?;
    let team = dev_session
        .get_team()
        .await
        .map_err(|e| format!("Failed to get developer team: {:?}", e))?;
    dev_session
        .revoke_development_cert(DeveloperDeviceType::Ios, &team, &serial_number)
        .await
        .map_err(|e| format!("Failed to revoke development certificates: {:?}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn list_app_ids() -> Result<ListAppIdsResponse, String> {
    let dev_session = get_developer_session().await?;
    let team = dev_session
        .get_team()
        .await
        .map_err(|e| format!("Failed to get developer team: {:?}", e))?;
    let app_ids = dev_session
        .list_app_ids(DeveloperDeviceType::Ios, &team)
        .await
        .map_err(|e| format!("Failed to list App IDs: {:?}", e))?;
    Ok(app_ids)
}

#[tauri::command]
pub async fn delete_app_id(app_id_id: String) -> Result<(), String> {
    let dev_session = get_developer_session().await?;
    let team = dev_session
        .get_team()
        .await
        .map_err(|e| format!("Failed to get developer team: {:?}", e))?;
    dev_session
        .delete_app_id(DeveloperDeviceType::Ios, &team, app_id_id)
        .await
        .map_err(|e| format!("Failed to delete App ID: {:?}", e))?;
    Ok(())
}
