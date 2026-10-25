import { it, expect } from 'vitest';
import { guideEntryFromIndex } from '../src/lib/guide-entry';
import { titleParts } from '../src/lib/reading-type';
const guide = {
  id: 'guide-bazi-basics',
  slug: 'bazi-basics',
  translations: [
    { locale: 'en', title: 'Read the four pillars', html: 'https://wenbu.app/en/learn/bazi-basics/' },
  ],
};
it('resolves only an exact public catalogue entry for the selected language', () => {
  expect(guideEntryFromIndex({ guides: [guide] }, 'bazi-basics', 'en')).toEqual({
    id: guide.id,
    title: guide.translations[0].title,
    url: guide.translations[0].html,
  });
  expect(guideEntryFromIndex({ guides: [guide] }, 'bazi-basics', 'zh')).toBeNull();
  expect(guideEntryFromIndex({ guides: [guide] }, 'https://example.com/', 'en')).toBeNull();
  expect(
    guideEntryFromIndex(
      {
        guides: [
          {
            ...guide,
            translations: [{ ...guide.translations[0], html: 'https://example.com/en/learn/bazi-basics/' }],
          },
        ],
      },
      'bazi-basics',
      'en',
    ),
  ).toBeNull();
  expect(guideEntryFromIndex(null, 'bazi-basics', 'en')).toBeNull();
});
it('keeps short Chinese terms together without changing content or English wrapping', () => {
  const title = '八字、易经、塔罗与紫微斗数：真太阳时是什么？';
  expect(
    titleParts(title)
      .map((part) => part.text)
      .join(''),
  ).toBe(title);
  expect(
    titleParts(title)
      .filter((part) => part.keep)
      .map((part) => part.text),
  ).toEqual(['八字', '易经', '塔罗', '紫微斗数', '真太阳时']);
  expect(titleParts('Read the four pillars')).toEqual([{ text: 'Read the four pillars', keep: false }]);
});
