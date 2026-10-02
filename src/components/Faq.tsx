import { useState } from 'react';
import { ContentBadge } from '@/components/ContentBadge';

type Entry = { q: string; a: string | null };

/**
 * Answers about how this site works are things LAGI can state from the code itself.
 * Answers about the brand's own policies are not, so they stay unanswered and are
 * labelled rather than invented.
 */
const ENTRIES: Entry[] = [
  {
    q: 'AR로 보려면 따로 앱을 설치해야 하나요?',
    a: '아니요. 휴대폰 브라우저에서 바로 실행됩니다. 처음 한 번 카메라 권한만 허용하면 되고, iOS Safari와 Android Chrome 모두 지원합니다.',
  },
  {
    q: 'AR 화면에서 제품을 어떻게 조작하나요?',
    a: '한 손가락으로 끌면 돌아가고, 두 손가락을 벌리거나 모으면 크기가 바뀝니다. 꾹 누른 뒤 끌면 제품 위치를 옮길 수 있습니다.',
  },
  {
    q: '3D 모델은 실제 제품과 똑같나요?',
    a: '아닙니다. 현재 3D 모델은 제품 사진과 사양 시트를 보고 손으로 만든 재현물이며, 실측 스캔이 아닙니다. 색상과 비례는 참고용으로 봐주세요.',
  },
  {
    q: '결제는 어디서 이루어지나요?',
    a: '주문하기를 누르면 LAGI 공식 스마트스토어로 이동합니다. 이 사이트는 결제를 직접 처리하지 않습니다.',
  },
  { q: '배송은 얼마나 걸리나요?', a: null },
  { q: '교환과 반품은 어떻게 하나요?', a: null },
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="divide-y divide-line border-y border-line">
      {ENTRIES.map((e, i) => {
        const isOpen = open === i;
        return (
          <div key={e.q}>
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between gap-4 py-5 text-left focus-ring"
            >
              <span className="font-heading text-base font-extrabold lg:text-lg">{e.q}</span>
              <span
                aria-hidden
                className={`shrink-0 text-xl transition-transform ${isOpen ? 'rotate-45' : ''}`}
              >
                +
              </span>
            </button>
            {isOpen && (
              <div className="pb-6">
                {e.a ? (
                  <p className="max-w-2xl text-[0.95rem] leading-relaxed text-graphite">{e.a}</p>
                ) : (
                  <div className="flex items-center gap-3">
                    <ContentBadge status="CONTENT_REQUIRED" />
                    <p className="text-sm text-stone">
                      브랜드가 확인해 준 답변이 아직 없습니다. 공식 스마트스토어의 안내를 확인해
                      주세요.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
