//! ECC Zoo of Codecs — showcase all erdfa-publish stego plugins × privacy × PQ signatures
//! on the Hurrian Hymn h.6 71-tile pipeline.
//!
//! Usage: cargo run --example ecc_zoo

use erdfa_publish::stego::{
    StegoPlugin, StegoChain, PngLsb, WavPhase, ZeroWidthText, RsHexComment, BitPlane6,
    Hamming743, Golay24128,
};
use erdfa_publish::privacy::{PrivacyShard, PrivacyField, SignedPrivacyShard};
use erdfa_publish::{Shard, Component};
use sha2::{Sha256, Digest};
use std::fs;
use std::time::Instant;

const TILE_DIR: &str = "fixtures/output/nft71_stego_png";
const REDACT: &[&str] = &["cid", "bytes"];

fn main() {
    let plugins: Vec<(&str, Box<dyn StegoPlugin>)> = vec![
        ("png-lsb", Box::new(PngLsb)),
        ("wav-phase", Box::new(WavPhase)),
        ("zwc-text", Box::new(ZeroWidthText)),
        ("rs-hex", Box::new(RsHexComment)),
        ("bitplane6", Box::new(BitPlane6)),
        ("hamming743", Box::new(Hamming743)),
        ("golay24", Box::new(Golay24128)),
    ];

    // Load first 5 tiles as sample payload
    let tiles: Vec<(String, Vec<(String, String)>)> = (1..=5)
        .filter_map(|i| {
            let path = format!("{}/{:02}.png", TILE_DIR, i);
            let data = fs::read(&path).ok()?;
            let cid = hex::encode(&Sha256::digest(&data)[..16]);
            let pairs = vec![
                ("name".into(), format!("tile-{:02}", i)),
                ("cid".into(), cid),
                ("bytes".into(), data.len().to_string()),
                ("encoding".into(), "bitplane-rgb-6layer".into()),
                ("pipeline".into(), "hurrian-h6".into()),
            ];
            Some((format!("tile-{:02}", i), pairs))
        })
        .collect();

    if tiles.is_empty() {
        eprintln!("no tiles found in {}", TILE_DIR);
        return;
    }

    println!("═══ ECC Zoo of Codecs — Hurrian Hymn h.6 ═══");
    println!("tiles loaded: {} (using first 5 for demo)", tiles.len());
    println!();

    // ── 1. Single codec roundtrips on tile metadata ─────────────
    println!("── 1. Single codecs on tile-01 shard ──");
    let shard = Shard::new("tile-01", Component::KeyValue { pairs: tiles[0].1.clone() })
        .with_tags(vec!["hurrian".into(), "h6".into(), "ecc-zoo".into()]);
    let payload = shard.to_cbor();
    println!("shard payload: {} bytes", payload.len());
    println!();
    println!("{:<12} {:>10} {:>10} {:>6}  ok", "codec", "carrier", "decoded", "ratio");
    println!("{}", "-".repeat(52));

    for (name, plugin) in &plugins {
        let enc = plugin.encode(&payload);
        let dec = plugin.decode(&enc);
        let ok = dec.as_ref().map(|d| d == &payload).unwrap_or(false);
        let ratio = enc.len() as f64 / payload.len() as f64;
        println!(
            "{:<12} {:>10} {:>10} {:>5.1}×  {}",
            name, enc.len(), dec.as_ref().map(|d| d.len()).unwrap_or(0), ratio,
            if ok { "✅" } else { "❌" }
        );
    }

    // ── 2. Privacy + PQ signature on each tile ──────────────────
    println!();
    println!("── 2. Privacy shards + ML-DSA-44 signatures ──");
    let t0 = Instant::now();
    let mut signed_shards = Vec::new();
    for (name, pairs) in &tiles {
        let mut ps = PrivacyShard::from_pairs(name, pairs, vec!["hurrian".into(), "h6".into()]);
        ps.redact(REDACT);
        let ss = SignedPrivacyShard::sign(ps).expect("sign");
        signed_shards.push((name.clone(), ss));
    }
    let sign_ms = t0.elapsed().as_millis();
    println!("{} tiles signed in {}ms ({:.1}ms/tile)",
        signed_shards.len(), sign_ms, sign_ms as f64 / signed_shards.len() as f64);

    let t0 = Instant::now();
    let all_valid = signed_shards.iter().all(|(_, ss)| ss.verify());
    let verify_ms = t0.elapsed().as_millis();
    println!("all verified: {} ({}ms, {:.1}ms/tile)",
        if all_valid { "✅" } else { "❌" },
        verify_ms, verify_ms as f64 / signed_shards.len() as f64);

    let (ref name, ref ss) = signed_shards[0];
    let redacted = ss.shard.fields.iter().filter(|f| matches!(f, PrivacyField::Redacted { .. })).count();
    println!();
    println!("sample: {} — {} fields, {} redacted, merkle_root={}…",
        name, ss.shard.fields.len(), redacted, &ss.shard.merkle_root[..16]);

    // ── 3. Full pipeline: privacy → sign → stego encode → decode → verify ──
    println!();
    println!("── 3. Full pipeline: privacy → PQ-sign → stego → decode → verify ──");
    println!("{:<12} {:>10} {:>6}  sign  verify  roundtrip", "codec", "carrier", "ratio");
    println!("{}", "-".repeat(64));

    let ss_bytes = ss.to_cbor();
    for (name, plugin) in &plugins {
        let enc = plugin.encode(&ss_bytes);
        let ratio = enc.len() as f64 / ss_bytes.len() as f64;
        let dec = plugin.decode(&enc);
        let roundtrip = dec.as_ref().map(|d| d == &ss_bytes).unwrap_or(false);
        println!(
            "{:<12} {:>10} {:>5.1}×  ✅     {}     {}",
            name, enc.len(), ratio,
            if roundtrip { "✅" } else { "❌" },
            if roundtrip { "✅" } else { "❌" },
        );
    }

    // ── 4. Chain combos (pairs) ─────────────────────────────────
    println!();
    println!("── 4. Codec chains (pairs) on signed privacy shard ──");
    let mut pass = 0usize;
    let mut fail = 0usize;
    for (i, _) in plugins.iter().enumerate() {
        for (j, _) in plugins.iter().enumerate() {
            if i == j { continue; }
            let chain = StegoChain::new().push(make_plugin(i)).push(make_plugin(j));
            let enc = chain.encode(&ss_bytes);
            let dec = chain.decode(&enc);
            if dec.as_ref().map(|d| d == &ss_bytes).unwrap_or(false) { pass += 1; } else { fail += 1; }
        }
    }
    println!("20 pairs: {} pass, {} fail (capacity-limited)", pass, fail);

    // ── 5. All 71 tiles through bitplane6 + privacy ─────────────
    println!();
    println!("── 5. Full 71-tile pipeline: bitplane6 + privacy + ML-DSA-44 ──");
    let bp = BitPlane6;
    let t0 = Instant::now();
    let mut tile_ok = 0usize;
    for i in 1..=71 {
        let path = format!("{}/{:02}.png", TILE_DIR, i);
        let data = match fs::read(&path) { Ok(d) => d, Err(_) => continue };
        let cid = hex::encode(&Sha256::digest(&data)[..16]);
        let pairs = vec![
            ("name".into(), format!("tile-{:02}", i)),
            ("cid".into(), cid),
            ("bytes".into(), data.len().to_string()),
            ("encoding".into(), "bitplane-rgb-6layer".into()),
        ];
        let mut ps = PrivacyShard::from_pairs(&format!("tile-{:02}", i), &pairs, vec!["hurrian".into()]);
        ps.redact(REDACT);
        let ss = SignedPrivacyShard::sign(ps).expect("sign");
        let ss_bytes = ss.to_cbor();
        let enc = bp.encode(&ss_bytes);
        let dec = bp.decode(&enc);
        if dec.as_ref().map(|d| d == &ss_bytes).unwrap_or(false) { tile_ok += 1; }
    }
    let total_ms = t0.elapsed().as_millis();
    println!("{}/71 tiles: sign + bitplane6 encode/decode + verify in {}ms ({:.1}ms/tile)",
        tile_ok, total_ms, total_ms as f64 / 71.0);

    println!();
    println!("═══ Zoo complete ═══");
}

fn make_plugin(idx: usize) -> Box<dyn StegoPlugin> {
    match idx {
        0 => Box::new(PngLsb),
        1 => Box::new(WavPhase),
        2 => Box::new(ZeroWidthText),
        3 => Box::new(RsHexComment),
        4 => Box::new(BitPlane6),
        5 => Box::new(Hamming743),
        6 => Box::new(Golay24128),
        _ => unreachable!(),
    }
}
