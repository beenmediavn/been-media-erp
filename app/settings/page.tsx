import MainLayout from "../components/layout/MainLayout";

export default function SettingsPage() {
  return (
    <MainLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Cài đặt</h1>
        <p className="text-gray-500 mt-1">Cấu hình hệ thống BEEN MEDIA ERP</p>
      </div>

      <div className="bg-white rounded-xl shadow p-6 space-y-4">
        <div className="border rounded-xl p-4">
          <p className="font-bold">Thông tin công ty</p>
          <p className="text-gray-500">CÔNG TY TNHH TRUYỀN THÔNG QUẢNG CÁO VÀ TỔ CHỨC SỰ KIỆN BEEN MEDIA</p>
        </div>
        <div className="border rounded-xl p-4">
          <p className="font-bold">Tên miền</p>
          <p className="text-gray-500">beenmedia.vn</p>
        </div>
        <div className="border rounded-xl p-4">
          <p className="font-bold">Phân quyền</p>
          <p className="text-gray-500">Admin, Sale, Photographer, Editor, Kế toán</p>
        </div>
      </div>
    </MainLayout>
  );
}
