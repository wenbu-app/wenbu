import type { Locale } from '../lib/schema';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
export default function AgentMarkdown({
  text,
  allowedUrls = [],
  locale = 'zh',
}: {
  text: string;
  allowedUrls?: string[];
  locale?: Locale;
}) {
  return (
    <Markdown
      remarkPlugins={[remarkGfm]}
      skipHtml
      disallowedElements={['img', 'iframe', 'script', 'style', 'input']}
      components={{
        table: ({ children }) => (
          <div
            className="agent-table-scroll"
            role="region"
            tabIndex={0}
            aria-label={
              locale === 'zh'
                ? '结果表格，可横向滚动'
                : 'Result table. Scroll horizontally to read all columns.'
            }
          >
            <table>{children}</table>
          </div>
        ),
        a: ({ href, children }) =>
          href && allowedUrls.includes(href) ? (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children} ↗
            </a>
          ) : (
            <span>{children}</span>
          ),
      }}
    >
      {text}
    </Markdown>
  );
}
