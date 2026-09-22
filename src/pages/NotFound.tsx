import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="eyebrow">404</p>
      <h1 className="text-2xl font-medium">페이지를 찾을 수 없습니다</h1>
      <Link to="/" className="eyebrow mt-2 border border-ink px-6 py-3 hover:bg-ink hover:text-paper focus-ring">
        홈으로
      </Link>
    </div>
  );
}
