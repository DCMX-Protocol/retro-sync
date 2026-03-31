//! Encode the full retro-sync pipeline as a DA51 dataset.
//!
//! Pipeline graph (per source):
//!   cuneiform → [witness] youtube_wav → [aubio] notes → [notes_to_ly] lilypond → [lilypond] midi → [fluidsynth] wav
//!
//! Each node is a DA51 shard. Edges are encoded via "input_cid" references.
//! Output: fixtures/output/retro-sync.tar

use sha2::{Sha256, Digest};
use std::io::Write;
use std::fs;
use std::path::Path;

const DA51_TAG: u64 = 55889;

// ── CBOR primitives ─────────────────────────────────────────────

fn cbor_uint(major: u8, val: u64, out: &mut Vec<u8>) {
    let m = major << 5;
    match val {
        0..=23 => out.push(m | val as u8),
        24..=0xff => { out.push(m | 24); out.push(val as u8); }
        256..=0xffff => { out.push(m | 25); out.extend(&(val as u16).to_be_bytes()); }
        0x10000..=0xffffffff => { out.push(m | 26); out.extend(&(val as u32).to_be_bytes()); }
        _ => { out.push(m | 27); out.extend(&val.to_be_bytes()); }
    }
}
fn cbor_str(s: &str, o: &mut Vec<u8>) { cbor_uint(3, s.len() as u64, o); o.extend(s.as_bytes()); }
fn cbor_tag(t: u64, o: &mut Vec<u8>) { cbor_uint(6, t, o); }
fn cbor_map(n: usize, o: &mut Vec<u8>) { cbor_uint(5, n as u64, o); }
fn cbor_arr(n: usize, o: &mut Vec<u8>) { cbor_uint(4, n as u64, o); }

fn content_cid(data: &[u8]) -> String {
    format!("bafk{}", &hex::encode(Sha256::digest(data))[..32])
}

fn file_cid(path: &Path) -> String {
    if let Ok(data) = fs::read(path) { content_cid(&data) } else { "missing".into() }
}

fn file_size(path: &Path) -> String {
    fs::metadata(path).map(|m| m.len().to_string()).unwrap_or("0".into())
}

fn encode_shard(id: &str, pairs: &[(&str, &str)], tags: &[&str]) -> Vec<u8> {
    let json = serde_json::json!({"type":"KeyValue","pairs":pairs});
    let cid = content_cid(&serde_json::to_vec(&json).unwrap());
    let mut b = Vec::new();
    cbor_tag(DA51_TAG, &mut b);
    cbor_map(4, &mut b);
    cbor_str("id", &mut b); cbor_str(id, &mut b);
    cbor_str("cid", &mut b); cbor_str(&cid, &mut b);
    cbor_str("component", &mut b);
    cbor_map(2, &mut b);
    cbor_str("type", &mut b); cbor_str("KeyValue", &mut b);
    cbor_str("pairs", &mut b);
    cbor_arr(pairs.len(), &mut b);
    for (k, v) in pairs { cbor_arr(2, &mut b); cbor_str(k, &mut b); cbor_str(v, &mut b); }
    cbor_str("tags", &mut b);
    cbor_arr(tags.len(), &mut b);
    for t in tags { cbor_str(t, &mut b); }
    b
}

fn tar_entry<W: Write>(w: &mut W, name: &str, data: &[u8]) -> std::io::Result<()> {
    let mut hdr = [0u8; 512];
    let n = name.as_bytes();
    hdr[..n.len().min(100)].copy_from_slice(&n[..n.len().min(100)]);
    hdr[100..107].copy_from_slice(b"0000644");
    let sz = format!("{:011o}", data.len());
    hdr[124..135].copy_from_slice(sz.as_bytes());
    hdr[156] = b'0';
    hdr[257..263].copy_from_slice(b"ustar\0");
    hdr[148..156].copy_from_slice(b"        ");
    let cksum: u32 = hdr.iter().map(|&b| b as u32).sum();
    hdr[148..156].copy_from_slice(format!("{:06o}\0 ", cksum).as_bytes());
    w.write_all(&hdr)?;
    w.write_all(data)?;
    let pad = (512 - data.len() % 512) % 512;
    w.write_all(&vec![0u8; pad])?;
    Ok(())
}

