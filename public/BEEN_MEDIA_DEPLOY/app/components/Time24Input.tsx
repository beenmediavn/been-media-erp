"use client";

type Props = {
  value?: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
};

function normalize(value: string) {
  const raw = value.trim().toLowerCase().replace("h", ":").replace(".", ":");
  if (!raw) return "";
  const m = raw.match(/^(\d{1,2})(?::(\d{0,2}))?$/);
  if (!m) return value;
  const h = Number(m[1]);
  const min = Number(m[2] || 0);
  if (h < 0 || h > 23 || min < 0 || min > 59) return value;
  return `${String(h).padStart(2,"0")}:${String(min).padStart(2,"0")}`;
}

export default function Time24Input({ value="", onChange, className="", placeholder="HH:mm" }: Props) {
  return (
    <input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      maxLength={5}
      placeholder={placeholder}
      value={value}
      onChange={(e) => {
        let v=e.target.value.replace(/[^0-9:hH.]/g,"");
        if (/^\d{3,4}$/.test(v)) v=v.length===3?`${v.slice(0,1)}:${v.slice(1)}`:`${v.slice(0,2)}:${v.slice(2)}`;
        onChange(v);
      }}
      onBlur={(e)=>onChange(normalize(e.target.value))}
      className={className}
      aria-label="Giờ 24 tiếng"
    />
  );
}
