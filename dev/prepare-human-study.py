#!/usr/bin/env python3
"""Prepare an adult CC0 anatomical source, without copying MakeHuman code.

Consumes the pinned public base/target/rig data cached outside the served repo.
Run `python3 dev/prepare-human-study.py`, then `node dev/build-human-study.cjs`.
The browser builder adds opaque clothing/eyes/hair and creates the GLB.
"""
from pathlib import Path
import collections
import hashlib
import json
from urllib.request import urlopen

REVISION = 'a8bc2d54ff0ac92e78ff71431b1023eda42bf482'
SOURCE = Path.home() / '.local/share/bijou/sources/makehuman-a8bc2d54'
DEST = Path(__file__).resolve().parent.parent / 'assets/studies/human-adult-v1'
FILES = {
    'base.obj': ('data/3dobjs/base.obj', '8e761e6624b8f54536409135d1636da63b32486a90d4897f84e121d144f6fb4c'),
    'female.target': ('data/targets/macrodetails/caucasian-female-young.target', '118379f6e8ba9266247fdb8788a20e1df40a239f97ced0b9905bcbcc74f6e820'),
    'body.target': ('data/targets/macrodetails/universal-female-young-averagemuscle-averageweight.target', '4ba5396ddabda448ece15650a566fbebfbb10239256ccb201e8f883429e12249'),
    'rig.json': ('data/rigs/default.mhskel', '99f179bce0aa850b45d4191a1d0d234c5851f881c057439470ded3bddf729a24'),
    'weights.json': ('data/rigs/default_weights.mhw', '0f3641d651ae3d00ad6b4ccee43142edb109d3bd909d27d9e4139ef1beed8625')
}
SOURCE.mkdir(parents=True, exist_ok=True)
for filename, (upstream, expected) in FILES.items():
    local = SOURCE / filename
    if not local.exists():
        with urlopen(f'https://raw.githubusercontent.com/makehumancommunity/makehuman/{REVISION}/makehuman/{upstream}', timeout=60) as response:
            data = response.read()
        if hashlib.sha256(data).hexdigest() != expected:
            raise ValueError(f'Unexpected pinned source: {filename}')
        local.write_bytes(data)
    if hashlib.sha256(local.read_bytes()).hexdigest() != expected:
        raise ValueError(f'Cached source checksum mismatch: {filename}')

positions, uvs, faces, helpers = [], [], [], collections.defaultdict(set)
group = ''
for line in (SOURCE / 'base.obj').read_text().splitlines():
    parts = line.split()
    if not parts:
        continue
    if parts[0] == 'v':
        positions.append([float(v) for v in parts[1:4]])
    elif parts[0] == 'vt':
        uvs.append([float(v) for v in parts[1:3]])
    elif parts[0] == 'g':
        group = parts[1]
    elif parts[0] == 'f':
        corners = [(int(v.split('/')[0])-1, int(v.split('/')[1])-1) for v in parts[1:]]
        if group == 'body':
            faces.append(corners)
        else:
            helpers[group].update(v[0] for v in corners)

for filename in ['female.target', 'body.target']:
    for line in (SOURCE / filename).read_text().splitlines():
        parts = line.split()
        if not parts or parts[0].startswith('#'):
            continue
        at = int(parts[0])
        positions[at] = [positions[at][k]+float(parts[k+1]) for k in range(3)]

rig = json.loads((SOURCE / 'rig.json').read_text())
weights = json.loads((SOURCE / 'weights.json').read_text())
assert rig['license'] == weights['license'] == 'CC0'
mean = lambda ids: [sum(positions[i][k] for i in ids)/len(ids) for k in range(3)]
joints = {name: mean(ids) for name, ids in rig['joints'].items()}
body_ids = {v[0] for face in faces for v in face}
bottom = min(positions[i][1] for i in body_ids)
top = max(positions[i][1] for i in body_ids)
scale = 1.68/(top-bottom)
line = [(joints[rig['bones'][name]['head']][1], joints[rig['bones'][name]['head']][2])
        for name in ['foot.L', 'lowerleg01.L', 'upperleg01.L', 'spine04', 'spine02', 'neck01']]
line += [(joints[rig['bones']['head']['head']][1], (joints['head____head'][2]+joints['head____tail'][2])*.5)]
line.sort()

def center_depth(y):
    if y <= line[0][0]:
        return line[0][1]
    for a, b in zip(line, line[1:]):
        if y <= b[0]:
            t = (y-a[0])/(b[0]-a[0])
            t = t*t*(3-2*t)
            return a[1]*(1-t)+b[1]*t
    return line[-1][1]

def normalize(p):
    return [round(p[0]*scale, 7), round((p[1]-bottom)*scale, 7), round((p[2]-center_depth(p[1]))*scale, 7)]

