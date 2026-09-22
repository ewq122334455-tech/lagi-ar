export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="eyebrow text-graphite">{label}</span>
      {children}
      {hint && <span className="text-xs text-stone">{hint}</span>}
    </label>
  );
}

const inputClass = 'border border-line bg-paper px-3 py-2.5 text-sm text-ink focus-ring focus:border-ink';

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputClass} ${props.className ?? ''}`} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${inputClass} min-h-[96px] resize-y ${props.className ?? ''}`} />;
}

export function NumberInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input type="number" {...props} className={`${inputClass} ${props.className ?? ''}`} />;
}

export function SelectInput(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputClass} ${props.className ?? ''}`} />;
}
