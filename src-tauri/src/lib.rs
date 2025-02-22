#![cfg_attr(
  all(not(debug_assertions), target_os = "windows"),
  windows_subsystem = "windows"
)]

use std::sync::Mutex;
use tauri::{Listener, Manager};
use tauri_nspanel::ManagerExt;
use tauri_plugin_global_shortcut::{Code, Modifiers, Shortcut, ShortcutState};
use window::WebviewWindowExt;
use crate::state::AppState;
use crate::tray::attach_tray;

mod commands;
mod window;
mod tray;
mod state;

pub const SPOTLIGHT_LABEL: &str = "mindbar";

pub fn run() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![commands::show, commands::hide])
    .plugin(tauri_nspanel::init())
    .plugin(tauri_plugin_clipboard_manager::init())
    .setup(move |app| {
      // Set activation poicy to Accessory to prevent the app icon from showing on the dock
      app.set_activation_policy(tauri::ActivationPolicy::Accessory);

      app.manage(Mutex::new(AppState::new()));

      let handle = app.app_handle();

      let window = handle.get_webview_window(SPOTLIGHT_LABEL).unwrap();

      let panel = window.to_spotlight_panel()?;

      handle.listen(format!("{}_panel_did_resign_key", SPOTLIGHT_LABEL), move |_| {
        // Hide the panel when it's no longer the key window
        // This ensures the panel doesn't remain visible when it's not actively being used
        panel.order_out(None);
      });

      attach_tray(&app);

      Ok(())
    })
    // Register a global shortcut (⌘+K) to toggle the visibility of the spotlight panel
    .plugin(
      tauri_plugin_global_shortcut::Builder::new()
        .with_shortcut(Shortcut::new(Some(Modifiers::CONTROL), Code::Space))
        .unwrap()
        .with_handler(|app, shortcut, event| {
          if event.state == ShortcutState::Pressed
            && shortcut.matches(Modifiers::CONTROL, Code::Space)
          {
            let window = app.get_webview_window(SPOTLIGHT_LABEL).unwrap();

            let panel = app.get_webview_panel(SPOTLIGHT_LABEL).unwrap();

            if panel.is_visible() {
              panel.order_out(None);
            } else {
              window.center_at_cursor_monitor().unwrap();

              panel.show();
              window.set_focus().unwrap();
            }
          }
        })
        .build(),
    )
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
