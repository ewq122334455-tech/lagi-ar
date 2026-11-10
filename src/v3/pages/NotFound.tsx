import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="flex min-h-[70svh] flex-col justify-center px-page pt-page">
      <h1 className="t-display t-mark">
        404<span className="sr-only"> 페이지를 찾을 수 없습니다</span>
      </h1>
      <p className="t-en mt-4">This page is not here.</p>
      <p className="t-kr-sub mt-2">페이지를 찾을 수 없습니다. 주소를 확인하거나 홈에서 다시 시작해 주세요.</p>
      <div className="t-nav kr mt-8 flex gap-6">
        <Link to="/" className="tag tag-ink">
          홈으로
        </Link>
        <Link to="/discover" className="tag tag-ink">
          제품 보기
        </Link>
      </div>
    </div>
  );
}
