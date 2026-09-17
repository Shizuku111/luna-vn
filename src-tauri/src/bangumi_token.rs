use keyring::{Entry, Error as KeyringError};

const SERVICE: &str = "luna-vn";
const ACCOUNT: &str = "bangumi-access-token";

fn entry() -> Result<Entry, String> {
    Entry::new(SERVICE, ACCOUNT).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn get_bangumi_token() -> Result<Option<String>, String> {
    match entry()?.get_password() {
        Ok(token) => Ok(Some(token)),
        Err(KeyringError::NoEntry) => Ok(None),
        Err(err) => Err(err.to_string()),
    }
}

#[tauri::command]
pub fn set_bangumi_token(token: String) -> Result<(), String> {
    entry()?
        .set_password(&token)
        .map_err(|err| err.to_string())
}

#[tauri::command]
pub fn delete_bangumi_token() -> Result<(), String> {
    match entry()?.delete_credential() {
        Ok(()) => Ok(()),
        Err(KeyringError::NoEntry) => Ok(()),
        Err(err) => Err(err.to_string()),
    }
}
