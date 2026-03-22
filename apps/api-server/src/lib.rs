// Library crate entry point — re-exports every integration module so that
// integration tests under tests/ can reference them as `backend::<module>`.
#![allow(dead_code)]

pub mod bbs;
pub mod bwarm;
pub mod cmrra;
pub mod coinbase;
pub mod collection_societies;
pub mod dqi;
pub mod durp;
pub mod hyperglot;
pub mod isni;
pub mod langsec;
pub mod music_reports;
pub mod tron;
