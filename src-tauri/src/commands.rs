// use std::sync::Mutex;

use std::sync::Mutex;
use tauri::{AppHandle, State, WebviewWindow};
use tauri_nspanel::ManagerExt;

use crate::SPOTLIGHT_LABEL;
use crate::state::AppState;


#[tauri::command]
fn lock_mindbar(state: State<'_, Mutex<AppState>>) {
  let mut state = state.lock().unwrap();
  state.locked = true
}

#[tauri::command]
fn unlock_mindbar(state: State<'_, Mutex<AppState>>) {
  let mut state = state.lock().unwrap();
  state.locked = false
}

#[tauri::command]
pub fn show(app_handle: AppHandle) {
  let panel = app_handle.get_webview_panel(SPOTLIGHT_LABEL).unwrap();

  panel.show();
}

#[tauri::command]
pub fn hide(app_handle: AppHandle) {
  let state = app_handle.state::<Mutex<AppState>>();
  let mut state = state.lock().unwrap();

  if  { state.mindbar_locked } {
    return;
  }

  let panel = app_handle.get_webview_panel(SPOTLIGHT_LABEL).unwrap();

  if panel.is_visible() {
    panel.order_out(None);
  }
}
