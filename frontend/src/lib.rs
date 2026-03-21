use wasm_bindgen::prelude::*;

// This is the entry point that will be called when the WASM module is loaded.
#[wasm_bindgen(start)]
pub fn main() -> Result<(), JsValue> {
    // Use `web-sys` to access the browser's console (optional)
    web_sys::console::log_1(&"Hello from Rust!".into());
    Ok(())
}
