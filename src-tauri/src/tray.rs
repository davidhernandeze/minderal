use tauri::{App, AppHandle, Manager, WebviewWindow, Window};
use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;

pub fn attach_tray(app: &App) {
  let show_i = MenuItem::with_id(app, "show", "Show", true, None::<&str>).unwrap();
  let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>).unwrap();
  let menu = Menu::with_items(app, &[&show_i, &quit_i]).unwrap();

  TrayIconBuilder::new()
    .menu(&menu)
    .icon(app.default_window_icon().unwrap().clone())
    .on_menu_event(|app: &AppHandle, event| match event.id.as_ref() {
      "quit" => {
        app.exit(0);
      }
      "show" => {
        let window = app.app_handle().get_webview_window("main").unwrap();
        window.show().unwrap();
        window.set_focus().unwrap();
      }
      _ => {
        println!("menu item {:?} not handled", event.id);
      }
    })
    .icon(app.default_window_icon().unwrap().clone())
    .build(app).unwrap() ;
}
