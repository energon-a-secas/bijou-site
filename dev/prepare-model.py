#!/usr/bin/env python3
"""Optimize the CC0 source VRM without changing topology, rig or expressions.

Usage: python3 dev/prepare-model.py /path/to/Victoria_Rubin.vrm
Requires Pillow. This is an asset preparation tool, not a site build step.
"""
import hashlib
import io
import json
from pathlib import Path
import struct
import sys
from PIL import Image

source = Path(sys.argv[1]).read_bytes()
length = struct.unpack_from('<I', source, 12)[0]
document = json.loads(source[20:20+length])
binary = source[28+length:]
assert document['extensions']['VRM']['meta']['licenseName'] == 'CC0'
# Remove the source outfit, shoes, ribbon and tied tuft at the asset level.
# Bijou's wardrobe and hair modules supply their own replacements.
for mesh in document['meshes']:
    mesh['primitives'] = [primitive for index, primitive in enumerate(mesh['primitives'])
                          if primitive['material'] not in {10, 11, 13, 15}
                          and not (mesh['name'].startswith('Hair') and index >= 25)]
replacements = {}
# Runtime-generated materials replace the body, shoes and source clothing.
# Keep their texture slots valid but replace unused pixel data with a tiny map.
unused = {15, 16, 17, 18, 20, 23, 24, 27}
for index, image in enumerate(document['images']):
    view = document['bufferViews'][image['bufferView']]
    start = view.get('byteOffset', 0)
    picture = Image.open(io.BytesIO(binary[start:start+view['byteLength']])).convert('RGBA')
    if index in unused:
        picture = Image.new('RGBA', (2, 2), (255, 255, 255, 255))
    else:
        picture.thumbnail((512, 512), Image.Resampling.LANCZOS)
    output = io.BytesIO()
    picture.save(output, format='PNG', optimize=True)
    replacements[image['bufferView']] = output.getvalue()
    image['mimeType'] = 'image/png'

chunks = []
offset = 0
for i, view in enumerate(document['bufferViews']):
    original = view.get('byteOffset', 0)
    content = replacements.get(i, binary[original:original+view['byteLength']])
    view['byteOffset'] = offset
    view['byteLength'] = len(content)
    padded = content + b'\0' * (-len(content) % 4)
    chunks.append(padded)
    offset += len(padded)
document['buffers'][0]['byteLength'] = offset
document['extensions']['VRM']['meta']['texture'] = -1
document['asset']['extras'] = {'source': 'Victoria Rubin, pixiv, CC0 1.0', 'sourceSha256': hashlib.sha256(source).hexdigest()}
encoded = json.dumps(document, separators=(',', ':')).encode()
encoded += b' ' * (-len(encoded) % 4)
body = b''.join(chunks)
result = (struct.pack('<III', 0x46546c67, 2, 28+len(encoded)+len(body))
          + struct.pack('<II', len(encoded), 0x4e4f534a) + encoded
          + struct.pack('<II', len(body), 0x004e4942) + body)
destination = Path(__file__).resolve().parent.parent / 'assets/models/bijou.vrm'
destination.write_bytes(result)
print(f'{destination.name}: {len(source):,} → {len(result):,} bytes')
print(f'Source SHA-256: {hashlib.sha256(source).hexdigest()}')
