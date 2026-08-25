import type { Metadata } from "next";
import "./globals.css";
import PwaRegister from "./components/PwaRegister";

export const metadata: Metadata = {
  title: "BEEN MEDIA ERP",
  description: "Quản lý khách hàng, job, lịch chụp, nhân sự, lương và công nợ",
  manifest: "/manifest.webmanifest",
  themeColor: "#f8fafc",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className="h-full antialiased">
      <body className="min-h-full flex flex-col"><PwaRegister />{children}</body>
    </html>
  );
}
