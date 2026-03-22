//! nft71_ppm_stego — Multi-layer steganographic embedding in PPM tiles
//!
//! 6 bit-plane layers per 64×64 PPM image:
//!   Layer 0: R bit 0 (LSB) — DA51 CBOR shard data
//!   Layer 1: G bit 0 (LSB) — witness chain
//!   Layer 2: B bit 0 (LSB) — eigenspace
//!   Layer 3: R bit 1        — source text
//!   Layer 4: G bit 1        — notation/intervals
//!   Layer 5: B bit 1        — cuneiform UTF-8
//!
//! Capacity: 64×64 = 4096 pixels → 512 bytes/layer → 3072 bytes total
//! Pattern: erdfa-namespace HME Bitmap LSB (hostile media embedding)
//!
//! Usage: cargo run -p fixtures --example nft71_ppm_stego

use sha2::{Digest, Sha256};
use std::path::Path;

const W: usize = 64;
const H: usize = 64;
const PIXELS: usize = W * H;          // 4096
const BYTES_PER_LAYER: usize = PIXELS / 8; // 512

/// PPM P6 image: header + W*H*3 raw bytes
struct Ppm {
    data: Vec<u8>, // RGB pixel bytes only (no header)
}

impl Ppm {
    fn read(path: &Path) -> Self {
        let raw = std::fs::read(path).unwrap();
        // Skip PPM P6 header (find double newline after "P6\n64 64\n255\n")
        let mut pos = 0;
        let mut newlines = 0;
        for (i, &b) in raw.iter().enumerate() {
            if b == b'\n' { newlines += 1; }
            if newlines == 3 { pos = i + 1; break; }
        }
        Ppm { data: raw[pos..].to_vec() }
    }

    fn write(&self, path: &Path) {
        let header = format!("P6\n{W} {H}\n255\n");
        let mut out = header.into_bytes();
        out.extend_from_slice(&self.data);
        std::fs::write(path, out).unwrap();
    }

    /// Embed data into a specific bit plane.
    /// channel: 0=R, 1=G, 2=B
    /// bit: 0=LSB, 1=second bit
    fn embed(&mut self, data: &[u8], channel: usize, bit: u8) {
        let mask = !(1u8 << bit);
        for (i, &byte) in data.iter().enumerate() {
            if i >= BYTES_PER_LAYER { break; }
            for b in 0..8 {
                let px = i * 8 + b;
                if px >= PIXELS { break; }
                let idx = px * 3 + channel;
                let val = (byte >> b) & 1;
                self.data[idx] = (self.data[idx] & mask) | (val << bit);
            }
        }
    }

    /// Extract data from a specific bit plane.
    fn extract(&self, channel: usize, bit: u8, length: usize) -> Vec<u8> {
        (0..length.min(BYTES_PER_LAYER))
            .map(|i| {
                (0..8u8)
                    .map(|b| {
                        let px = i * 8 + b as usize;
                        if px >= PIXELS { return 0; }
                        let idx = px * 3 + channel;
                        ((self.data[idx] >> bit) & 1) << b
                    })
                    .sum()
            })
            .collect()
    }
}

/// Truncate or pad data to fit layer capacity
fn fit(data: &[u8]) -> Vec<u8> {
    let mut v = data[..data.len().min(BYTES_PER_LAYER)].to_vec();
    v.resize(BYTES_PER_LAYER, 0);
    v
}

