"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search, UserCircle2, X } from "lucide-react";

function normalizeText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}

export default function EmployeePicker({
  employees,
  value,
  onChange,
  getConflict,
}: {
  employees: any[];
  value: string;
  onChange: (id: string) => void;
  getConflict: (id: string) => any;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const selected = employees.find((e) => e.id === value);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(timer);
  }, [open]);

  const filteredEmployees = useMemo(() => {
    const q = normalizeText(search);
    if (!q) return employees;

    return employees
      .map((employee, index) => {
        const name = normalizeText(employee.full_name);
        const role = normalizeText(employee.role);
        const username = normalizeText(employee.username);
        const phone = normalizeText(employee.phone);
        const haystack = `${name} ${role} ${username} ${phone}`;

        // Tên bắt đầu bằng từ đang gõ được ưu tiên trên cùng.
        let score = 99;
        if (name === q) score = 0;
        else if (name.startsWith(q)) score = 1;
        else if (name.split(/\s+/).some((part: string) => part.startsWith(q))) score = 2;
        else if (haystack.includes(q)) score = 3;

        return { employee, index, score };
      })
      .filter((item) => item.score < 99)
      .sort((a, b) => a.score - b.score || a.index - b.index)
      .map((item) => item.employee);
  }, [employees, search]);

  const chooseEmployee = (id: string) => {
    onChange(id);
    setOpen(false);
    setSearch("");
  };

  return (
    <div ref={ref} className="relative mt-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded border bg-white p-2 text-left"
      >
        <span className="flex min-w-0 items-center gap-2">
          {selected?.avatar_url ? (
            <img src={selected.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
          ) : (
            <UserCircle2 className="h-8 w-8 shrink-0 text-slate-400" />
          )}
          <span className="truncate">
            {selected ? `${selected.full_name} - ${selected.role}` : "Gõ tên để tìm thợ..."}
          </span>
        </span>
        <ChevronDown size={16} />
      </button>

      {open && (
        <div className="absolute z-[140] mt-1 w-full overflow-hidden rounded-xl border bg-white shadow-2xl">
          <div className="sticky top-0 z-10 border-b bg-white p-2">
            <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-2">
              <Search size={17} className="shrink-0 text-blue-600" />
              <input
                ref={inputRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setOpen(false);
                    setSearch("");
                  }
                  if (e.key === "Enter" && filteredEmployees.length === 1) {
                    const employee = filteredEmployees[0];
                    const conflict = getConflict(employee.id);
                    if (!conflict) chooseEmployee(employee.id);
                  }
                }}
                placeholder="Gõ tên: BEEN, Tuấn, Zimy..."
                className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none placeholder:text-slate-400"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    inputRef.current?.focus();
                  }}
                  className="rounded p-1 text-slate-400 hover:bg-white hover:text-slate-700"
                  title="Xóa từ khóa"
                >
                  <X size={16} />
                </button>
              )}
            </div>
            <div className="mt-1 px-1 text-[11px] text-slate-500">
              {search
                ? `Tìm thấy ${filteredEmployees.length} nhân sự phù hợp`
                : `${employees.length} nhân sự • gõ tên để lọc nhanh`}
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto p-1">
            <button
              type="button"
              onClick={() => chooseEmployee("")}
              className="w-full rounded-lg p-2 text-left text-sm hover:bg-slate-50"
            >
              Chưa chọn
            </button>

            {filteredEmployees.map((e) => {
              const c = getConflict(e.id);
              return (
                <button
                  key={e.id}
                  type="button"
                  disabled={Boolean(c)}
                  onClick={() => chooseEmployee(e.id)}
                  className={`flex w-full items-center gap-3 rounded-lg p-2 text-left ${
                    c ? "cursor-not-allowed bg-red-50 opacity-55" : "hover:bg-blue-50"
                  }`}
                >
                  {e.avatar_url ? (
                    <img src={e.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                  ) : (
                    <UserCircle2 className="h-10 w-10 shrink-0 text-slate-400" />
                  )}
                  <span className="min-w-0">
                    <b className="block truncate">{e.full_name}</b>
                    <span className="text-xs text-slate-500">
                      {e.role}
                      {c ? ` • BẬN ${c.start}-${c.end}` : ""}
                    </span>
                  </span>
                </button>
              );
            })}

            {filteredEmployees.length === 0 && (
              <div className="px-3 py-6 text-center text-sm text-slate-500">
                Không tìm thấy thợ tên “{search}”.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
