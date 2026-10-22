import { DetailSection } from '@/components/DetailSection';
import { LagiLogo } from '@/components/LagiLogo';

export default function About() {
  return (
    <div>
      <section className="border-b border-line bg-ink px-6 py-24 text-paper lg:px-10 lg:py-32">
        <div className="mx-auto max-w-canvas">
          <p className="eyebrow text-mist">ABOUT</p>
          <h1 className="mt-6">
            <LagiLogo className="h-24 w-auto lg:h-32" />
          </h1>
        </div>
      </section>

      <DetailSection eyebrow="BRAND">
        <div className="flex flex-col gap-4">
          <p className="text-graphite">
            LAGI는 아래 공식 채널을 통해 제품과 소식을 전합니다.
          </p>
          <ul className="flex flex-col gap-2 text-sm">
            <li>
              Instagram:{' '}
              <a href="https://www.instagram.com/lagi.official/" target="_blank" rel="noopener noreferrer" className="underline">
                @lagi.official
              </a>
            </li>
            <li>
              Smart Store:{' '}
              <a href="https://smartstore.naver.com/lagi_official" target="_blank" rel="noopener noreferrer" className="underline">
                smartstore.naver.com/lagi_official
              </a>
            </li>
          </ul>
        </div>
      </DetailSection>

      <DetailSection eyebrow="BRAND HISTORY">
        <p className="max-w-2xl text-lg leading-relaxed text-graphite">
          라기는 쓰임을 다한 밀가루 포대와 우유팩, 자동차 번호판 같은 재료를 모아 가방과 소품으로 만들어 왔습니다. POPSICLUS와 함께한 데일리 라인부터 펼치면 돗자리가 되는 피크닉백까지, 하나의 재료와 물건이 두 번, 세 번 쓰이는
          방법을 찾고 있어요.
        </p>
      </DetailSection>

      <DetailSection eyebrow="PHILOSOPHY">
        <ul className="grid max-w-3xl grid-cols-1 gap-8 sm:grid-cols-3">
          {[
            ['다시 보기', '버려질 재료를 한 번 더 들여다보고, 그 안의 그래픽과 질감을 디자인으로 살립니다.'],
            ['다시 쓰기', '세척하고 재단해 매일 들고 다닐 수 있는 물건으로 다시 쓰임을 줍니다.'],
            ['다시 고르기', '한 번 쓰고 끝나는 물건이 아니라, 다시 손이 가는 물건을 만듭니다.'],
          ].map(([t, d]) => (
            <li key={t} className="border-t border-line pt-5">
              <p className="text-lg font-bold">{t}</p>
              <p className="mt-2 text-sm leading-relaxed text-graphite">{d}</p>
            </li>
          ))}
        </ul>
      </DetailSection>
    </div>
  );
}
