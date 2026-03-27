#!/usr/bin/env python3
"""shamash-encode.sh — Encode dataset into Shamash ray geometry.

Each ray encodes 6 bytes: amplitude, frequency, phase, length, taper, hue.
Sparks at ray tips encode additional bytes.
Animation frames cycle through dataset slices.

Usage: python3 scripts/shamash_encode.py <payload_file> <output.svg> [n_frames]
"""

import math, sys, os, struct

SZ = 1024
CX, CY = SZ/2, SZ/2

def encode_tile(payload, frame=0, n_frames=1):
    """Encode one frame of payload into Shamash SVG geometry."""
    N_RAYS = 24  # 24 rays = 24×6 = 144 bytes per frame in rays
    N_SPARKS = 16  # 16 sparks = 16×4 = 64 bytes per frame in sparks
    BYTES_PER_FRAME = N_RAYS * 6 + N_SPARKS * 4  # 208 bytes/frame
    
    # Slice payload for this frame
    offset = (frame * BYTES_PER_FRAME) % max(1, len(payload))
    data = (payload * ((BYTES_PER_FRAME // len(payload)) + 2))[offset:offset + BYTES_PER_FRAME]
    
    off = 0
    def eat(n):
        nonlocal off
        chunk = data[off:off+n]
        off += n
        return chunk
    
    # Background — cream/parchment (high contrast, stego safe)
    svg = f'<rect width="{SZ}" height="{SZ}" fill="rgb(240,232,216)"/>\n'
    
    # Sun disc
    svg += f'<circle cx="{CX}" cy="{CY}" r="80" fill="#E8C840" opacity="0.7"/>\n'
    svg += f'<circle cx="{CX+12}" cy="{CY-6}" r="68" fill="rgb(240,232,216)" opacity="0.6"/>\n'
    
    # Ishtar 8-pointed star (static frame)
    star_pts = []
    for i in range(16):
        a = math.pi * 2 * i / 16
        r = 120 if i % 2 == 0 else 50
        star_pts.append(f"{CX + math.cos(a)*r:.1f},{CY + math.sin(a)*r:.1f}")
    svg += f'<polygon points="{" ".join(star_pts)}" fill="#DAA520" opacity="0.25"/>\n'
    
    # 24 data-encoding rays
    for ray in range(N_RAYS):
        rb = eat(6)
        amp = 15 + rb[0] * 0.3          # wave amplitude: 15-91
        freq = 2 + rb[1] % 8            # wave frequency: 2-9
        phase = rb[2] * 0.025           # phase: 0-6.3
        length = 0.5 + rb[3] / 300.0    # ray length fraction: 0.5-1.35
        taper = 0.3 + rb[4] / 400.0     # taper: 0.3-0.94
        hue = rb[5] * 0.025             # color hue: 0-6.3
        
        base_angle = ray * math.pi * 2 / N_RAYS
        max_r = (SZ/2 - 30) * length
        
        # Color from hue
        cr = max(80, min(220, int(160 + 50 * math.cos(hue))))
        cg = max(60, min(200, int(130 + 50 * math.cos(hue + 2.1))))
        cb = max(40, min(180, int(100 + 50 * math.cos(hue + 4.2))))
        
        # Build wavy ray path
        pts = []
        for s in range(40):
            t = s / 39.0
            r = 90 + t * max_r
            wave = amp * math.sin(freq * t * math.pi * 2 + phase) * (1 - t * taper)
            perp = base_angle + math.pi / 2
            x = CX + math.cos(base_angle) * r + math.cos(perp) * wave
            y = CY + math.sin(base_angle) * r + math.sin(perp) * wave
            pts.append(f"{x:.3f} {y:.3f}")  # 3 decimal places = extra data channel
        
        d = "M" + " L".join(pts)
        w = 2.5 * (1 - 0.3 * (ray % 3) / 3)
        svg += f'<path d="{d}" fill="none" stroke="rgb({cr},{cg},{cb})" stroke-width="{w:.1f}" stroke-linecap="round" opacity="0.65"/>\n'
    
    # 16 sparks at ray tips (additional data)
    for spark in range(N_SPARKS):
        sb = eat(4)
        ray_idx = spark * N_RAYS // N_SPARKS
        angle = ray_idx * math.pi * 2 / N_RAYS + sb[0] * 0.003
        dist = (SZ/2 - 40) + sb[1] * 0.2
        sr = 2 + sb[2] % 5
        brightness = max(120, min(255, 180 + sb[3] % 60))
        
        sx = CX + math.cos(angle) * dist
        sy = CY + math.sin(angle) * dist
        svg += f'<circle cx="{sx:.1f}" cy="{sy:.1f}" r="{sr}" fill="rgb({brightness},{brightness-30},{brightness-60})" opacity="0.5"/>\n'
    
    return svg, off

def main():
    payload_file = sys.argv[1] if len(sys.argv) > 1 else None
    output = sys.argv[2] if len(sys.argv) > 2 else "/var/www/solana.solfunmeme.com/retro-sync/scratch/shamash_data.svg"
    n_frames = int(sys.argv[3]) if len(sys.argv) > 3 else 24
    
    # Load payload
    if payload_file and os.path.exists(payload_file):
        payload = open(payload_file, 'rb').read()
    else:
        payload = b"Hurrian Hymn h.6 Nikkal Teshub Ugarit 1400BCE " + bytes(range(256)) * 8
    
    bytes_per_frame = 24 * 6 + 16 * 4  # 208
    total_capacity = bytes_per_frame * n_frames
    
    print(f"=== SHAMASH DATA ENCODER ===")
    print(f"  Payload: {len(payload)} bytes")
    print(f"  Frames: {n_frames}")
    print(f"  Capacity: {bytes_per_frame} B/frame × {n_frames} = {total_capacity} B total")
    print(f"  Channels: 24 rays × 6B + 16 sparks × 4B = {bytes_per_frame} B/frame")
    
    if n_frames == 1:
        # Static SVG
        body, encoded = encode_tile(payload, 0, 1)
        svg = f'<svg xmlns="http://www.w3.org/2000/svg" width="{SZ}" height="{SZ}" viewBox="0 0 {SZ} {SZ}">\n{body}</svg>\n'
    else:
        # Animated SVG — each ray animates through frames
        dur = n_frames * 0.3  # seconds
        
        # Generate all frames
        frames = []
        for f in range(n_frames):
            body, _ = encode_tile(payload, f, n_frames)
            frames.append(body)
        
        # Build animated SVG with frame switching
        svg = f'<svg xmlns="http://www.w3.org/2000/svg" width="{SZ}" height="{SZ}" viewBox="0 0 {SZ} {SZ}">\n'
        svg += f'<rect width="{SZ}" height="{SZ}" fill="rgb(240,232,216)"/>\n'
        
        # Use CSS keyframes to cycle visibility
        svg += '<style>\n'
        for f in range(n_frames):
            pct_start = f / n_frames * 100
            pct_end = (f + 1) / n_frames * 100
            svg += f'.f{f} {{ opacity: 0; animation: show{f} {dur}s infinite; }}\n'
            svg += f'@keyframes show{f} {{ {pct_start:.1f}% {{ opacity: 1; }} {pct_end:.1f}% {{ opacity: 0; }} }}\n'
        svg += '</style>\n'
        
        for f in range(n_frames):
            svg += f'<g class="f{f}">\n{frames[f]}</g>\n'
        
        svg += '</svg>\n'
    
    with open(output, 'w') as f:
        f.write(svg)
    
    sz = os.path.getsize(output)
    print(f"  Output: {output} ({sz//1024}KB)")
    print(f"  Encoded: {min(len(payload), total_capacity)} of {len(payload)} bytes")

if __name__ == "__main__":
    main()
