NIX = nix develop --command
CARGO = $(NIX) cargo
BUN = $(NIX) bun

FRACTRAN = /home/mdupont/.emacs.d.kiro/kiro.el-research/fractran-vm/target/release/fractran-vm
WRAP = /home/mdupont/.emacs.d.kiro/kiro.el-research/fractran-vm/scripts/wrap_modes.py

.PHONY: all rust frontend clean shell reflect

all: rust frontend

rust:
	$(CARGO) build --workspace

frontend:
	$(BUN) install --frozen-lockfile
	$(BUN) run build

reflect:
	find backend/src shared/src zk_circuits/src tools/*/src frontend/src -name "*.rs" > /tmp/retro-sync-refs.txt
	python3 $(WRAP) /tmp/retro-sync-refs.txt --out-dir /tmp/retro-sync-wrappers
	$(FRACTRAN) reflect /tmp/retro-sync-wrappers/
	mkdir -p shards
	$(FRACTRAN) export shards /tmp/retro-sync-wrappers/

clean:
	$(CARGO) clean
	rm -rf dist node_modules shards

shell:
	nix develop
