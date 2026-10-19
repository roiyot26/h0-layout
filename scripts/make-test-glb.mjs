#!/usr/bin/env node
// Builds test/fixtures/cube.glb: a 12-triangle cube, meshopt-compressed and
// quantised, whose base colour texture is an external KTX2 file (cube.ktx2).
// Only needed when the fixture changes; CI inspects the committed files.
//
//   toktx --t2 --encode etc1s test/fixtures/cube.ktx2 <8x8 png>
//   node scripts/make-test-glb.mjs
import { readFileSync } from 'node:fs';
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRTextureBasisu } from '@gltf-transform/extensions';
import { meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';

const dir = 'test/fixtures';
const doc = new Document();
const buffer = doc.createBuffer();
doc.createExtension(KHRTextureBasisu).setRequired(true);

const p = [];
const uv = [];
const idx = [];
const faces = [
  [[1, 0, 0], [0, 1, 0], [0, 0, 1]], [[-1, 0, 0], [0, 1, 0], [0, 0, -1]],
  [[0, 1, 0], [1, 0, 0], [0, 0, -1]], [[0, -1, 0], [1, 0, 0], [0, 0, 1]],
  [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, -1], [-1, 0, 0], [0, 1, 0]],
];
for (const [n, u, v] of faces) {
  const base = p.length / 3;
  for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    for (let k = 0; k < 3; k++) p.push(0.05 * (n[k] + a * u[k] + b * v[k]));
    uv.push((a + 1) / 2, (1 - b) / 2);
  }
  idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
}

const texture = doc.createTexture('cube')
  .setImage(new Uint8Array(readFileSync(`${dir}/cube.ktx2`)))
  .setMimeType('image/ktx2')
  .setURI('cube.ktx2');
const material = doc.createMaterial('cube').setBaseColorTexture(texture);
const prim = doc.createPrimitive()
  .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(p)).setBuffer(buffer))
  .setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(new Float32Array(uv)).setBuffer(buffer))
  .setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint16Array(idx)).setBuffer(buffer))
  .setMaterial(material);
const mesh = doc.createMesh('cube').addPrimitive(prim);
doc.createScene('test').addChild(doc.createNode('cube').setMesh(mesh));

await MeshoptEncoder.ready;
await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium' }));

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
await io.write(`${dir}/cube.glb`, doc);
console.log('wrote', `${dir}/cube.glb`);
