#!/usr/bin/env python3
"""Verify stego round-trip: extract WAV from PNGs, compare to original."""
from PIL import Image
import numpy as np
import hashlib, struct, sys

PLANES = 6
TILE_CAP = 512 * 512 * PLANES // 8

def extract_tile(path):
    img = Image.open(path).convert("RGBA")
    flat = np.array(img).reshape(-1, 4)
    out = bytearray(TILE_CAP)
    for i in range(TILE_CAP):
        byte = 0
        for b in range(8):
            bit_idx = i * 8 + b
            px = bit_idx // PLANES
            plane = bit_idx % PLANES
            if px >= 512*512:
                break
            ch = plane % 3
            bit_pos = plane // 3
            byte |= ((int(flat[px][ch]) >> bit_pos) & 1) << b
        out[i] = byte
    return bytes(out)

print("Extracting 71 tiles...")
blob = b""
for i in range(1, 72):
    blob += extract_tile(f"fixtures/output/nft71_stego_png/{i:02d}.png")
    if i % 10 == 0:
        print(f"  {i}/71")

assert blob[:4] == b"NFT7", f"Bad magic: {blob[:4]}"
seg_count = struct.unpack("<I", blob[4:8])[0]
off = 8
for _ in range(seg_count):
    nl = struct.unpack("<I", blob[off:off+4])[0]; off += 4
    name = blob[off:off+nl].decode(); off += nl
    dl = struct.unpack("<I", blob[off:off+4])[0]; off += 4
    data = blob[off:off+dl]; off += dl
    h = hashlib.sha256(data).hexdigest()[:16]
    print(f"  {name:12s} {dl:>10,d} B  sha256:{h}...")
    if name == "wav":
        orig = open("fixtures/output/h6_west.wav", "rb").read()
        if data == orig:
            print(f"    ✅ WAV matches original ({len(orig):,d} B)")
        else:
            print(f"    ❌ MISMATCH: extracted={len(data):,d} orig={len(orig):,d}")
            for j in range(min(len(data), len(orig))):
                if data[j] != orig[j]:
                    print(f"    First diff at byte {j}")
                    break
