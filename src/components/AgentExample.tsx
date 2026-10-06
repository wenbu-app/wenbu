import { useState } from 'react';
import { ArrowLeft, ArrowUpRight, BookOpen, Compass } from 'lucide-react';
import type { Locale } from '../lib/schema';
import { href } from '../lib/i18n';
import { track } from '../lib/analytics';

/** Editorial examples. Opening or switching never invokes the agent or consumes a turn. */
export default function AgentExample({
  locale,
  onStart,
  onPractice,
}: {
  locale: Locale;
  onStart: () => void;
  onPractice: (kind: 'tarot' | 'research') => void;
}) {
  const [kind, setKind] = useState<'tarot' | 'research'>('tarot');
  const t = (zh: string, en: string) => (locale === 'zh' ? zh : en);
  return (
    <section className="agent-example" aria-label={t('完整示例', 'Complete example')}>
      <span className="eyebrow">{t('先看一份示例', 'A PREVIEW OF YOUR EXPLORATION')}</span>
      <div className="agent-example-tabs" role="group" aria-label={t('选择示例', 'Choose an example')}>
        <button
          type="button"
          aria-pressed={kind === 'tarot'}
          onClick={() => {
            setKind('tarot');
            track('agent_example_opened', { tool: 'agent', action: 'example', mode: 'explore' });
          }}
        >
          <Compass size={15} />
          {t('塔罗反思', 'Tarot reflection')}
        </button>
        <button
          type="button"
          aria-pressed={kind === 'research'}
          onClick={() => {
            setKind('research');
            track('agent_example_opened', { tool: 'agent', action: 'example', mode: 'research' });
          }}
        >
          <BookOpen size={15} />
          {t('有依据的解答', 'A sourced answer')}
        </button>
      </div>
      <p className="agent-example-label">
        {t(
          '编辑示例 · 不消耗回合 · 不是你的个人结果',
          'Editorial example · No turns used · Not a personal reading',
        )}
      </p>
      <button className="agent-example-practice" type="button" onClick={() => onPractice(kind)}>
        <Compass size={16} aria-hidden="true" />
        {kind === 'tarot'
          ? t('抽一张自己的牌 · 1 回合', 'Try your own card · 1 turn')
          : t('用我的资料看八字', 'Explore my own BaZi chart')}
        <ArrowUpRight size={15} aria-hidden="true" />
      </button>
      {kind === 'tarot' ? (
        <>
          <div className="agent-example-intro">
            <img
              src="/images/tarot/17-star-small.webp"
              width="136"
              height="224"
              alt={t('示例选用的星星牌，正位', 'The Star, upright, selected for this example')}
            />
            <div>
              <span className="eyebrow">XVII · THE STAR</span>
              <h2>{t('想换工作，又担心选错。', 'Ready for a change, worried about the choice.')}</h2>
              <p>
                {t(
                  '把“会不会成功”换成“我能先验证什么”。',
                  'Turn “Will it work out?” into “What can I check first?”',
                )}
              </p>
            </div>
          </div>
          <div className="agent-example-summary">
            <strong>{t('先看结论', 'Start here')}</strong>
            <p>
              {t(
                '这里用“星星”的希望与修复意象，帮助整理期待。它不能判断新工作的好坏，更不能替你作决定。',
                'The Star’s traditional themes of hope and renewal can help you examine your expectations. The card cannot assess a job offer or decide for you.',
              )}
            </p>
          </div>
          <ol className="agent-example-points">
            <li>
              <strong>{t('想保留什么', 'What matters to you')}</strong>
              <p>
                {t(
                  '写下新工作必须满足的一项条件，例如可持续的工作节奏。',
                  'Name one condition a new role must meet, such as a sustainable workload.',
                )}
              </p>
            </li>
            <li>
              <strong>{t('哪些只是期待', 'What is still an assumption')}</strong>
              <p>
                {t(
                  '把“团队应该更好”改成可以向未来同事核实的问题。',
                  'Turn “The team should be better” into a question you can ask a future colleague.',
                )}
              </p>
            </li>
            <li>
              <strong>{t('先做一个小动作', 'One manageable step')}</strong>
              <p>
                {t(
                  '约一次交流，了解真实的一周如何安排，再回来比较。',
                  'Arrange a conversation about a typical working week, then revisit your comparison.',
                )}
              </p>
            </li>
          </ol>
          <details>
            <summary>{t('示例方法与局限', 'How this example works')}</summary>
            <p>
              {t(
                '这是编辑选定的一张正位牌，没有随机抽取。象征解读用来提出问题；工作判断仍需职位信息、实际沟通和你自己的偏好。',
                'This upright card was selected by an editor, not randomly drawn. Symbolic reflection suggests questions; a career decision still needs job details, real conversations and your own priorities.',
              )}
            </p>
            <a href={href(locale, 'learn/tarot-beginner')}>
              {t('阅读塔罗入门', 'Read the tarot introduction')} <ArrowUpRight size={13} />
            </a>
          </details>
        </>
      ) : (
        <>
          <div className="agent-example-research-mark" aria-hidden="true">
            <span>年</span>
            <span>月</span>
            <span>日</span>
            <span>时</span>
          </div>
          <h2>{t('不知道出生时刻，还能看八字吗？', 'Can I explore BaZi without a birth time?')}</h2>
          <div className="agent-example-summary">
            <strong>
              {t('可以先看三柱，但要保留边界。', 'Start with three pillars, with clear limits.')}
            </strong>
            <p>
              {t(
                '在问卜中可以将出生时间留空，不会擅自补一个时柱。年、月、日的结果也可能在换日或节气附近存在不确定性。',
                'Wenbu lets you leave the time blank and does not invent an hour pillar. The year, month or day may still be uncertain near a day or solar-term boundary.',
              )}
            </p>
          </div>
          <ol className="agent-example-points">
            <li>
              <strong>{t('需要的资料', 'What you need')}</strong>
              <p>
                {t(
                  '公历出生日期和出生地时区；不知道时刻就如实留空。',
                  'A Gregorian birth date and the timezone at the place of birth. Leave an unknown time blank.',
                )}
              </p>
            </li>
            <li>
              <strong>{t('可以做什么', 'What you can explore')}</strong>
              <p>
                {t(
                  '先学习三柱的结构与术语，把排盘事实和后续解读分开。',
                  'Learn the three-pillar structure and vocabulary, keeping calculated facts separate from interpretation.',
                )}
              </p>
            </li>
            <li>
              <strong>{t('不能补什么', 'What stays unknown')}</strong>
              <p>
                {t(
                  '不能据此推定出生时刻；紫微斗数仍需要已知时间。',
                  'This does not establish your birth time. Zi Wei still requires a known time.',
                )}
              </p>
            </li>
          </ol>
          <div className="agent-example-source">
            <BookOpen size={16} />
            <div>
              <strong>{t('依据与进一步阅读', 'Sources and further reading')}</strong>
              <a href={href(locale, 'learn/unknown-birth-time')}>
                {t('问卜手册：出生时间不确定', 'Wenbu guide: unknown birth time')} <ArrowUpRight size={13} />
              </a>
              <a href={href(locale, 'learn/birth-time-timezone')}>
                {t('出生时区与计算约定', 'Birth timezone and calculation conventions')}{' '}
                <ArrowUpRight size={13} />
              </a>
              <p>
                {t(
                  '以上说明问卜的计算边界，不是对命理预测有效性的科学验证。',
                  'These sources explain Wenbu’s calculation limits; they do not scientifically validate divinatory predictions.',
                )}
              </p>
            </div>
          </div>
        </>
      )}
      <button type="button" className="agent-example-start" onClick={onStart}>
        <ArrowLeft size={16} />
        {t('开始我的问题', 'Start with my own question')}
      </button>
    </section>
  );
}
