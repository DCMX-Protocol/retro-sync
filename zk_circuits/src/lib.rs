//! ZK circuit library — Groth16 proofs over BN254.
pub mod royalty_split;
pub use royalty_split::{RoyaltySplitCircuit, RoyaltySplitWitness, generate_proof, verify};
