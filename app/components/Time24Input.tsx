"use client";

import { useEffect, useState } from "react";

type Props = {
  value?: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
};

function digitsOnly(value: string) {
  return String(value || "").replace(/\D/g, "").slice(0, 4);
}

function displayFromDigits(digits: string) {
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

function normalize(value: string) {
  let d = digitsOnly(value);
  if (!d) return "";

  // 3 số kiểu 735 => 07:35. 3 số kiểu 153 => 15:30 (người dùng đang gõ HHM).
  if (d.length === 3) {
    const firstTwo = Number(d.slice(0, 2));
    if (firstTwo > 23) d = `0${d}`;
    else d = `${d}0`;
  }

  if (d.length <= 2) {
    const h = Number(d);
    if (!Number.isFinite(h) || h > 23) return "";
    return `${String(h).padStart(2, "0")}:00`;
  }

  const h = Number(d.slice(0, 2));
  const m = Number(d.slice(2, 4));
  if (h > 23 || m > 59) return "";
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export default function Time24Input({ value = "", onChange, className = "", placeholder = "HH:mm" }: Props) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value || "");
  }, [value]);

  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      autoComplete="off"
      enterKeyHint="done"
      maxLength={5}
      placeholder={placeholder}
      value={draft}
      onFocus={(e) => {
        // Điện thoại: chạm vào là chọn toàn bộ để gõ 1535 nhanh.
        requestAnimationFrame(() => e.currentTarget.select());
      }}
      onChange={(e) => {
        const digits = digitsOnly(e.target.value);
        const shown = displayFromDigits(digits);
        setDraft(shown);
        // Chỉ đẩy giá trị hoàn chỉnh khi đã đủ 4 số; trong lúc gõ vẫn lưu draft để không nhảy con trỏ.
        if (digits.length === 4) {
          const h = Number(digits.slice(0, 2));
          const m = Number(digits.slice(2, 4));
          if (h <= 23 && m <= 59) onChange(`${digits.slice(0, 2)}:${digits.slice(2, 4)}`);
        } else {
          onChange(shown);
        }
      }}
      onBlur={() => {
        const finalValue = normalize(draft);
        setDraft(finalValue);
        onChange(finalValue);
      }}
      className={className}
      aria-label="Giờ 24 tiếng"
    />
  );
}
