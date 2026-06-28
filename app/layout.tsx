import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BEEN MEDIA ERP",
  description: "Quản lý khách hàng, job, lịch chụp, nhân sự, lương và công nợ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
