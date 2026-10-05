import { Component, type ReactNode } from 'react';
export default class RecordBoundary extends Component<
  { children: ReactNode; locale: 'zh' | 'en' },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <p className="error-message" role="status">
        {this.props.locale === 'zh'
          ? '这份旧记录的图表格式无法显示。原始内容仍可导出；请重新排盘获取最新图表。'
          : 'This older chart cannot be displayed. You can still export its original data or calculate a new chart.'}
      </p>
    ) : (
      this.props.children
    );
  }
}
