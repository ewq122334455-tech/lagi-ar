import { Link } from 'react-router-dom';
import { LagiLogo } from '@/components/LagiLogo';

const COLUMNS: { title: string; links: { label: string; to: string; external?: boolean }[] }[] = [
  {
    title: '쇼핑',
    links: [
      { label: '전체 상품', to: '/products' },
      { label: 'LAGI 랭킹', to: '/products?sort=ranking' },
      { label: '가상 피팅', to: '/products?filter=tryon' },
      { label: '다시 조합', to: '/again' },
    ],
  },
  {
    title: '브랜드',
    links: [
      { label: '브랜드 소개', to: '/about' },
      { label: '스토리', to: '/story' },
      { label: '소재', to: '/materials' },
    ],
  },
  {
    title: '채널',
    links: [
      { label: '네이버 스마트스토어', to: 'https://smartstore.naver.com/lagi_official', external: true },
      { label: '인스타그램 @lagi.official', to: 'https://www.instagram.com/lagi.official/', external: true },
    ],
  },
];

export function Footer() {
  return (
    <footer className="mt-10 bg-mist px-4 pb-10 pt-12 text-graphite lg:px-10">
      <div className="flex flex-col gap-10 lg:flex-row lg:justify-between">
        <div>
          <LagiLogo className="h-5 w-auto text-ink" />
          <p className="mt-2 text-sm">lagi = 다시 · Look closer, again.</p>
          <p className="mt-1 text-xs text-stone">구매와 결제는 공식 네이버 스마트스토어에서 진행됩니다.</p>
        </div>
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:gap-16">
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <p className="mb-3 text-[13px] font-bold text-ink">{col.title}</p>
              <ul className="space-y-2 text-[13px]">
                {col.links.map((l) => (
                  <li key={l.label}>
                    {l.external ? (
                      <a href={l.to} target="_blank" rel="noopener noreferrer" className="hover:text-ink focus-ring">
                        {l.label}
                      </a>
                    ) : (
                      <Link to={l.to} className="hover:text-ink focus-ring">
                        {l.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5 text-[11px] text-stone">
        <p>© {new Date().getFullYear()} LAGI. 사이트의 제품 정보는 브랜드가 제공한 내용만 표시합니다.</p>
        <div className="flex gap-4">
          <Link to="/exhibition" className="hover:text-ink focus-ring">
            전시 모드
          </Link>
          <Link to="/workspace" className="hover:text-ink focus-ring">
            관리자
          </Link>
        </div>
      </div>
    </footer>
  );
}
