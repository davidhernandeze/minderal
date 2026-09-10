pub struct AppState {
  pub locked: bool,
}

impl AppState {
  pub fn new() -> Self {
    AppState {
      locked: false,
    }
  }
}
