import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export function QRCodeImage({ value, size = 168 }: { value: string; size?: number }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(value, { margin: 1, width: size * 2, color: { dark: '#111110', light: '#f7f6f3' } })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => setDataUrl(null));
    return () => {
      cancelled = true;
    };
  }, [value, size]);

  if (!dataUrl) {
    return <div className="animate-pulse bg-mist" style={{ width: size, height: size }} aria-hidden="true" />;
  }

  return <img src={dataUrl} alt="AR 체험 QR 코드" width={size} height={size} className="bg-paper" />;
}
