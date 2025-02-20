use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Manager};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }


      let mindbar_window = tauri::WebviewWindowBuilder::new(app, "mindbar", tauri::WebviewUrl::App("index.html".into()))
        .title("Mindbar")
        .build()?;
      mindbar_window.hide().unwrap();
      let mindbar_window_clone = mindbar_window.clone();

      mindbar_window.on_window_event(move |event| {
        if let tauri::WindowEvent::CloseRequested { api, .. } = event {
          mindbar_window_clone.hide().unwrap();
          api.prevent_close();
        }
        if let tauri::WindowEvent::Focused(focused) = event {
          if !focused {
            mindbar_window_clone.hide().unwrap();
            println!("Mindbar unfocused");
          }
        }
      });

      let ctrl_n_shortcut = Shortcut::new(Some(Modifiers::CONTROL), Code::Space);
      app.handle().plugin(
        tauri_plugin_global_shortcut::Builder::new().with_handler(move |_app, shortcut, event| {
          println!("{:?}", shortcut);
          let mindbar_window = _app.get_webview_window("mindbar").unwrap();
          if shortcut == &ctrl_n_shortcut {
            match event.state() {
              ShortcutState::Released => {
                println!("Ctrl-N Released!");
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
