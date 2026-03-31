#!/usr/bin/env bash
set -euo pipefail
# shamash-tiles.sh — Generate Shamash+Ishtar animated SVG tiles for a project
# Usage: shamash-tiles.sh <project_dir>
# Uses FRACTRAN-modulated Shamash sun disc with C8 symmetry as tile faces.
# Each tile encodes project data in the wave parameters.

PROJECT_DIR="${1:?Usage: shamash-tiles.sh <project_dir>}"
PROJECT_DIR=$(realpath "$PROJECT_DIR")
SVG_DIR="$PROJECT_DIR/output/svg"
MIDI_DIR="$PROJECT_DIR/midi"

[ -f "$PROJECT_DIR/project.toml" ] || { echo "❌ No project.toml"; exit 1; }

mkdir -p "$SVG_DIR"

SLUG=$(basename "$PROJECT_DIR")
MIDI_COUNT=$(ls "$MIDI_DIR"/*.mid 2>/dev/null | wc -l)

echo "=== SHAMASH TILES: $SLUG ($MIDI_COUNT MIDIs) ==="

python3 - "$PROJECT_DIR" "$SVG_DIR" "$MIDI_DIR" "$SLUG" <<'PYEOF'
import sys, os, math, hashlib

project_dir = sys.argv[1]
svg_dir = sys.argv[2]
midi_dir = sys.argv[3]
slug = sys.argv[4]

SZ = 512
CX, CY = SZ/2, SZ/2

# Load MIDI data as seed bytes
midi_files = sorted(f for f in os.listdir(midi_dir) if f.endswith('.mid'))
seed_data = b''
for mf in midi_files[:15]:
    seed_data += open(os.path.join(midi_dir, mf), 'rb').read()[:500]
if not seed_data:
    seed_data = slug.encode() * 100

for idx in range(1, 72):
    # Per-tile seed from MIDI data
    h = hashlib.sha256(f"{slug}-{idx}".encode() + seed_data[idx*7:(idx+1)*7]).digest()
    
    # FRACTRAN-modulated parameters
    amp = 30 + h[0] % 40        # wave amplitude
    freq = 3 + h[1] % 6         # wave frequency
    phase = h[2] * 0.025        # phase offset
    disc_r = 60 + h[3] % 30     # disc radius
    star_r = 100 + h[4] % 60    # star outer radius
    n_rays = 8                   # C8 symmetry
    hue_base = h[5] * 1.4       # color base
    
    # Background — warm, high contrast
    bg_r = 230 + (h[6] % 20)
    bg_g = 220 + (h[7] % 20)
    bg_b = 200 + (h[8] % 20)
    
    svg = f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="{SZ}" height="{SZ}" viewBox="0 0 {SZ} {SZ}">
<rect width="{SZ}" height="{SZ}" fill="rgb({min(255,bg_r)},{min(255,bg_g)},{min(255,bg_b)})"/>
'''
    
    # Sun disc
    svg += f'<circle cx="{CX}" cy="{CY}" r="{disc_r}" fill="#E8C840" opacity="0.7"/>\n'
    svg += f'<circle cx="{CX+10}" cy="{CY-5}" r="{disc_r-10}" fill="rgb({min(255,bg_r)},{min(255,bg_g)},{min(255,bg_b)})" opacity="0.6"/>\n'
    
    # 8-pointed Ishtar star
    star_pts = []
    for i in range(16):
        a = math.pi * 2 * i / 16 + phase
        r = star_r if i % 2 == 0 else star_r * 0.45
        star_pts.append(f"{CX + math.cos(a)*r:.1f},{CY + math.sin(a)*r:.1f}")
    svg += f'<polygon points="{" ".join(star_pts)}" fill="#DAA520" opacity="0.3"/>\n'
    
    # Wavy rays (C8 symmetric, data in wave params)
    for ray in range(n_rays):
        base_angle = ray * math.pi * 2 / n_rays + phase * 0.1
        # Ray color from data
        rb = h[(ray * 3) % 32]
        cr = max(100, min(240, 160 + (rb % 80)))
        cg = max(80, min(220, 120 + (rb % 60)))
        cb = max(60, min(200, 80 + (rb % 40)))
        
        pts = []
        for s in range(30):
            t = s / 29.0
            r = disc_r + t * (SZ/2 - disc_r - 20)
            wave = amp * math.sin(freq * t * math.pi * 2 + phase + ray * 0.3) * (1 - t * 0.5)
            perp = base_angle + math.pi / 2
            x = CX + math.cos(base_angle) * r + math.cos(perp) * wave
            y = CY + math.sin(base_angle) * r + math.sin(perp) * wave
            pts.append(f"{x:.1f} {y:.1f}")
        
        d = "M" + " L".join(pts)
        w = 3.0 * (1 - 0.5 * (ray % 3) / 3)
        svg += f'<path d="{d}" fill="none" stroke="rgb({cr},{cg},{cb})" stroke-width="{w:.1f}" stroke-linecap="round" opacity="0.6"/>\n'
    
    # Title + shard info on dark panels
    name = midi_files[(idx-1) % len(midi_files)].replace('.mid','')[:35] if midi_files else slug
    svg += f'<rect x="60" y="20" width="392" height="36" fill="#1a1510" rx="4" opacity="0.85"/>\n'
    svg += f'<text x="256" y="44" text-anchor="middle" fill="#FFD700" font-family="serif" font-size="18" font-weight="bold">{slug}</text>\n'
    svg += f'<rect x="80" y="460" width="352" height="32" fill="#1a1510" rx="4" opacity="0.8"/>\n'
    svg += f'<text x="256" y="481" text-anchor="middle" fill="#C0B890" font-family="monospace" font-size="10">shard {idx:02d}/71 · {name[:30]}</text>\n'
    
    svg += '</svg>\n'
    
    with open(os.path.join(svg_dir, f'{idx:02d}.svg'), 'w') as f:
        f.write(svg)

print(f"  ✅ 71 Shamash SVG tiles → {svg_dir}/")
PYEOF

echo "=== DONE ==="
