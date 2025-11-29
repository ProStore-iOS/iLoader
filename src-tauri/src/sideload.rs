use std::path::PathBuf;

use crate::{
    account::get_developer_session,
    device::{get_provider, DeviceInfoMutex},
    operation::Operation,
    pairing::{get_sidestore_info, place_pairing},
};
use isideload::{sideload::sideload_app, SideloadConfiguration};
use tauri::{AppHandle, Manager, State, Window};

pub async fn sideload(
    handle: AppHandle,
    device_state: State<'_, DeviceInfoMutex>,
    app_path: String,
) -> Result<(), String> {
    let device = {
        let device_lock = device_state.lock().unwrap();
        match &*device_lock {
            Some(d) => d.clone(),
            None => return Err("No device selected".to_string()),
        }
    };

    let provider = get_provider(&device).await?;

    let config = SideloadConfiguration::default()
        .set_machine_name("iloader".to_string())
        .set_store_dir(
            handle
                .path()
                .app_data_dir()
                .map_err(|e| format!("Failed to get app data dir: {:?}", e))?,
        );

    let dev_session = get_developer_session().await.map_err(|e| e.to_string())?;

    sideload_app(&provider, &dev_session, app_path.into(), config)
        .await
        .map_err(|e| {
            match e {
                isideload::Error::Certificate(s) if s == "You have too many certificates!" => {
                    "You have too many certificates. Revoke one by clicking \"Manage Certificates\" and \"Revoke\".".to_string()
                }
                _ => e.to_string(),
            }
        })?;

    Ok(())
}

#[tauri::command]
pub async fn sideload_operation(
    handle: AppHandle,
    window: Window,
    device_state: State<'_, DeviceInfoMutex>,
    app_path: String,
) -> Result<(), String> {
    let op = Operation::new("sideload".to_string(), &window);
    op.start("install")?;
    op.fail_if_err("install", sideload(handle, device_state, app_path).await)?;
    op.complete("install")?;
    Ok(())
}

#[tauri::command]
pub async fn install_sidestore_operation(
    handle: AppHandle,
    window: Window,
    device_state: State<'_, DeviceInfoMutex>,
    nightly: bool,
    live_container: bool,
) -> Result<(), String> {
    let op = Operation::new("install_sidestore".to_string(), &window);
    op.start("download")?;
    // TODO: Cache & check version to avoid re-downloading
    let (filename, url) = if live_container {
        if nightly {
            ("LiveContainerSideStore-Nightly.ipa", "https://github.com/LiveContainer/LiveContainer/releases/download/nightly/LiveContainer+SideStore.ipa")
        } else {
            ("LiveContainerSideStore.ipa", "https://github.com/LiveContainer/LiveContainer/releases/latest/download/LiveContainer+SideStore.ipa")
        }
    } else if nightly {
        (
            "SideStore-Nightly.ipa",
            "https://github.com/SideStore/SideStore/releases/download/nightly/SideStore.ipa",
        )
    } else {
        (
            "SideStore.ipa",
            "https://github.com/SideStore/SideStore/releases/latest/download/SideStore.ipa",
        )
    };

    let dest = handle
        .path()
        .temp_dir()
        .map_err(|e| format!("Failed to get temp dir: {:?}", e))?
        .join(filename);
    op.fail_if_err("download", download(url, &dest).await)?;
    op.move_on("download", "install")?;
    let device = {
        let device_guard = device_state.lock().unwrap();
        match &*device_guard {
            Some(d) => d.clone(),
            None => return op.fail("install", "No device selected".to_string()),
        }
    };
    op.fail_if_err(
        "install",
        sideload(handle, device_state, dest.to_string_lossy().to_string()).await,
    )?;
    op.move_on("install", "pairing")?;
    let sidestore_info = op.fail_if_err(
        "pairing",
        get_sidestore_info(device.clone(), live_container).await,
    )?;
    if let Some(info) = sidestore_info {
        op.fail_if_err(
            "pairing",
            place_pairing(device, info.bundle_id, info.path).await,
        )?;
    } else {
        return op.fail(
            "pairing",
            "Could not find SideStore's bundle ID".to_string(),
        );
    }

    op.complete("pairing")?;
    Ok(())
}

pub async fn download(url: impl AsRef<str>, dest: &PathBuf) -> Result<(), String> {
    let response = reqwest::get(url.as_ref())
        .await
        .map_err(|e| e.to_string())?;
    if !response.status().is_success() {
        return Err(format!(
            "Failed to download file: HTTP {}",
            response.status()
        ));
    }

    let bytes = response.bytes().await.map_err(|e| e.to_string())?;
    tokio::fs::write(dest, &bytes)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}
