# BEEN MEDIA ERP - BẢN ĐÃ SỬA

## 1. Chạy SQL trong Supabase
Vào Supabase > SQL Editor > New query.
Copy toàn bộ file `SUPABASE_SCHEMA.sql` và bấm Run.

## 2. Chạy thử trên máy
```bash
npm install
npm run dev
```
Mở: http://localhost:3000

## 3. Đưa lên Vercel
```bash
git push
```
Vercel sẽ tự deploy lại.

## 4. Biến môi trường Vercel đúng
NEXT_PUBLIC_SUPABASE_URL=https://udhgeadzstdjswdyplur.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_FoaxaxbHdSCVE7D188LBrQ_KYk6Bwdg
ZALO_OA_ACCESS_TOKEN=none
ZALO_TEMPLATE_CONFIRM_ID=581498
ZALO_TEMPLATE_REVIEW_ID=581353

## Ghi chú
Zalo OA chỉ gửi thật sau khi có Access Token thật. Các phần ERP còn lại chạy được.
