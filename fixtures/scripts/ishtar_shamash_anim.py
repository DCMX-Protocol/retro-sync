#!/usr/bin/env python3
"""Animate Star of Ishtar+Shamash with FRACTRAN symmetry-preserving mutations.

The C8 symmetry is preserved: all 8 ray groups mutate identically.
FRACTRAN fractions modulate: wave amplitude, frequency, phase, star radius.
Each frame = one FRACTRAN step applied to the shared wave parameters.
"""

import math

SZ = 1024
CX, CY = SZ/2, SZ/2
SCRATCH = "/var/www/solana.solfunmeme.com/retro-sync/scratch"
N_KEYS = 24
DUR = 8.0

# FRACTRAN mutations that preserve C8 symmetry (act on shared params only)
# Format: (numerator_prime, denominator_prime) — transfers between registers
MUTATIONS = [
    (3, 2),   # amplitude ↔ frequency
    (5, 3),   # frequency ↔ phase
    (2, 7),   # disc_size ↔ star_radius
    (7, 5),   # star_radius ↔ phase
]

SSP = [2, 3, 5, 7, 11, 13]

def fractran_step(state, fractions):
    for num, den in fractions:
        if state % den == 0:
            return state * num // den
    return state

def state_to_params(state):
    """Decode FRACTRAN state into wave parameters."""
    amp = 10 + (state % 37) * 0.8        # amplitude: 10-39
    freq = 2 + (state // 37 % 7)          # frequency: 2-8
    phase = (state // 259 % 31) * 0.2      # phase: 0-6.2
    star_r = 350 + (state // 8029 % 20) * 5  # star outer: 350-445
    disc_r = 60 + (state // 160580 % 10) * 3  # disc: 60-87
    return amp, freq, phase, star_r, disc_r

def wave_path(cx, cy, r_inner, r_outer, base_angle, amp, freq, phase):
    pts = []
    for j in range(30):
        t = j / 29
        r = r_inner + (r_outer - r_inner) * t
        wave = amp * math.sin(freq * t * math.pi * 2 + phase) * (1 - t * 0.3)
        perp = base_angle + math.pi / 2
        x = cx + math.cos(base_angle) * r + math.cos(perp) * wave
        y = cy + math.sin(base_angle) * r + math.sin(perp) * wave
        pts.append(f"{x:.0f} {y:.0f}")
    return "M" + " L".join(pts)

def star_points(cx, cy, r_inner, r_outer):
    pts = []
    for i in range(16):
        angle = i * math.pi / 8
        r = r_outer if i % 2 == 0 else r_inner
        pts.append(f"{cx + math.cos(angle)*r:.0f},{cy + math.sin(angle)*r:.0f}")
    return " ".join(pts)

def main():
    # Generate keyframes via FRACTRAN evolution
    state = 2**3 * 3**2 * 5**2 * 7  # initial state
    frames = []
    for k in range(N_KEYS):
        params = state_to_params(state)
        frames.append(params)
        state = fractran_step(state, MUTATIONS)
        if state == frames[0] and k > 0:
            state = state * 2 + 1  # escape cycle

    svg = f'<svg xmlns="http://www.w3.org/2000/svg" width="{SZ}" height="{SZ}" viewBox="0 0 {SZ} {SZ}">\n'
    svg += f'<rect width="{SZ}" height="{SZ}" fill="#3a3020"/>\n'

    # Animated Ishtar star
    star_vals = ";".join(star_points(CX, CY, 200, f[3]) for f in frames)
    svg += f'<polygon points="{star_points(CX, CY, 200, frames[0][3])}" '
    svg += f'fill="none" stroke="rgb(200,180,80)" stroke-width="3" stroke-linejoin="miter" opacity="0.8">\n'
    svg += f'  <animate attributeName="points" values="{star_vals}" dur="{DUR}s" repeatCount="indefinite"/>\n'
    svg += f'</polygon>\n'

    # Annular rings
    svg += f'<circle cx="{CX}" cy="{CY}" r="300" fill="none" stroke="rgb(160,140,80)" stroke-width="3" opacity="0.6"/>\n'
    svg += f'<circle cx="{CX}" cy="{CY}" r="180" fill="none" stroke="rgb(150,130,70)" stroke-width="2" opacity="0.5"/>\n'

    # Animated wavy rays — 8 directions × 3 copies, all identical per frame
    for i in range(8):
        for copy in range(3):
            spread = (copy - 1) * 0.08
            base_angle = i * math.pi / 4 + math.pi / 8 + spread
            w = 3 - copy * 0.5
            op = 0.7 - copy * 0.1

            d_vals = ";".join(wave_path(CX, CY, 80, 480, base_angle, f[0], f[1], f[2]) for f in frames)

            svg += f'<path d="{wave_path(CX, CY, 80, 480, base_angle, frames[0][0], frames[0][1], frames[0][2])}" '
            svg += f'fill="none" stroke="rgb(220,170,50)" stroke-width="{w:.1f}" '
            svg += f'stroke-linecap="round" opacity="{op:.1f}">\n'
            svg += f'  <animate attributeName="d" values="{d_vals}" dur="{DUR}s" repeatCount="indefinite"/>\n'
            svg += f'</path>\n'

    # Animated disc
    r_vals = ";".join(f"{f[4]:.0f}" for f in frames)
    svg += f'<circle cx="{CX}" cy="{CY}" r="{frames[0][4]:.0f}" fill="rgb(220,180,60)" opacity="0.9">\n'
    svg += f'  <animate attributeName="r" values="{r_vals}" dur="{DUR}s" repeatCount="indefinite"/>\n'
    svg += f'</circle>\n'

    # Crescent cutout
    svg += f'<circle cx="{CX+15}" cy="{CY-5}" r="50" fill="#3a3020" opacity="0.7"/>\n'

    # Center eye
    svg += f'<circle cx="{CX}" cy="{CY}" r="12" fill="#3a3020" opacity="0.8"/>\n'

    svg += '</svg>\n'

    out = f"{SCRATCH}/ishtar_shamash_anim.svg"
    with open(out, 'w') as f:
        f.write(svg)

    print(f"=== ANIMATED ISHTAR+SHAMASH ===")
    print(f"  {N_KEYS} keyframes, {DUR}s cycle")
    print(f"  FRACTRAN mutations: {MUTATIONS}")
    print(f"  C8 symmetry preserved: all 24 rays mutate identically")
    print(f"  → {out}")
    print(f"  View: https://solana.solfunmeme.com/retro-sync/scratch/ishtar_shamash_anim.svg")

if __name__ == "__main__":
    main()
