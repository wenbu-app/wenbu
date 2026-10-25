// Keep short domain terms together without preventing normal CJK line wrapping.
const terms = /(真太阳时|紫微斗数|紫微|八字|易经|塔罗|四柱|日主|正逆位)/g;
export function titleParts(value: string) {
  return value
    .split(terms)
    .filter(Boolean)
    .map((text) => ({
      text,
      keep: /^(真太阳时|紫微斗数|紫微|八字|易经|塔罗|四柱|日主|正逆位)$/.test(text),
    }));
}
