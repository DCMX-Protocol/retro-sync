#!/usr/bin/env bash
# witness_sources.sh — Download, hash, and witness all source materials
# Each source gets: content file, sha256, timestamp, provenance witness
# Audio from YouTube is extracted as WAV for spectral analysis
set -euo pipefail

OUT="${1:-fixtures/output/sources}"
WITNESS_DIR="${OUT}/witnesses"
AUDIO_DIR="${OUT}/audio"
PAGES_DIR="${OUT}/pages"
mkdir -p "$WITNESS_DIR" "$AUDIO_DIR" "$PAGES_DIR"

ts() { date -u +%Y%m%dT%H%M%SZ; }
sha() { sha256sum "$1" | cut -d' ' -f1; }

witness() {
  local id="$1" url="$2" file="$3" type="$4"
  local hash
  hash=$(sha "$file")
  cat > "${WITNESS_DIR}/${id}.witness.json" <<EOF
{
  "id": "${id}",
  "timestamp": "$(ts)",
  "url": "${url}",
  "file": "$(basename "$file")",
  "type": "${type}",
  "sha256": "${hash}",
  "bytes": $(stat -c%s "$file"),
  "tool": "$(basename "$0")",
  "hostname": "$(hostname)",
  "pipeline": "retro-sync/witness-sources"
}
EOF
  echo "  ✅ ${id}: ${hash:0:16}… ($(stat -c%s "$file") B)"
}

echo "=== Witnessing YouTube Sources ==="
idx=0
while IFS= read -r line; do
  [[ "$line" =~ ^#.*$ || -z "$line" ]] && continue
  url="$line"
  idx=$((idx + 1))
  id=$(printf "yt_%02d" "$idx")
  outfile="${AUDIO_DIR}/${id}"

  echo "[${id}] ${url}"

  # Download audio as WAV (best audio, convert to wav)
  if [ ! -f "${outfile}.wav" ]; then
    yt-dlp -x --audio-format wav --audio-quality 0 \
      -o "${outfile}.%(ext)s" "$url" 2>"${AUDIO_DIR}/${id}.log" || {
      echo "  ⚠ download failed, see ${id}.log"
      continue
    }
  else
    echo "  (cached)"
  fi

  [ -f "${outfile}.wav" ] && witness "$id" "$url" "${outfile}.wav" "youtube_audio"

  # Also extract metadata
  if [ ! -f "${outfile}.info.json" ]; then
    yt-dlp --write-info-json --skip-download \
      -o "${outfile}" "$url" 2>/dev/null || true
  fi
  [ -f "${outfile}.info.json" ] && witness "${id}_meta" "$url" "${outfile}.info.json" "youtube_metadata"

done < fixtures/data/youtube_sources.txt

echo ""
echo "=== Witnessing Reference Pages ==="
idx=0
while IFS= read -r line; do
  [[ "$line" =~ ^#.*$ || -z "$line" ]] && continue
  url="$line"
  idx=$((idx + 1))
  id=$(printf "ref_%02d" "$idx")
  outfile="${PAGES_DIR}/${id}.html"

  echo "[${id}] ${url}"

  if [ ! -f "$outfile" ]; then
    curl -sL --max-time 30 -o "$outfile" "$url" 2>/dev/null || {
      echo "  ⚠ fetch failed"
      continue
    }
  else
    echo "  (cached)"
  fi

  [ -f "$outfile" ] && witness "$id" "$url" "$outfile" "reference_page"

done < fixtures/data/references.txt

echo ""
echo "=== Chain Commitment ==="
CHAIN=$(cat "${WITNESS_DIR}"/*.witness.json 2>/dev/null | sha256sum | cut -d' ' -f1)
cat > "${WITNESS_DIR}/99_sources_commitment.witness.json" <<EOF
{
  "step": "99_sources_commitment",
  "timestamp": "$(ts)",
  "chain_hash": "${CHAIN}",
  "witness_count": $(ls "${WITNESS_DIR}"/*.witness.json | wc -l),
  "pipeline": "retro-sync/witness-sources",
  "sop": "SOP-RETROSYNC-WIT-001"
}
EOF

echo "commitment: ${CHAIN:0:32}…"
echo ""
echo "=== Summary ==="
echo "audio:     $(ls "$AUDIO_DIR"/*.wav 2>/dev/null | wc -l) files"
echo "pages:     $(ls "$PAGES_DIR"/*.html 2>/dev/null | wc -l) files"
echo "witnesses: $(ls "$WITNESS_DIR"/*.witness.json | wc -l) records"
echo "output:    ${OUT}/"
