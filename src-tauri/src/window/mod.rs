pub mod docking;
pub mod lifecycle;
pub mod state;

pub use docking::*;
pub use lifecycle::*;
pub use state::*;

// ─── Centralized Trace Window Constants ──────────────────────

pub const TRACE_WINDOW_LABEL: &str = "trace";
pub const TRACE_DOCKING_DEFAULT_WIDTH: f64 = 600.0;
pub const TRACE_DOCKING_MIN_WIDTH: f64 = 740.0;
pub const TRACE_DOCKING_MAX_WIDTH: f64 = 850.0;
pub const TRACE_DOCKING_RESIZE_SYNC_MS: u64 = 160;
pub const DOCKING_DRAG_EXIT_THRESHOLD_MS: i64 = 150;
pub const MAIN_TITLE_BAR_HEIGHT: i32 = 42;
pub const MAIN_TRACE_GAP: i32 = 10;
pub const TRACE_WINDOW_WIDTH: f64 = 600.0;
pub const TRACE_WINDOW_MIN_WIDTH: f64 = 580.0;
pub const TRACE_WINDOW_MIN_HEIGHT: f64 = 400.0;
