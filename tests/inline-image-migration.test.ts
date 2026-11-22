import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decodeInlineImage, transferInlineImage } from '../src/lib/inline-image-migration';
const original='data:image/png;base64,'+Buffer.from([137,80,78,71,13,10,26,10,1]).toString('base64');
test('legacy images are decoded strictly with deterministic content-addressed names', () => {
  assert.equal(decodeInlineImage(original).hash,decodeInlineImage(original).hash);
  assert.equal(decodeInlineImage(original).type,'image/png');
  for(const value of ['data:image/svg+xml;base64,PHN2Zz4=','data:image/png;base64,abcd','data:image/png;base64,???']) assert.throws(()=>decodeInlineImage(value));
});
test('failed upload never changes the original database reference', async () => {
  let replaced=false;
  await assert.rejects(()=>transferInlineImage(original,'legacy/movie/1/poster',async()=>{throw Error('network')},async()=>{replaced=true;return true}));
  assert.equal(replaced,false);
});
test('transfer uploads first and uses compare-and-swap; concurrent edits are preserved', async () => {
  const steps:string[]=[];let path='';
  const result=await transferInlineImage(original,'legacy/movie/1/poster',async(name,bytes,type)=>{path=name;assert(bytes.length>0);assert.equal(type,'image/png');steps.push('upload');return 'https://storage.test/'+name},async(url,expected)=>{steps.push('compare');assert.equal(expected,original);assert.equal(url,'https://storage.test/'+path);return false});
  assert.deepEqual(steps,['upload','compare']);assert.equal(result,false);assert.match(path,/poster-[a-f0-9]{64}\.png$/);
});
