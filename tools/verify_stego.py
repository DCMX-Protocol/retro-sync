#!/usr/bin/env python3
"""Verify stego extraction from PNG tile 01."""
from PIL import Image
import numpy as np

img = Image.open('fixtures/output/nft71_stego_png/01.png')
px = np.array(img)
print("Shape:", px.shape, "dtype:", px.dtype)

flat = px.reshape(-1, px.shape[-1])
print("First 4 pixels:", flat[:4].tolist())

PLANES = 6
out = []
for i in range(32):
    byte = 0
    for b in range(8):
        bit_idx = i * 8 + b
        pxi = bit_idx // PLANES
        plane = bit_idx % PLANES
        ch = plane % 3
        bit_pos = plane // 3
        byte |= ((int(flat[pxi][ch]) >> bit_pos) & 1) << b
    out.append(byte)

hx = " ".join("{:02x}".format(b) for b in out)
print("First 32 bytes:", hx)
print("ASCII:", bytes(out[:8]))
print("Expected: 4e 46 54 37 (NFT7)")
