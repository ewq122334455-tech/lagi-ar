import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('LAGI application error:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-paper px-6 text-center text-ink">
          <p className="eyebrow">오류</p>
          <h1 className="text-2xl font-medium">예상하지 못한 문제가 발생했습니다</h1>
          <p className="max-w-md text-sm text-graphite">
            페이지를 새로고침해 주세요. 문제가 계속되면 잠시 후 다시 시도해 주세요.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-2 border border-ink px-6 py-3 text-sm tracking-widest hover:bg-ink hover:text-paper focus-ring"
          >
            새로고침
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
