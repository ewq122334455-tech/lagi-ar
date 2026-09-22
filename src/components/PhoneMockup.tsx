import { QRCodeImage } from '@/components/QRCode';

interface PhoneMockupProps {
  arUrl: string | null;
  label?: string;
}

/** A simple smartphone frame showing the live AR entry QR, used in marketing sections (spec §10-11). */
export function PhoneMockup({ arUrl, label = 'SCAN TO SEE IN AR' }: PhoneMockupProps) {
  return (
    <div className="relative w-[220px] rounded-[2.25rem] border-[6px] border-ink bg-ink p-2 shadow-2xl sm:w-[240px]">
      <div className="absolute left-1/2 top-2 h-1.5 w-14 -translate-x-1/2 rounded-full bg-graphite" />
      <div className="flex aspect-[9/18.5] flex-col items-center justify-center gap-5 rounded-[1.75rem] bg-paper px-6 pt-6">
        {arUrl ? (
          <>
            <QRCodeImage value={arUrl} size={140} />
            <p className="text-center font-heading text-xs font-extrabold uppercase tracking-wide text-ink">{label}</p>
          </>
        ) : (
          <p className="eyebrow text-center text-stone">AR — CONTENT REQUIRED</p>
        )}
      </div>
    </div>
  );
}
