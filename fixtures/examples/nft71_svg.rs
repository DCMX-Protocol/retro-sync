//! nft71_svg — Generate 71 NFT tile SVGs for inspection before rasterization.
//!
//! Each tile: 512×512, cuneiform signs, interval names, notation, category colors.
//! SVGs can be opened in any browser for visual inspection.
//! Pipeline: SVG → PNG (resvg, no gamma) → stego embed
//!
//! Usage: cargo run -p fixtures --example nft71_svg

use std::path::Path;

const SZ: u32 = 512;

const CUNEIFORM: &[&str] = &[
    "𒀸𒌑𒄴𒊑", "𒄿𒊭𒅈𒌈", "𒂊𒁍𒁍", "𒉌𒀉𒃻", "𒃻𒇷𒌈",
    "𒆠𒁴𒈬", "𒁉𒌈", "𒊺𒊒", "𒊭𒅖𒊭𒌈", "𒊑𒁍𒌈",
    "𒅖𒄣", "𒋾𒌅𒅈𒃻", "𒋾𒌅𒅈𒄿", "𒊺𒅈𒁺", "𒀀𒈬𒊏𒁉",
];

const INTERVALS: &[&str] = &[
    "nīš tuḫrim", "išartum", "embūbum", "nīd qablim", "qablītum",
    "kitmum", "pītum", "šērum", "šalšatum", "rebûttum",
    "isqum", "titur qablītim", "titur išartim", "ṣerdum", "colophon",
];

const NOTATION_L1: &str = "qáb-li-te 3  ir-bu-te 1  qáb-li-te 3  ša-aḫ-ri 1  i-šar-te 10";
const NOTATION_L2: &str = "ti-ti-mi-šar-te 2  zi-ir-te 1  ša-aḫ-ri 2  ša-aš-ša-te 2  ir-bu-te 2";

const PRIMES: &[u64] = &[2,3,5,7,11,13,17,19,23,29,31,37,41,43,47,53,59,61,67,71];

fn is_prime(n: u64) -> bool { PRIMES.contains(&n) }

fn category(idx: u64) -> &'static str {
    if is_prime(idx) { return "generator"; }
    match idx {
        4|6 => "source",
        8|9|10 => "artifact",
        12|14|15|16|18 => "witness",
        20|21|22|24|25 => "eigenspace",
        26|27|28|30|32|33|34|35 => "metadata",
        36|38|39|40|42 => "reconstruction",
        44|45|46|48|49|50|51|52|54|55|56|57 => "reference",
        58|60|62|63|64|65 => "youtube",
        66|68|69|70 => "pipeline",
        _ => "reserved",
    }
}

fn cat_color(cat: &str) -> &'static str {
    match cat {
        "generator"      => "#1a1a2e",
        "source"         => "#2d1b2e",
        "artifact"       => "#1b2e1b",
        "witness"        => "#2e2e1b",
        "eigenspace"     => "#1b2e2e",
        "metadata"       => "#2e1b1b",
        "reconstruction" => "#1b1b2e",
        "reference"      => "#2e2b1b",
        "youtube"        => "#2e1b2b",
        "pipeline"       => "#1b2b1b",
        _                => "#1a1a1a",
    }
}

fn tile_svg(idx: u64) -> String {
    let cat = category(idx);
    let bg = cat_color(cat);
    let border = if is_prime(idx) { "#ffd700" } else { "#444444" };
    let marker = if is_prime(idx) { "★" } else { "·" };
    let cunei = CUNEIFORM[((idx - 1) as usize) % CUNEIFORM.len()];
    let interval = INTERVALS[((idx - 1) as usize) % INTERVALS.len()];

    format!(r##"<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="{SZ}" height="{SZ}" viewBox="0 0 {SZ} {SZ}">
  <rect width="{SZ}" height="{SZ}" fill="{bg}"/>
  <!-- border -->
  <rect x="0" y="0" width="{SZ}" height="4" fill="{border}"/>
  <rect x="0" y="0" width="4" height="{SZ}" fill="{border}"/>
  <rect x="0" y="{y_bot}" width="{SZ}" height="4" fill="{border}"/>
  <rect x="{x_rt}" y="0" width="4" height="{SZ}" fill="{border}"/>
  <!-- cuneiform -->
  <text x="256" y="90" text-anchor="middle" fill="#ffd700" font-size="64">{cunei}</text>
  <!-- interval name -->
  <text x="256" y="200" text-anchor="middle" fill="#c9d1d9" font-family="monospace" font-size="22">{interval}</text>
  <!-- notation -->
  <text x="256" y="250" text-anchor="middle" fill="#7ee787" font-family="monospace" font-size="11">{NOTATION_L1}</text>
  <text x="256" y="268" text-anchor="middle" fill="#7ee787" font-family="monospace" font-size="11">{NOTATION_L2}</text>
  <!-- shard info -->
  <text x="256" y="440" text-anchor="middle" fill="#8b949e" font-family="monospace" font-size="16">{marker}{idx:02} {cat}</text>
  <text x="256" y="470" text-anchor="middle" fill="#58a6ff" font-family="monospace" font-size="11">Hurrian Hymn h.6 · Tablet RS 15.30 · ~1400 BC · Ugarit</text>
  <text x="256" y="492" text-anchor="middle" fill="#484848" font-family="monospace" font-size="9">DA51 CBOR · Groth16/BN254 · Cl(15,0,0) · 6-layer stego</text>
</svg>"##,
        y_bot = SZ - 4,
        x_rt = SZ - 4,
    )
}

fn main() {
    let out = Path::new("fixtures/output/nft71_svg");
    std::fs::create_dir_all(out).unwrap();

    println!("=== Generating 71 NFT tile SVGs ({SZ}×{SZ}) ===");
    for idx in 1..=71u64 {
        let svg = tile_svg(idx);
        let path = out.join(format!("{:02}.svg", idx));
        std::fs::write(&path, &svg).unwrap();
        let cat = category(idx);
        let marker = if is_prime(idx) { "★" } else { "·" };
        println!("{marker} {:02} [{cat}]", idx);
    }

    // Generate an HTML gallery for inspection
    let mut html = String::from(r#"<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>NFT71 Tile Gallery</title>
<style>
body{background:#0a0a0a;color:#0f0;font-family:monospace;padding:1em}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px}
.tile{border:1px solid #333;text-align:center;font-size:11px;padding:4px}
.tile img{width:100%;display:block}
.tile.prime{border-color:#ffd700}
h1{color:#0ff}
</style></head><body>
<h1>𒀸𒌑𒄴𒊑 NFT71 Tile Gallery — Inspect Before Rasterization</h1>
<div class="grid">
"#);
    for idx in 1..=71u64 {
        let cls = if is_prime(idx) { "tile prime" } else { "tile" };
        let marker = if is_prime(idx) { "★" } else { "·" };
        html.push_str(&format!(
            "<div class=\"{cls}\"><img src=\"{:02}.svg\"><br>{marker}{:02} {}</div>\n",
            idx, idx, category(idx)
        ));
    }
    html.push_str("</div></body></html>");
    std::fs::write(out.join("gallery.html"), &html).unwrap();

    println!("\n→ 71 SVGs + gallery.html in {}", out.display());
    println!("→ Open gallery.html in browser to inspect");
}
