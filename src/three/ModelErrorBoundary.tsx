import React from 'react';

interface Props {
  children: React.ReactNode;
  /** Reset the caught error whenever this changes (e.g. a new model URL is selected). */
  resetKey: string;
}

interface State {
  hasError: boolean;
}

/**
 * Contains a failed GLB load to the 3D viewer panel instead of crashing the whole page
 * (spec §3: "GLB 로딩 실패 시 명확한 fallback"). React error boundaries work across the
 * react-three-fiber boundary, so this can wrap <Canvas> directly.
 */
export class ModelErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('3D 모델을 불러오지 못했습니다:', error);
  }

  componentDidUpdate(prevProps: Props) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-6 text-center">
          <p className="eyebrow text-stone">MODEL LOAD ERROR</p>
          <p className="max-w-xs text-sm text-graphite">
            3D 모델을 불러오지 못했습니다. 파일이 손상되었거나 지원되지 않는 형식일 수 있습니다.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
