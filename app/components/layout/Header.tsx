import { Bell, Search, UserCircle2 } from "lucide-react";

export default function Header() {
  return (
    <header className="h-16 bg-white border-b flex items-center justify-between px-8 sticky top-0 z-30">
      <div className="flex items-center gap-3 text-gray-500">
        <Search size={20} />
        <span className="text-sm">Tìm kiếm nhanh trong hệ thống...</span>
      </div>

      <div className="flex items-center gap-6">
        <Bell className="text-gray-500" />

        <div className="flex items-center gap-2">
          <UserCircle2 size={34} />
          <div>
            <p className="font-semibold">Nguyễn Anh Tuấn</p>
            <p className="text-sm text-gray-500">Quản trị viên</p>
          </div>
        </div>
      </div>
    </header>
  );
}
