import { useEffect, useState } from 'react';
import { analyticsEnabled, setAnalyticsEnabled } from '../lib/analytics';
import type { Locale } from '../lib/schema';
export default function AnalyticsPreference({ locale }: { locale: Locale }) {
  const [enabled, setEnabled] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setEnabled(analyticsEnabled());
    setBlocked(
      navigator.doNotTrack === '1' ||
        Boolean((navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl),
    );
    setReady(true);
  }, []);
  return (
    <aside className="analytics-preference">
      <h2>{locale === 'zh' ? '本浏览器的统计偏好' : 'Measurement preference for this browser'}</h2>
      <label>
        <input
          type="checkbox"
          checked={enabled}
          disabled={!ready || blocked}
          onChange={(event) => {
            setAnalyticsEnabled(event.target.checked);
            setEnabled(analyticsEnabled());
          }}
        />
        {locale === 'zh' ? '允许使用统计与交互分析' : 'Allow usage measurement and interaction analysis'}
      </label>
      <p role="status">
        {!ready
          ? locale === 'zh'
            ? '正在读取本浏览器的偏好…'
            : 'Reading this browser’s preference…'
          : blocked
            ? locale === 'zh'
              ? '浏览器的隐私信号已关闭统计。'
              : 'Your browser privacy signal has disabled measurement.'
            : enabled
              ? locale === 'zh'
                ? '已开启。记录功能使用，并通过 Microsoft Clarity 分析页面交互；私人内容会遮罩。'
                : 'Enabled. Measures feature use and page interactions with Microsoft Clarity. Private content is masked.'
              : locale === 'zh'
                ? '已关闭。工具和对话仍可正常使用。'
                : 'Disabled. Tools and conversations continue to work.'}
      </p>
    </aside>
  );
}
