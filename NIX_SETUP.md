# Nix Build Environment Setup

This project now includes Nix flake infrastructure for reproducible builds.

## Files Created

- **flake.nix** - Nix flake configuration defining dev shell, build packages, and checks
- **flake.lock** - Lock file ensuring reproducible dependency resolution
- **.gitmodules** - Git submodules configuration for GitHub Actions and tools
- **Makefile** - Convenient Make targets for building with Nix

## Quick Start with Nix

### Initialize Nix Environment

```bash
# Clone git submodules
git submodule update --init --recursive

# Enter development shell (with all dependencies)
nix develop
```

### Build Commands

```bash
# Build everything
make all

# Build Rust backend
make rust

# Build frontend
make frontend

# Clean build artifacts
make clean

# Enter development shell
make shell
```

### What's Available in nix develop

- **Rust**: Latest stable Rust with rust-analyzer, clippy, rustfmt
- **WASM**: wasm32-unknown-unknown target, trunk, wasm-bindgen-cli
- **Node/Bun**: bun and nodejs_22 for frontend development
- **Solidity**: Foundry (forge, cast, anvil) via ethereum.nix
- **Native Deps**: pkg-config, OpenSSL, LMDB
- **Pre-commit hooks**: rustfmt and nixpkgs-fmt checks

## Environment Variables

Inside `nix develop`:
- `OPENSSL_DIR` - Points to OpenSSL dev files
- `OPENSSL_LIB_DIR` - Points to OpenSSL libraries

## Submodules

The following are git submodules from meta-introspector:
- `nix/ethereum.nix` - Foundry toolchain
- `nix/xrust` - XSLT engine (Rust)
- `nix/actions/*` - GitHub Actions forks

## Buildable Packages

- `nix build .#frontend` - Build frontend (dist/)
- `nix build .#backend` - Build backend binary
- `nix build .#default` - Build default (backend)

## Pre-commit Hooks

The flake includes git hooks for:
- rustfmt (check formatting on commit)
- nixpkgs-fmt (check Nix file formatting)

Enable them with:
```bash
pre-commit install --hook-type commit-msg
```

## Notes

- The Nix infrastructure provides complete isolation from system dependencies
- All builds are reproducible across different machines
- The `flake.lock` file ensures everyone uses the exact same dependency versions
