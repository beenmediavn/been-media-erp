"use client";

interface MoneyInputProps {
  value: number | string | null | undefined;
  onChange: (value: number) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
}

export default function MoneyInput({ value, onChange, placeholder = "0", className = "", disabled, id }: MoneyInputProps) {
  const numericValue = Number(value || 0);
  const display = numericValue ? numericValue.toLocaleString("vi-VN") : "";

  return (
    <div className="relative">
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        disabled={disabled}
        className={`${className} pr-10`}
        placeholder={placeholder}
        value={display}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "");
          onChange(digits ? Number(digits) : 0);
        }}
      />
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm font-semibold text-slate-400">đ</span>
    </div>
  );
}
