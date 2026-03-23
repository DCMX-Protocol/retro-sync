#!/usr/bin/env python3
"""Convert aubio .notes file to lilypond. Usage: notes_to_ly.py INPUT.notes OUTPUT.ly"""
import sys

MIDI_TO_LY = {
    48:"c", 49:"cis", 50:"d", 51:"dis", 52:"e", 53:"f", 54:"fis",
    55:"g", 56:"gis", 57:"a", 58:"bes", 59:"b",
    60:"c'", 61:"cis'", 62:"d'", 63:"dis'", 64:"e'", 65:"f'", 66:"fis'",
    67:"g'", 68:"gis'", 69:"a'", 70:"bes'", 71:"b'",
    72:"c''", 73:"cis''", 74:"d''", 75:"dis''", 76:"e''", 77:"f''",
}

# Duration quantization (seconds → lilypond at tempo=72 bpm, quarter=0.833s)
BEAT = 60.0 / 72.0  # 0.833s per quarter note

def quantize_dur(secs):
    beats = secs / BEAT
    if beats >= 3.0: return "1"    # whole
    if beats >= 1.5: return "2"    # half
    if beats >= 0.75: return "4"   # quarter
    if beats >= 0.375: return "8"  # eighth
    return "16"                     # sixteenth

def main():
    src, dst = sys.argv[1], sys.argv[2]
    notes = []
    with open(src) as f:
        for line in f:
            parts = line.strip().split('\t')
            if len(parts) != 3: continue
            midi, onset, offset = float(parts[0]), float(parts[1]), float(parts[2])
            midi_int = int(round(midi))
            if midi_int not in MIDI_TO_LY: continue
            dur = offset - onset
            if dur < 0.05: continue  # skip glitches
            notes.append((onset, MIDI_TO_LY[midi_int], quantize_dur(dur)))

    notes.sort(key=lambda x: x[0])

    # Group into bars of 4 beats
    bar_dur = 4 * BEAT
    first_onset = notes[0][0] if notes else 0
    bars = []
    cur_bar = []
    bar_start = first_onset
    for onset, pitch, dur in notes:
        while onset >= bar_start + bar_dur and cur_bar:
            bars.append(cur_bar)
            cur_bar = []
            bar_start += bar_dur
        cur_bar.append(f"{pitch}{dur}")
    if cur_bar:
        bars.append(cur_bar)

    with open(dst, 'w') as f:
        f.write('\\version "2.24.0"\n')
        f.write('\\header {\n')
        f.write('  title = "Hurrian Hymn h.6 — Hymn to Nikkal"\n')
        f.write('  subtitle = "Dumbrill reconstruction (transcribed from performance)"\n')
        f.write('  composer = "Anonymous (~1400 BC, Ugarit)"\n')
        f.write('  arranger = "Reconstruction: R. Dumbrill / S. Pringle"\n')
        f.write('  tagline = ##f\n')
        f.write('}\n\n')
        f.write('melody = {\n')
        f.write('  \\key c \\major\n')
        f.write('  \\time 4/4\n')
        f.write('  \\tempo "Andante" 4 = 72\n\n')
        for i, bar in enumerate(bars):
            f.write(f'  {" ".join(bar)} |\n')
        f.write('  \\bar "|."\n')
        f.write('}\n\n')
        f.write('\\score {\n  \\new Staff \\melody\n  \\layout { }\n  \\midi { }\n}\n')

    print(f"{len(notes)} notes → {len(bars)} bars → {dst}")

if __name__ == "__main__":
    main()
