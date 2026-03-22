# Retrosync — DA51 CBOR Shards

Pre-generated DA51-tagged CBOR shards produced by the Fractran VM
(`nix/fractran-vm`) wrapping each Rust source file in an Emacs Lisp
representation via `rust-mode` and `wrap_modes.py`.

Each `.el.cbor` file is a CBOR-serialised Emacs Lisp s-expression of the
corresponding Rust module, tagged with the DA51 tag (`0xDA51 = 55889`) as
defined by `erdfa-publish`.  These files are checked in so that the full shard
graph is available without a live Fractran VM.

## File naming convention

```
<workspace>_<crate>_src_<module>.rs.el.cbor
```

| File prefix             | Source path                              |
|-------------------------|------------------------------------------|
| `backend_src_`          | `apps/api-server/src/` ¹                 |
| `shared_src_`           | `libs/shared/src/`                       |
| `frontend_src_`         | `apps/wasm-frontend/src/`                |
| `zk_circuits_src_`      | `libs/zk-circuits/src/`                  |
| `tools_btfs-keygen_src_`| `tools/btfs-keygen/src/`                 |
| `tools_ceremony_src_`   | `tools/ceremony/src/`                    |
| `tools_font_check_src_` | `tools/font-check/src/`                  |

¹ The `backend_src_*` shards were generated from the original `backend/src/`
layout (before the monorepo restructure to `apps/api-server/src/`).  The
CBOR content reflects the module source at generation time; regenerate with
the script below after significant module changes.

## Serving shards at runtime

Shards are indexed in-process via `POST /api/shard/decompose` (audio CFT
decomposition) and retrieved via `GET /api/shard/:cid`.  The pre-built
`.el.cbor` files can be bulk-imported at startup by reading and hashing each
file, then storing the result in `ShardStore`.

## Regenerating shards

Requires: `nix develop` (provides the pinned Fractran VM and Emacs with
`rust-mode`).

```bash
# From repo root inside nix develop
make reflect          # runs wrap_modes.py → .dasl cache → shards/*.el.cbor
```

The `make reflect` target calls `wrap_modes.py` which iterates every `.rs`
file in the workspace, wraps it in Emacs Lisp via `rust-mode`, and encodes
the result as a DA51-tagged CBOR shard using `erdfa-publish`.

To regenerate only a single module:

```bash
python3 nix/fractran-vm/wrap_modes.py apps/api-server/src/shard.rs
```

Output is written to `shards/backend_src_shard.rs.el.cbor` (legacy naming)
or `shards/apps_api_server_src_shard.rs.el.cbor` (new convention) depending
on the version of `wrap_modes.py` in use.

## NFT-gated access

The `GET /api/shard/:cid` endpoint checks BTTC token ownership via
`MasterPattern.sol ownerOf()`.  Holders of the track's SoulboundNFT receive
the full shard payload; unauthenticated callers receive a truncated preview
with a purchase prompt.

Set `BTTC_DEV_MODE=1` to bypass ownership checks during local development.
