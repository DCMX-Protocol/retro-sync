#!/usr/bin/env python3
"""Upload stego PNG tiles + WASM pkg to HuggingFace Space and Dataset."""
from huggingface_hub import HfApi

api = HfApi()
tiles = "fixtures/output/nft71_stego_png"
pkg = "docs/pkg"

for repo_type in ("space", "dataset"):
    print(f"Uploading tiles to {repo_type}...")
    api.upload_folder(
        folder_path=tiles,
        path_in_repo="tiles",
        repo_id="introspector/retro-sync",
        repo_type=repo_type,
    )

print("Uploading WASM pkg to space...")
api.upload_folder(
    folder_path=pkg,
    path_in_repo="pkg",
    repo_id="introspector/retro-sync",
    repo_type="space",
)

print("Done.")
