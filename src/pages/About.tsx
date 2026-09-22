import { ContentBadge } from '@/components/ContentBadge';
import { DetailSection } from '@/components/DetailSection';

export default function About() {
  return (
    <div>
      <section className="border-b border-line bg-ink px-6 py-24 text-paper lg:px-10 lg:py-32">
        <div className="mx-auto max-w-canvas">
          <p className="eyebrow text-mist">ABOUT</p>
          <h1 className="mt-4 max-w-2xl text-4xl font-medium leading-tight lg:text-5xl">LAGI</h1>
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
        <ContentBadge status="CONTENT_REQUIRED" />
        <p className="mt-3 max-w-xl text-sm text-graphite">
          브랜드 히스토리는 아직 공급되지 않았습니다. 브랜드가 제공하는 자료가 추가되면 이 섹션에 반영됩니다.
        </p>
      </DetailSection>

      <DetailSection eyebrow="PHILOSOPHY">
        <ContentBadge status="CONTENT_REQUIRED" />
        <p className="mt-3 max-w-xl text-sm text-graphite">
          브랜드 철학 및 지속가능성 관련 주장은 아직 공급되지 않았습니다. 확인되지 않은 내용은 생성하지 않습니다.
        </p>
      </DetailSection>
    </div>
  );
}
