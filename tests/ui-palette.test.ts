import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../src/styles/global.css', import.meta.url), 'utf8');
const token = (name: string) => {
  const value = css.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6});`, 'i'))?.[1];
  if (!value) throw new Error(`Missing palette token: ${name}`);
  return value;
};
function luminance(hex: string) {
  return [1, 3, 5]
    .map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255)
    .reduce(
      (sum, value, index) =>
        sum +
        [0.2126, 0.7152, 0.0722][index] *
          (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4),
      0,
    );
}

describe('shared paper palette readability', () => {
  it('normal text retains at least 4.5:1 contrast on shared paper surfaces', () => {
    for (const foreground of ['ink', 'muted', 'warm-muted', 'red']) {
      for (const background of ['paper', 'paper-light', 'sage']) {
        const a = luminance(token(foreground)),
          b = luminance(token(background));
        expect(
          (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
          `${foreground} on ${background}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});
