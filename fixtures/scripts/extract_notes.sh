#!/usr/bin/env bash
# extract_notes.sh — Extract notes, onsets, and pitch from witnessed audio
# Uses aubio for pitch tracking + onset detection
# Output: per-source note list, frequency table, combined analysis
set -euo pipefail

SRC="${1:-fixtures/output/sources/audio}"
OUT="${2:-fixtures/output/sources/analysis}"
mkdir -p "$OUT"

ts() { date -u +%Y%m%dT%H%M%SZ; }
sha() { sha256sum "$1" | cut -d' ' -f1; }

echo "=== Note Extraction Pipeline ==="
echo "aubio: $(aubionotes --help 2>&1 | head -1)"
echo ""

for wav in "$SRC"/*.wav; do
  [ -f "$wav" ] || continue
  base=$(basename "$wav" .wav)
  echo "[$base] $(du -h "$wav" | cut -f1)"

  # Duration
  dur=$(soxi -D "$wav" 2>/dev/null || echo "0")
  echo "  duration: ${dur}s"

  # Onset detection (beat/note boundaries)
  aubio onset -i "$wav" > "$OUT/${base}.onsets" 2>/dev/null || true
  onsets=$(wc -l < "$OUT/${base}.onsets" 2>/dev/null || echo "0")
  echo "  onsets: $onsets"

  # Pitch tracking (fundamental frequency per frame)
  aubio pitch -i "$wav" > "$OUT/${base}.pitch" 2>/dev/null || true
  pitches=$(wc -l < "$OUT/${base}.pitch" 2>/dev/null || echo "0")
  echo "  pitch frames: $pitches"

  # Note extraction (MIDI note events: onset, pitch, duration)
  aubionotes -i "$wav" > "$OUT/${base}.notes" 2>/dev/null || true
  notes=$(wc -l < "$OUT/${base}.notes" 2>/dev/null || echo "0")
  echo "  notes: $notes"

  # Frequency histogram (top 20 pitches)
  awk '{if($2>50 && $2<2000) printf "%.0f\n", $2}' "$OUT/${base}.pitch" \
    | sort -n | uniq -c | sort -rn | head -20 > "$OUT/${base}.freq_hist"

  # Witness the analysis
  cat > "$OUT/${base}.witness.json" <<EOF
{
  "id": "${base}_analysis",
  "timestamp": "$(ts)",
  "source": "$(basename "$wav")",
  "source_sha256": "$(sha "$wav")",
  "duration_s": ${dur:-0},
  "onsets": ${onsets},
  "pitch_frames": ${pitches},
  "notes": ${notes},
  "tool": "aubio",
  "pipeline": "retro-sync/extract-notes"
}
EOF

  echo ""
done

# Summary: combine all note files
echo "=== Frequency Summary (all sources) ==="
echo "Top frequencies across all interpretations:"
cat "$OUT"/*.freq_hist 2>/dev/null | awk '{freq[$2]+=$1} END {for(f in freq) print freq[f], f}' \
  | sort -rn | head -30 | while read count freq; do
  # Map frequency to note name
  note=$(python3 -c "
import math
f=$freq
if f>0:
  n=12*math.log2(f/440)+69
  names=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']
  print(f'{names[round(n)%12]}{int(round(n)/12)-1} ({f:.0f}Hz)')
else: print('?')
" 2>/dev/null || echo "${freq}Hz")
  printf "  %6d  %s\n" "$count" "$note"
done

echo ""
echo "=== Output ==="
echo "  $OUT/"
ls "$OUT"/ | head -30
