#!/usr/bin/env python3
"""Build body-data.js: the 3D figure for the calculator from MakeHuman's CC0 assets.

Input (download once from github.com/makehumancommunity/makehuman, makehuman/data/):
  3dobjs/base.obj                                   the base mesh (body + helper groups)
  targets/macrodetails/{african,asian,caucasian}-<sex>-young.target   (sex shape)
  targets/macrodetails/universal-<sex>-young-<muscle>-<weight>.target
      for <sex> in male/female, and the four axis targets:
      averagemuscle-minweight, averagemuscle-maxweight, minmuscle-averageweight, maxmuscle-averageweight
Output: body-data.js  (window.BODY_DATA = {...}) with int16-quantised positions, uint16 triangles
and sparse int16 morph deltas, all base64. Usage: build_body.py <assets dir> <out.js>
"""
import base64, os, struct, sys

src, out = sys.argv[1], sys.argv[2]
# The tights helper is a full bodysuit; we cut two garments out of it by face
# centre (a straight hem) with an x limit that drops the sleeves:
SHORTS = (-3.2, 1.6, 2.6)   # (hem y, waist y, max |x|)  legs + hips
TOP    = (1.6, 4.7, 3.0)    # (hem y, neck y, max |x|)   chest to shoulders, meets the shorts; female figure only

# ---- base mesh ----
verts, faces = [], []          # faces: (group, [vertex idx...])
group = None
for line in open(os.path.join(src, 'base.obj')):
    if line.startswith('v '):
        verts.append(tuple(float(x) for x in line.split()[1:4]))
    elif line.startswith('g '):
        group = line.split()[1]
    elif line.startswith('f '):
        idx = [int(t.split('/')[0]) - 1 for t in line.split()[1:]]
        faces.append((group, idx))

def garment(idx):
    cy = sum(verts[i][1] for i in idx) / len(idx)
    cx = sum(abs(verts[i][0]) for i in idx) / len(idx)
    if SHORTS[0] < cy < SHORTS[1] and all(abs(verts[i][0]) < SHORTS[2] for i in idx): return 'shorts'
    if TOP[0] < cy < TOP[1] and cx < TOP[2] - 0.4 and all(abs(verts[i][0]) < TOP[2] for i in idx): return 'top'
    return None

kept = []
for g, idx in faces:
    if g == 'body': kept.append(('body', idx))
    elif g == 'helper-tights':
        gm = garment(idx)
        if gm: kept.append((gm, idx))
used = sorted({i for _, idx in kept for i in idx})
remap = {old: new for new, old in enumerate(used)}
positions = [verts[i] for i in used]

def tris_for(gname):
    t = []
    for g, idx in kept:
        if g != gname: continue
        m = [remap[i] for i in idx]
        for k in range(1, len(m) - 1): t.extend((m[0], m[k], m[k + 1]))   # fan-triangulate quads
    return t
body_tris = tris_for('body'); shorts_tris = tris_for('shorts'); top_tris = tris_for('top')
tris = body_tris + shorts_tris + top_tris

# ---- quantise ----
POS_SCALE = 1000.0   # base units are decimetres; +-32 units fits int16
def b64(fmt, values):
    return base64.b64encode(struct.pack('<%d%s' % (len(values), fmt), *values)).decode('ascii')
flat = [int(round(c * POS_SCALE)) for p in positions for c in p]
assert max(map(abs, flat)) < 32767
ys = [p[1] for p in positions]

# ---- targets ----
DELTA_SCALE = 2000.0
AXES = {'thin': 'averagemuscle-minweight', 'fat': 'averagemuscle-maxweight',
        'skinny': 'minmuscle-averageweight', 'muscle': 'maxmuscle-averageweight'}
targets = {}
# Sex shape: MakeHuman's neutral base + the average of its three ethnic
# young-<sex> targets (the app's default 1/3 each) gives an average adult of that sex.
ETHNIC = ('african', 'asian', 'caucasian')
for sex in ('male', 'female'):
    acc = {}
    for eth in ETHNIC:
        for line in open(os.path.join(src, '%s-%s-young.target' % (eth, sex))):
            if line.startswith('#') or not line.strip(): continue
            i, dx, dy, dz = line.split()[:4]
            i = int(i)
            if i not in remap: continue
            a = acc.setdefault(remap[i], [0.0, 0.0, 0.0])
            a[0] += float(dx) / len(ETHNIC); a[1] += float(dy) / len(ETHNIC); a[2] += float(dz) / len(ETHNIC)
    ids = sorted(acc); ds = []
    for i in ids: ds.extend(int(round(v * DELTA_SCALE)) for v in acc[i])
    assert max(map(abs, ds)) < 32767, sex
    targets['%s_base' % sex] = {'i': b64('H', ids), 'd': b64('h', ds)}
for sex in ('male', 'female'):
    for key, name in AXES.items():
        path = os.path.join(src, 'universal-%s-young-%s.target' % (sex, name))
        ids, ds = [], []
        for line in open(path):
            if line.startswith('#') or not line.strip(): continue
            i, dx, dy, dz = line.split()[:4]
            i = int(i)
            if i not in remap: continue
            ids.append(remap[i])
            ds.extend(int(round(float(v) * DELTA_SCALE)) for v in (dx, dy, dz))
        assert max(map(abs, ds)) < 32767, (sex, key)
        targets['%s_%s' % (sex, key)] = {'i': b64('H', ids), 'd': b64('h', ds)}

data = {
    'posScale': POS_SCALE, 'deltaScale': DELTA_SCALE,
    'nVerts': len(positions), 'yMin': min(ys), 'yMax': max(ys),
    'pos': b64('h', flat),
    'tris': b64('H', tris),
    'groups': {'body': [0, len(body_tris)], 'shorts': [len(body_tris), len(shorts_tris)],
               'top': [len(body_tris) + len(shorts_tris), len(top_tris)]},
    'targets': targets,
    'credit': 'Figure built from the MakeHuman base mesh and macro targets (CC0, makehumancommunity.org).',
}
import json
js = 'window.BODY_DATA=' + json.dumps(data, separators=(',', ':')) + ';\n'
open(out, 'w').write(js)
print('verts %d  body tris %d  shorts tris %d  top tris %d  out %.0f KB' % (len(positions), len(body_tris)//3, len(shorts_tris)//3, len(top_tris)//3, len(js)/1024))
for k, v in targets.items(): print('  %-14s %5d verts' % (k, len(base64.b64decode(v['i'])) // 2))