fn is_prime(n: usize) -> bool {
    n >= 2 && (2..=(n as f64).sqrt() as usize).all(|d| n % d != 0)
}

const INTERVALS: &[&str] = &[
    "qablītum","nīd qablim","isartum","šaššatum",
    "irbūtum","nīš GABA.RI","šaḫri",
];

fn main() {
    let out = Path::new("fixtures/output");
    let stego_dir = out.join("nft71_stego_png");
    let analysis_dir = out.join("sources/analysis");
    let witness_dir = out.join("witnesses");
    let source_witness_dir = out.join("sources/witnesses");
    let tar_path = out.join("retro-sync.tar");

    let mut tar = fs::File::create(&tar_path).unwrap();
    let mut count = 0usize;

    let mut emit = |id: &str, pairs: &[(&str, &str)], tags: &[&str], tar: &mut fs::File| {
        let cbor = encode_shard(id, pairs, tags);
        tar_entry(tar, &format!("{}.cbor", id), &cbor).unwrap();
    };

    // ── Layer 0: Cuneiform input (71 tiles) ─────────────────────
    let signs: Vec<char> = ('\u{12000}'..='\u{12046}').collect();
    for i in 1..=71usize {
        let sign = signs[i - 1].to_string();
        let interval = INTERVALS[(i - 1) % 7];
        let i_str = i.to_string();
        let png_path = stego_dir.join(format!("tile_{:02}.png", i));
        let cid = file_cid(&png_path);
        let sz = file_size(&png_path);
        let prime = if is_prime(i) { "true" } else { "false" };
        let id = format!("tile-{:02}", i);
        emit(&id, &[
            ("layer", "0-cuneiform"), ("shard", &i_str),
            ("cuneiform", &sign), ("interval", interval),
            ("prime", prime), ("mime", "image/png+nft7"),
            ("cid", &cid), ("bytes", &sz),
            ("stego_layers", "6"), ("encoding", "bitplane-rgb-2bit"),
        ], &["hurrian", "h6", "tile", "input"], &mut tar);
        count += 1;
    }

    // ── Layer 1: Witnessed YouTube sources ──────────────────────
    let sources = ["yt_01", "yt_04", "yt_06", "yt_07", "yt_08"];
    let labels = ["Kilmer", "Dumbrill", "Nikkal", "Oldest", "Levy"];
    for (src, label) in sources.iter().zip(labels.iter()) {
        let wav_path = out.join("sources/audio").join(format!("{}.wav", src));
        let cid = file_cid(&wav_path);
        let sz = file_size(&wav_path);
        let id = format!("source-{}", src);
        emit(&id, &[
            ("layer", "1-witness"), ("source", src), ("performer", label),
            ("mime", "audio/wav"), ("cid", &cid), ("bytes", &sz),
        ], &["hurrian", "witness", "youtube"], &mut tar);
        count += 1;
    }

    // ── Layer 2: Aubio note extraction ──────────────────────────
    for src in &sources {
        let notes_path = analysis_dir.join(format!("{}.notes", src));
        if !notes_path.exists() { continue; }
        let content = fs::read_to_string(&notes_path).unwrap_or_default();
        let nc = content.lines().filter(|l| l.split('\t').count() == 3).count().to_string();
        let cid = file_cid(&notes_path);
        let input_cid = file_cid(&out.join("sources/audio").join(format!("{}.wav", src)));
        let id = format!("notes-{}", src);
        emit(&id, &[
            ("layer", "2-extraction"), ("source", src),
            ("tool", "aubio"), ("mime", "text/x-aubio-notes"),
            ("note_count", &nc), ("cid", &cid), ("input_cid", &input_cid),
        ], &["hurrian", "analysis", "aubio", "intermediate"], &mut tar);
        count += 1;
    }

    // ── Layer 3: LilyPond source ────────────────────────────────
    for src in &sources {
        let ly_path = Path::new("fixtures/lilypond").join(format!("{}.ly", src));
        if !ly_path.exists() { continue; }
        let cid = file_cid(&ly_path);
        let sz = file_size(&ly_path);
        let input_cid = file_cid(&analysis_dir.join(format!("{}.notes", src)));
        let id = format!("lilypond-{}", src);
        emit(&id, &[
            ("layer", "3-notation"), ("source", src),
            ("tool", "notes_to_ly.py"), ("mime", "text/x-lilypond"),
            ("cid", &cid), ("bytes", &sz), ("input_cid", &input_cid),
        ], &["hurrian", "lilypond", "intermediate"], &mut tar);
        count += 1;
    }

    // ── Layer 4: MIDI ───────────────────────────────────────────
    for src in &sources {
        let midi_path = out.join(format!("{}.midi", src));
        if !midi_path.exists() { continue; }
        let cid = file_cid(&midi_path);
        let sz = file_size(&midi_path);
        let input_cid = file_cid(&Path::new("fixtures/lilypond").join(format!("{}.ly", src)));
        let id = format!("midi-{}", src);
        emit(&id, &[
            ("layer", "4-midi"), ("source", src),
            ("tool", "lilypond"), ("mime", "audio/midi"),
            ("cid", &cid), ("bytes", &sz), ("input_cid", &input_cid),
        ], &["hurrian", "midi", "intermediate"], &mut tar);
        count += 1;
    }

    // ── Layer 5: WAV output ─────────────────────────────────────
    for src in &sources {
        let wav_path = out.join(format!("{}.wav", src));
        if !wav_path.exists() { continue; }
        let cid = file_cid(&wav_path);
        let sz = file_size(&wav_path);
        let input_cid = file_cid(&out.join(format!("{}.midi", src)));
        let id = format!("wav-{}", src);
        emit(&id, &[
            ("layer", "5-audio"), ("source", src),
            ("tool", "fluidsynth"), ("mime", "audio/wav"),
            ("cid", &cid), ("bytes", &sz), ("input_cid", &input_cid),
        ], &["hurrian", "wav", "output"], &mut tar);
        count += 1;
    }

    // ── Pipeline witnesses (render.sh traces) ───────────────────
    for dir in [&witness_dir, &source_witness_dir] {
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.flatten() {
                let name = entry.file_name().to_string_lossy().to_string();
                if !name.ends_with(".witness.json") { continue; }
                let base = name.trim_end_matches(".witness.json").to_string();
                let content = fs::read_to_string(entry.path()).unwrap_or_default();
                let cid = content_cid(content.as_bytes());
                let id = format!("witness-{}", base);
                emit(&id, &[
                    ("layer", "meta-witness"), ("step", &base),
                    ("mime", "application/json"), ("cid", &cid),
                ], &["witness", "sha256", "zkperf"], &mut tar);
                count += 1;
            }
        }
    }

    // ── zkperf traces (if available) ─────────────────────────────
    let zkperf_dir = Path::new(&std::env::var("HOME").unwrap_or("/home/mdupont".into()))
        .join("zkperf/proofs");
    if let Ok(entries) = fs::read_dir(&zkperf_dir) {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if !name.ends_with(".json") { continue; }
            let base = name.trim_end_matches(".json").to_string();
            let content = fs::read_to_string(entry.path()).unwrap_or_default();
            let cid = content_cid(content.as_bytes());
            let sz = file_size(&entry.path());
            let id = format!("zkperf-{}", base);
            emit(&id, &[
                ("layer", "meta-zkperf"), ("proof", &base),
                ("mime", "application/json"), ("cid", &cid), ("bytes", &sz),
            ], &["zkperf", "proof", "trace"], &mut tar);
            count += 1;
        }
    }

    // ── Manifest shard ──────────────────────────────────────────
    let manifest_id = "manifest";
    emit(manifest_id, &[
        ("dataset", "retro-sync-h6"),
        ("shard_count", &count.to_string()),
        ("pipeline", "cuneiform→witness→aubio→lilypond→midi→wav"),
        ("layers", "0-cuneiform,1-witness,2-extraction,3-notation,4-midi,5-audio,meta-witness,meta-zkperf"),
    ], &["manifest", "hurrian", "h6"], &mut tar);
    count += 1;

    tar.write_all(&[0u8; 1024]).unwrap(); // tar EOF
    eprintln!("{} shards → {}", count, tar_path.display());
}
