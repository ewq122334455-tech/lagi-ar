import type { ContentStatus } from '@/utils/contentStatus';
import { STATUS_LABEL } from '@/utils/contentStatus';

const STYLES: Record<ContentStatus, string> = {
  VERIFIED: 'text-graphite border-line',
  AI_DRAFT: 'text-graphite border-line',
  UNKNOWN: 'text-stone border-line',
  CONTENT_REQUIRED: 'text-stone border-dashed border-line',
};

export function ContentBadge({ status }: { status: ContentStatus }) {
  if (status === 'VERIFIED') return null;
  return (
    <span
      className={`inline-block border px-2 py-0.5 text-[0.6rem] tracking-widest uppercase ${STYLES[status]}`}
      title="LAGI가 확인하지 않은 정보입니다. 브랜드가 제공한 사실만 VERIFIED로 표기됩니다."
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
