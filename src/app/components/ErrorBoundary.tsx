import { Component, type ReactNode } from 'react';
import { t } from '@/i18n';

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(e: unknown) { console.error('UI error:', e); }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" style={{ maxWidth: 480, margin: '15vh auto', padding: 24, textAlign: 'center', fontFamily: 'inherit' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>{t('common.errorTitle')}</h1>
        <p style={{ margin: '12px 0 20px' }}>{t('common.errorBody')}</p>
        <button onClick={() => location.reload()} style={{ minHeight: 44, padding: '0 20px', borderRadius: 12, background: '#006A4E', color: '#fff', fontWeight: 600 }}>{t('common.retry')}</button>
      </div>
    );
  }
}
