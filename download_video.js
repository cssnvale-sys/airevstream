const { getStorageClient, downloadBuffer, presignUrl } = require('./packages/storage/dist/index.js');
const fs = require('fs');
async function main() {
  const buf = await downloadBuffer('airevstream-production', 'videos/12d6cadf-fd46-4dfb-94fb-8a548cdc2301/1782763964859.mp4');
  fs.writeFileSync('/tmp/airevstream_final.mp4', buf);
  console.log('Downloaded:', buf.length, 'bytes');
}
main().catch(e => console.log('Error:', e.message));