names = {'root': 'Hips', 'head': 'Head', 'neck01': 'neck', 'neck02': 'Neck_2', 'neck03': 'Neck_3',
         'spine01': 'UpperChest', 'spine02': 'Chest', 'spine03': 'Spine', 'spine04': 'Spine_2', 'spine05': 'Spine_3'}
for side, prefix in [('L', 'Left'), ('R', 'Right')]:
    for original, name in [('upperarm01', 'Arm'), ('upperarm02', 'Arm_twist'), ('lowerarm01', 'ForeArm'),
                           ('lowerarm02', 'ForeArm_twist'), ('wrist', 'Hand'), ('upperleg01', 'UpLeg'),
                           ('upperleg02', 'UpLeg_twist'), ('lowerleg01', 'Leg'), ('lowerleg02', 'Leg_twist'), ('foot', 'Foot')]:
        names[f'{original}.{side}'] = prefix+name

def is_descendant(name, parent):
    while name:
        if name == parent:
            return True
        name = rig['bones'][name]['parent']
    return False

for name in rig['bones']:
    if name in names:
        continue
    prefix = 'Head_' if is_descendant(name, 'head') else 'Hand_' if name.startswith(('finger', 'metacarpal')) else 'Foot_' if name.startswith('toe') else 'Torso_'
    names[name] = prefix+name.replace('.', '_')
bone_ids = {name: i for i, name in enumerate(rig['bones'])}
bone_data = [{'name': names[name], 'parent': bone_ids.get(b['parent']), 'position': normalize(joints[b['head']]), 'tail': normalize(joints[b['tail']])}
             for name, b in rig['bones'].items()]
influences = collections.defaultdict(list)
for bone, values in weights['weights'].items():
    for vertex, weight in values:
        if weight > 0:
            influences[vertex].append((bone_ids[bone], weight))

vertex_map, vertices, texcoords, skin_indices, skin_weights, original_ids, indices = {}, [], [], [], [], [], []
for face in faces:
    ids = []
    for corner in face:
        if corner not in vertex_map:
            vertex, uv = corner
            vertex_map[corner] = len(vertices)//3
            vertices.extend(normalize(positions[vertex]))
            texcoords.extend(uvs[uv])
            ranked = sorted(influences[vertex], key=lambda v: v[1], reverse=True)[:4]
            if not ranked:
                raise ValueError(f'Unweighted body vertex {vertex}')
            total = sum(w for _, w in ranked)
            skin_indices.extend([ranked[k][0] if k < len(ranked) else 0 for k in range(4)])
            skin_weights.extend([ranked[k][1]/total if k < len(ranked) else 0 for k in range(4)])
            original_ids.append(vertex)
        ids.append(vertex_map[corner])
    for i in range(1, len(ids)-1):
        indices.extend([ids[0], ids[i], ids[i+1]])

eyes = []
for side in ['L', 'R']:
    p = normalize(joints[f'eye.{side}____head'])
    source_eye = helpers['helper-'+side.lower()+'-eye']
    bounds = [[min(normalize(positions[i])[k] for i in source_eye), max(normalize(positions[i])[k] for i in source_eye)] for k in range(3)]
    eyes.append({'x': p[0], 'y': p[1], 'z': p[2], 'radius': .0063, 'sphereRadius': (bounds[0][1]-bounds[0][0])*.48, 'bone': bone_ids['eye.'+side]})
eyes.sort(key=lambda p: p['x'])
mouth = normalize(joints[rig['bones']['oris01']['tail']])[1]+.0016
chin = normalize(joints[rig['bones']['jaw']['tail']])[1]
data = {'positions': vertices, 'uvs': texcoords, 'indices': indices, 'skinIndices': skin_indices,
        'skinWeights': skin_weights, 'originalIds': original_ids, 'bones': bone_data,
        'face': {'eye': sum(e['y'] for e in eyes)/2, 'mouth': mouth, 'chin': chin, 'eyes': eyes}}
DEST.mkdir(parents=True, exist_ok=True)
(DEST / 'source.json').write_text(json.dumps(data, separators=(',', ':')))
manifest = {'source': 'MakeHuman Community adult female base, default rig and weights', 'revision': REVISION,
            'license': 'CC0-1.0', 'ageAppearance': 'adult', 'triangles': len(indices)//3, 'vertices': len(vertices)//3,
            'bones': len(bone_data), 'sources': {name: hashlib.sha256((SOURCE/name).read_bytes()).hexdigest()
                                             for name in FILES},
            'urls': {name: f'https://github.com/makehumancommunity/makehuman/blob/{REVISION}/makehuman/{upstream}'
                     for name, (upstream, _) in FILES.items()}}
(DEST / 'manifest.json').write_text(json.dumps(manifest, indent=2)+'\n')
print(json.dumps({k: manifest[k] for k in ['triangles', 'vertices', 'bones', 'license']}))
