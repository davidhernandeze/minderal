use std::sync::Mutex;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Manager, WebviewWindow};

struct AppState {
    mindbar_locked: bool,
}

impl AppState {
    fn new() -> Self {
        AppState {
            mindbar_locked: false,
        }
    }
}

#[tauri::command]
fn hide_mindbar(webview_window: WebviewWindow) {
    webview_window.hide().unwrap();
}

#[tauri::command]
fn lock_mindbar(webview_window: WebviewWindow) {
    let app_handle = webview_window.app_handle();
    let state = app_handle.state::<Mutex<AppState>>();
    let mut state = state.lock().unwrap();
    state.mindbar_locked = true;
}

#[tauri::command]
fn unlock_mindbar(webview_window: WebviewWindow) {
    let app_handle = webview_window.app_handle();
    let state = app_handle.state::<Mutex<AppState>>();
    let mut state = state.lock().unwrap();
    state.mindbar_locked = false;
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .invoke_handler(tauri::generate_handler![
            hide_mindbar,
            lock_mindbar,
            unlock_mindbar
        ])
        .setup(|app| {
            use tauri_plugin_global_shortcut::{
                Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState,
            };

            app.manage(Mutex::new(AppState::new()));

            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            let mindbar_window = app.handle().get_webview_window("mindbar").unwrap();
            mindbar_window.hide().unwrap();
            let mindbar_window_clone = mindbar_window.clone();

            mindbar_window.on_window_event(move |event| {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    mindbar_window_clone.hide().unwrap();
                    api.prevent_close();
                }
                if let tauri::WindowEvent::Focused(focused) = event {
                    if *focused {
                        return;
                    }
                    let app_handle = mindbar_window_clone.app_handle();
                    let state = app_handle.state::<Mutex<AppState>>();
                    let state = state.lock().unwrap();

                    if state.mindbar_locked {
                        mindbar_window_clone.show().unwrap();
                        return;
                    }

                    mindbar_window_clone.hide().unwrap();
                    app_handle
                        .get_webview_window("main")
                        .unwrap()
                        .hide()
                        .unwrap();
                }
            });

            let ctrl_n_shortcut = Shortcut::new(Some(Modifiers::CONTROL), Code::Space);
            app.handle().plugin(
                tauri_plugin_global_shortcut::Builder::new()
                    .with_handler(move |_app, shortcut, event| {
                        let mindbar_window = _app.get_webview_window("mindbar").unwrap();
                        if shortcut == &ctrl_n_shortcut {
                            match event.state() {
                                ShortcutState::Released => {
                                    mindbar_window.show().unwrap();
                                    mindbar_window.set_focus().unwrap();
                                }
                                _ => {}
                            }
                        }
                    })
                    .build(),
            )?;

            app.global_shortcut().register(ctrl_n_shortcut)?;

            let show_i = MenuItem::with_id(app, "show", "Show", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &quit_i])?;

            TrayIconBuilder::new()
                .menu(&menu)
                .icon(app.default_window_icon().unwrap().clone())
                .on_menu_event(|app: &AppHandle, event| match event.id.as_ref() {
                    "quit" => {
                        app.exit(0);
                    }
                    "show" => {
                        let window = app.get_webview_window("main").unwrap();
                        window.show().unwrap();
                        window.set_focus().unwrap();
                    }
                    _ => {
                        println!("menu item {:?} not handled", event.id);
                    }
                })
                .icon(app.default_window_icon().unwrap().clone())
                .build(app)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                window.hide().unwrap();
                api.prevent_close();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
