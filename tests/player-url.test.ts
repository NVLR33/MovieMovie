import { test } from 'node:test';
import assert from 'node:assert/strict';
import { playerEmbedUrl } from '../src/lib/player-url';
test('supported player URLs normalize to known HTTPS embeds without tracking parameters', () => {
  for (const url of ['https://youtu.be/abcdefghijk?si=tracking','https://www.youtube.com/watch?v=abcdefghijk&list=abc','https://www.youtube.com/embed/abcdefghijk']) assert.equal(playerEmbedUrl(url),'https://www.youtube-nocookie.com/embed/abcdefghijk');
  assert.equal(playerEmbedUrl('https://rutube.ru/video/abc123/'),'https://rutube.ru/play/embed/abc123');
  assert.equal(playerEmbedUrl('https://vk.com/video_ext.php?oid=-1&id=2&hash=abc'),'https://vk.com/video_ext.php?oid=-1&id=2&hash=abc');
});
test('iframe URLs cannot be same-origin pages, arbitrary domains, lookalikes or scripts', () => {
  for (const value of ['javascript:alert(1)','data:text/html,test','http://www.youtube.com/embed/abcdefghijk','https://youtube.com.evil.test/watch?v=abcdefghijk','https://test.local/api/action','/catalog','https://user:pass@youtube.com/watch?v=abcdefghijk','https://rutube.ru/not-a-video','https://www.youtube.com/embed/<script>','https://vk.com/video_ext.php?oid=abc&id=2']) assert.equal(playerEmbedUrl(value),null,value);
});
