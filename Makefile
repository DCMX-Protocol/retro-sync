SHELL := bash
NIX   := nix --extra-experimental-features 'nix-command flakes'
RUN   := $(NIX) develop --command

# Source inputs
LY     := fixtures/lilypond/h6_west.ly
SRC    := fixtures/data/hurrian_h6.txt

# Generated outputs
OUT    := fixtures/output
WAV    := $(OUT)/h6_west.wav
MIDI   := $(OUT)/h6_west.midi
PDF    := $(OUT)/h6_west.pdf
PPM_DIR := $(OUT)/nft71_ppm
PNG_DIR := $(OUT)/nft71_stego_png
WASM   := docs/pkg/stego_bg.wasm

.PHONY: all dev test test-stego build wasm render tiles stego pipeline upload clean

# Full pipeline
all: pipeline

# Interactive dev shell
dev:
	$(NIX) develop

# ── Tests ──────────────────────────────────────────────────────────
test:
	$(RUN) cargo test -p stego

test-stego:
	$(RUN) cargo test -p stego -- --nocapture

# ── Step 1: LilyPond → MIDI + PDF, FluidSynth → WAV ──────────────
$(MIDI) $(PDF): $(LY)
	$(RUN) bash fixtures/scripts/render.sh $(LY) $(OUT)

$(WAV): $(MIDI)

render: $(WAV)

# ── Step 2: Generate SVG tiles (inspect in browser) ───────────────
SVG_DIR := $(OUT)/nft71_svg

$(SVG_DIR)/01.svg: $(SRC)
	$(RUN) cargo run -p fixtures --example nft71_svg

svg: $(SVG_DIR)/01.svg
	@echo "→ Open $(SVG_DIR)/gallery.html in browser to inspect"

tiles: svg

# ── Step 3: Stego embed + PNG output ──────────────────────────────
$(PNG_DIR)/01.png: $(SVG_DIR)/01.svg $(WAV) $(MIDI) $(PDF)
	$(RUN) cargo run -p fixtures --example nft71_stego_svg

stego: $(PNG_DIR)/01.png

# ── Step 4: WASM build ────────────────────────────────────────────
$(WASM): libs/stego/src/lib.rs libs/stego/Cargo.toml
	$(RUN) bash -c '\
		cargo build -p stego --target wasm32-unknown-unknown --release --features wasm && \
		wasm-bindgen target/wasm32-unknown-unknown/release/stego.wasm \
			--out-dir docs/pkg --target web --no-typescript'

wasm: $(WASM)

# ── Step 5: Build backend ─────────────────────────────────────────
build:
	$(RUN) cargo build --release -p backend

# ── Full pipeline ─────────────────────────────────────────────────
pipeline: test stego wasm
	@echo "=== pipeline complete ==="
	@echo "tiles: $(PNG_DIR)/"
	@echo "wasm:  docs/pkg/"

# ── Upload to HuggingFace ─────────────────────────────────────────
upload: pipeline
	$(RUN) python3 tools/upload_hf.py

# ── Nix build ─────────────────────────────────────────────────────
nix-build:
	$(NIX) build

clean:
	$(RUN) cargo clean
