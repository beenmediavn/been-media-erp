import { Bell, Menu, Search, UserCircle2 } from "lucide-react";

interface HeaderProps {
  onMenuClick?: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-white px-4 sm:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-3 text-gray-500">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Mở menu"
          className="rounded-lg border p-2 text-slate-700 lg:hidden"
        >
          <Menu size={20} />
        </button>
        <Search size={20} className="hidden sm:block" />
        <span className="hidden truncate text-sm sm:block">Tìm kiếm nhanh trong hệ thống...</span>
      </div>

      <div className="flex items-center gap-3 sm:gap-6">
        <Bell className="text-gray-500" size={20} />

        <div className="flex items-center gap-2">
          <UserCircle2 size={32} />
          <div className="hidden sm:block">
            <p className="font-semibold leading-tight">Nguyễn Anh Tuấn</p>
            <p className="text-sm text-gray-500">Quản trị viên</p>
          </div>
        </div>
      </div>
    </header>
  );
}
