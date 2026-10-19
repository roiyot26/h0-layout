#!/usr/bin/env node
// Checks GLB files against the asset rules:
//   - EXT_meshopt_compression and KHR_texture_basisu are used,
//   - every texture is KTX2,
//   - the file decodes (meshopt decoder), and triangle and draw counts are within caps,
//   - no embedded images, unless the file is a self-contained test fixture
//     (path under test/fixtures/), where the KTX2 is embedded on purpose.
//
//   node scripts/glb-check.mjs <file.glb> [--max-tris N] [--max-draws N]
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const files = args.filter((a, i) => !a.startsWith('--') && !(args[i - 1] ?? '').startsWith('--'));
const opt = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 ? Number(args[i + 1]) : dflt;
};
const maxTris = opt('--max-tris', 250000);
const maxDraws = opt('--max-draws', 120);

await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });

let failed = false;
const fail = (file, msg) => {
  failed = true;
  console.error(`glb-check: ${file}: ${msg}`);
};

for (const file of files) {
  const bin = readFileSync(file);
  const json = JSON.parse(bin.subarray(20, 20 + bin.readUInt32LE(12)).toString('utf8'));
  const used = json.extensionsUsed ?? [];
  for (const ext of ['EXT_meshopt_compression', 'KHR_texture_basisu']) {
    if (!used.includes(ext)) fail(file, `${ext} not used`);
  }
  const fixture = file.replace(/\\/g, '/').includes('test/fixtures/');
  for (const img of json.images ?? []) {
    if (img.mimeType !== 'image/ktx2' && !(img.uri ?? '').endsWith('.ktx2')) fail(file, 'texture is not KTX2');
    if (img.bufferView !== undefined && !fixture) fail(file, 'embedded image');
  }

  const doc = await io.read(file);
  let tris = 0;
  let draws = 0;
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      draws++;
      const idx = prim.getIndices();
      tris += (idx ? idx.getCount() : prim.getAttribute('POSITION').getCount()) / 3;
    }
  }
  if (tris > maxTris) fail(file, `${tris} tris > ${maxTris}`);
  if (draws > maxDraws) fail(file, `${draws} draws > ${maxDraws}`);
  console.log(`glb-check: ${file}: ${tris} tris, ${draws} draw(s), extensions ${used.join(', ')}`);
}
if (!files.length) fail('-', 'no files given');
process.exit(failed ? 1 : 0);
