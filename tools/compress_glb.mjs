// Сжатие GLB из Meshy: node tools/compress_glb.mjs in.glb out.glb <треугольников> <текстура px> (нужны пакеты: @gltf-transform/core extensions functions meshoptimizer sharp)
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weld, simplify, prune, dedup, textureCompress, quantize, meshopt, flatten, join } from '@gltf-transform/functions';
import { MeshoptSimplifier, MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';
await MeshoptSimplifier.ready; await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const [inp, out, tris, tex] = process.argv.slice(2);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const doc = await io.read(inp);
const root = doc.getRoot();
for (const m of root.listMaterials()) { m.setNormalTexture(null); m.setOcclusionTexture(null); m.setMetallicRoughnessTexture(null); m.setEmissiveTexture(null); m.setMetallicFactor(0); m.setRoughnessFactor(1); }
let cur = 0; for (const mesh of root.listMeshes()) for (const p of mesh.listPrimitives()) cur += p.getIndices().getCount() / 3;
const ratio = Math.min(1, +tris / cur);
await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.004, lockBorder: false }), prune(), dedup(),
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [+tex, +tex], quality: 82 }), quantize(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
await io.write(out, doc);
let after = 0; for (const mesh of doc.getRoot().listMeshes()) for (const p of mesh.listPrimitives()) after += p.getIndices().getCount() / 3;
console.log(inp.split('/').pop(), 'tris', Math.round(cur), '->', Math.round(after));
