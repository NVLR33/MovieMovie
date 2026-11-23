import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractPalette,
  paletteTokens,
  contrast,
  type RGB,
  type AmbientPalette,
} from '../src/lib/ambient-palette';
import { ambientImageSource } from '../src/lib/ambient-image';
function pixels(...colors: RGB[]) {
  return new Uint8ClampedArray(colors.flatMap((color) => [...color, 255]));
}
const orange: RGB = [235, 102, 30],
  blue: RGB = [20, 75, 205],
  pink: RGB = [238, 100, 176];
test('dominant orange/blue colors survive white lettering and dark poster margins', () => {
  const data = pixels(
    ...Array<RGB>(100).fill([0, 0, 0]),
    ...Array<RGB>(70).fill(orange),
    ...Array<RGB>(35).fill(blue),
    ...Array<RGB>(30).fill([255, 255, 255]),
  );
  const palette = extractPalette(data)!;
  assert.deepEqual(palette.primary, orange);
  assert.deepEqual(palette.secondary, blue);
  assert.deepEqual(extractPalette(data), palette);
});
test('single-color pink and black/white artwork do not invent unrelated dominant hues', () => {
  const palette = extractPalette(pixels(...Array<RGB>(100).fill(pink)))!;
  assert.deepEqual(palette.primary, pink);
  assert(palette.secondary[0] > palette.secondary[1]);
  const grayscale = extractPalette(
    pixels(
      ...Array<RGB>(50).fill([0, 0, 0]),
      ...Array<RGB>(50).fill([255, 255, 255]),
    ),
  )!;
  assert.equal(grayscale.primary[0], grayscale.primary[1]);
  assert.equal(grayscale.secondary[1], grayscale.secondary[2]);
});
test('empty/transparent/incomplete samples are safe and tiny highlights do not dominate', () => {
  assert.equal(extractPalette([]), null);
  assert.equal(extractPalette([1, 2, 3]), null);
  assert.equal(extractPalette([255, 0, 0, 0]), null);
  const data = pixels(...Array<RGB>(1000).fill(blue), [255, 0, 0]);
  assert.deepEqual(extractPalette(data)!.primary, blue);
});
const parse = (value: string) =>
  value.match(/\d+/g)!.slice(0, 3).map(Number) as unknown as RGB;
test('palette tokens maintain AA contrast on dark/light backgrounds and surfaces, including primary actions', () => {
  const colors: RGB[] = [
    orange,
    blue,
    pink,
    [255, 255, 0],
    [0, 0, 0],
    [255, 255, 255],
    [5, 245, 50],
    [20, 0, 50],
    [128, 128, 128],
  ];
  for (const color of colors)
    for (const light of [false, true]) {
      const palette: AmbientPalette = {
        primary: color,
        secondary: blue,
        tertiary: pink,
      };
      const tokens = paletteTokens(palette, light);
      for (const bg of [
        '--ambient-bg',
        '--ambient-surface',
        '--ambient-surface2',
        '--ambient-surface3',
      ]) {
        for (const fg of [
          '--ambient-text',
          '--ambient-muted',
          '--ambient-subtle',
          '--ambient-accent',
          '--ambient-accent2',
        ])
          assert(
            contrast(parse(tokens[bg]), parse(tokens[fg])) >= 4.5,
            `${light} ${color}: ${bg}/${fg}`,
          );
      }
      for (const accent of ['--ambient-accent', '--ambient-accent2'])
        assert(
          contrast(
            parse(tokens[accent]),
            parse(tokens['--ambient-on-accent']),
          ) >= 4.5,
        );
      assert(
        !Object.keys(tokens).some((key) =>
          ['--red', '--gold', '--green'].includes(key),
        ),
      );
    }
});
test('image extraction accepts only safe relative or HTTP(S) references', () => {
  assert.equal(ambientImageSource('/posters/a.png'), '/posters/a.png');
  assert.equal(
    ambientImageSource('https://example.test/a.png'),
    'https://example.test/a.png',
  );
  for (const source of [
    undefined,
    null,
    '',
    'data:image/png;base64,x',
    'blob:test',
    'javascript:alert(1)',
    '//evil.test/a',
    'https://user:secret@test/a',
    'https://test/\n.png',
    '/\\evil.test/a',
  ])
    assert.equal(ambientImageSource(source), null);
});
