import { Component, ReactNode, ErrorInfo } from 'react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

/**
 * React Error Boundary 컴포넌트
 * 하위 컴포넌트에서 발생한 에러를 캐치하여 사용자에게 친화적인 에러 화면 표시
 */
class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
        };
    }

    static getDerivedStateFromError(error: Error): Partial<State> {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        // 에러 로깅
        console.error('ErrorBoundary caught an error:', error, errorInfo);

        this.setState({
            error,
            errorInfo,
        });
    }

    handleReset = () => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null,
        });

        // 페이지 새로고침
        window.location.href = '/';
    };

    render() {
        if (this.state.hasError) {
            // 커스텀 fallback이 있으면 사용
            if (this.props.fallback) {
                return this.props.fallback;
            }

            // 기본 에러 화면
            return (
                <div className="flex h-screen w-screen items-center justify-center bg-gradient-to-br from-slate-900 to-slate-950 text-white">
                    <div className="max-w-md space-y-6 rounded-2xl border border-white/10 bg-black/40 p-8 text-center backdrop-blur">
                        <div className="space-y-2">
                            <h1 className="text-3xl font-bold text-red-400">오류 발생</h1>
                            <p className="text-sm text-slate-300">
                                게임을 실행하는 중 문제가 발생했습니다.
                            </p>
                        </div>

                        {import.meta.env.DEV && this.state.error && (
                            <div className="space-y-2 text-left">
                                <p className="text-xs font-mono text-red-300">
                                    {this.state.error.toString()}
                                </p>
                                {this.state.errorInfo && (
                                    <details className="text-xs text-slate-400">
                                        <summary className="cursor-pointer hover:text-slate-300">
                                            상세 정보 보기
                                        </summary>
                                        <pre className="mt-2 overflow-auto rounded bg-black/50 p-2">
                                            {this.state.errorInfo.componentStack}
                                        </pre>
                                    </details>
                                )}
                            </div>
                        )}

                        <button
                            onClick={this.handleReset}
                            className="w-full rounded-lg border border-white/20 bg-white/10 px-6 py-3 font-semibold transition-all hover:bg-white/20 active:scale-95"
                        >
                            처음으로 돌아가기
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