fn main() {
    let ppm_dir = Path::new("fixtures/output/nft71_ppm");
    let out_dir = Path::new("fixtures/output/nft71_stego_ppm");
    std::fs::create_dir_all(out_dir).unwrap();

    // Load layer source data
    let source = std::fs::read_to_string("fixtures/data/hurrian_h6.txt").unwrap_or_default();
    let ly = std::fs::read_to_string("fixtures/lilypond/h6_west.ly").unwrap_or_default();
    let witness_dir = Path::new("fixtures/output/witnesses");

    // Cuneiform signs (UTF-8 encoded)
    let cuneiform = "𒀸𒌑𒄴𒊑 𒄿𒊭𒅈𒌈 𒂊𒁍𒁍 𒉌𒀉𒃻 𒃻𒇷𒌈 𒆠𒁴𒈬 𒁉𒌈 𒊺𒊒 𒊭𒅖𒊭𒌈 𒊑𒁍𒌈 𒅖𒄣 𒋾𒌅𒅈𒃻 𒋾𒌅𒅈𒄿 𒊺𒅈𒁺 𒀀𒈬𒊏𒁉";

    // Notation lines
    let notation = "qáb-li-te 3 ir-bu-te 1 qáb-li-te 3 ša-aḫ-ri 1 i-šar-te 10 ušta-ma-a-ri\n\
                    ti-ti-mi-šar-te 2 zi-ir-te 1 ša-aḫ-ri 2 ša-aš-ša-te 2 ir-bu-te 2";

    // Witness chain
    let witnesses: Vec<u8> = (0..5)
        .flat_map(|i| {
            let names = ["00_source", "01_midi", "01_pdf", "02_wav", "99_commitment"];
            let p = witness_dir.join(format!("{}.witness.json", names[i]));
            std::fs::read_to_string(p).unwrap_or_default().into_bytes()
        })
        .collect();

    // Eigenspace (from hurrian_h6 module)
    let eigen = fixtures::hurrian_h6::embed_h6();
    let eigen_json = format!(
        "{{\"earth\":{:.1},\"spoke\":{:.1},\"hub\":{:.1},\"triplets\":{}}}",
        eigen.earth_pct, eigen.spoke_pct, eigen.hub_pct, eigen.triplet_count
    );

    // Load CBOR shards for layer 0
    let cbor_dir = Path::new("fixtures/output/nft71");

    println!("=== Multi-Layer PPM Steganography ===");
    println!("Image: {W}×{H} PPM | Capacity: {BYTES_PER_LAYER} bytes/layer × 6 layers = {} bytes/tile", BYTES_PER_LAYER * 6);
    println!();

    let mut total_embedded = 0usize;
    let mut verified = 0u32;

    for idx in 1..=71u64 {
        let padded = format!("{:02}", idx);
        let ppm_path = ppm_dir.join(format!("{padded}.ppm"));
        if !ppm_path.exists() { continue; }

        let mut ppm = Ppm::read(&ppm_path);

        // Prepare 6 layers of data for this shard
        let cbor_path = cbor_dir.join(format!("{padded}.cbor"));
        let cbor_data = std::fs::read(&cbor_path).unwrap_or_default();

        // Stripe source data by shard index (each shard gets a different 512-byte window)
        let i = (idx - 1) as usize;
        let src_bytes = source.as_bytes();
        let src_offset = (i * BYTES_PER_LAYER) % src_bytes.len().max(1);
        let src_chunk: Vec<u8> = src_bytes.iter().cycle().skip(src_offset).take(BYTES_PER_LAYER).copied().collect();

        let nota_bytes = notation.as_bytes();
        let nota_offset = (i * BYTES_PER_LAYER) % nota_bytes.len().max(1);
        let nota_chunk: Vec<u8> = nota_bytes.iter().cycle().skip(nota_offset).take(BYTES_PER_LAYER).copied().collect();

        let cunei_bytes = cuneiform.as_bytes();
        let cunei_offset = (i * BYTES_PER_LAYER) % cunei_bytes.len().max(1);
        let cunei_chunk: Vec<u8> = cunei_bytes.iter().cycle().skip(cunei_offset).take(BYTES_PER_LAYER).copied().collect();

        let wit_offset = (i * BYTES_PER_LAYER) % witnesses.len().max(1);
        let wit_chunk: Vec<u8> = witnesses.iter().cycle().skip(wit_offset).take(BYTES_PER_LAYER).copied().collect();

        let eigen_bytes = eigen_json.as_bytes();
        let eigen_chunk: Vec<u8> = eigen_bytes.iter().cycle().take(BYTES_PER_LAYER).copied().collect();

        // Embed 6 layers
        ppm.embed(&fit(&cbor_data),   0, 0); // R bit 0: CBOR shard
        ppm.embed(&fit(&wit_chunk),   1, 0); // G bit 0: witness
        ppm.embed(&fit(&eigen_chunk), 2, 0); // B bit 0: eigenspace
        ppm.embed(&fit(&src_chunk),   0, 1); // R bit 1: source text
        ppm.embed(&fit(&nota_chunk),  1, 1); // G bit 1: notation
        ppm.embed(&fit(&cunei_chunk), 2, 1); // B bit 1: cuneiform

        // Write stego'd PPM
        let out_path = out_dir.join(format!("{padded}.ppm"));
        ppm.write(&out_path);

        // Verify round-trip: re-read and extract all 6 layers
        let verify = Ppm::read(&out_path);
        let mut ok = true;
        let layers: [(&[u8], usize, u8, &str); 6] = [
            (&fit(&cbor_data),   0, 0, "cbor"),
            (&fit(&wit_chunk),   1, 0, "witness"),
            (&fit(&eigen_chunk), 2, 0, "eigen"),
            (&fit(&src_chunk),   0, 1, "source"),
            (&fit(&nota_chunk),  1, 1, "notation"),
            (&fit(&cunei_chunk), 2, 1, "cuneiform"),
        ];
        for (expected, ch, bit, name) in &layers {
            let extracted = verify.extract(*ch, *bit, BYTES_PER_LAYER);
            if &extracted != expected {
                eprintln!("  ✗ shard {padded} layer {name} MISMATCH");
                ok = false;
            }
        }

        if ok { verified += 1; }
        total_embedded += BYTES_PER_LAYER * 6;

        let marker = if fixtures::hurrian_h6::SSP.contains(&idx) { "★" } else { "·" };
        let hash = hex::encode(&Sha256::digest(&ppm.data)[..4]);
        println!("{marker} {padded} — 6 layers × {BYTES_PER_LAYER}B = {}B embedded  [ppm:{hash}] {}",
            BYTES_PER_LAYER * 6, if ok { "✓" } else { "✗" });
    }

    // Generate mosaic of stego'd tiles
    println!();
    println!("=== Summary ===");
    println!("tiles:    {verified}/71 verified");
    println!("embedded: {} bytes ({:.1} KB/tile, {:.1} KB total)",
        total_embedded, (BYTES_PER_LAYER * 6) as f64 / 1024.0, total_embedded as f64 / 1024.0);
    println!("layers:   6 (R0:cbor G0:witness B0:eigen R1:source G1:notation B1:cuneiform)");
    println!("capacity: {BYTES_PER_LAYER} bytes/layer, {} bytes/tile", BYTES_PER_LAYER * 6);
    println!("\n→ {verified} stego PPMs written to {}", out_dir.display());
}
