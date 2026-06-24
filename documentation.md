# Dokumentasi FotoMe

## Pengenalan
FotoMe adalah sebuah platform pendistribusian dan pencarian dokumentasi foto event berbasis kecerdasan buatan (AI) yang menggunakan teknologi Face Recognition (Pencocokan Wajah). Aplikasi ini memungkinkan pengguna untuk menemukan foto-foto mereka secara otomatis di dalam lautan dokumentasi event (marathon, konser, kelulusan, pernikahan) tanpa harus mencari secara manual.

## Fitur Utama
1. **Pencarian Foto dengan Face ID (AI)**
   - Sistem mencocokkan vektor wajah dari selfie yang diunggah pengguna dengan wajah yang terdeteksi di dalam foto-foto event.
   - Proses pengenalan wajah dilakukan di sisi klien (browser) untuk menjaga privasi, di mana hanya representasi angka (vektor) dari wajah yang disimpan di server.
   
2. **Pembelian dan Pengunduhan Foto (Free/Paid)**
   - Foto dapat diatur dengan harga tertentu atau diatur sebagai unduhan gratis (Free Download) dengan memasukkan harga `0`.
   - Pengguna dapat membayar untuk mendapatkan versi foto dengan resolusi tinggi (bebas watermark).

3. **Autentikasi Aman & Proteksi Hak Cipta**
   - Hanya pemilik wajah yang terdeteksi dalam foto yang diizinkan untuk mengunduh atau membeli foto yang bersangkutan secara default untuk menjaga privasi.
   - Pemisahan portal akses untuk Pengguna Biasa (`/login`) dan Administrator (`/login/admin`).

4. **Sistem Role-Based Access Control (RBAC)**
   - **Superadmin:** Memiliki hak akses penuh ke seluruh sistem platform.
   - **Admin:** Memiliki hak akses yang spesifik (bisa diatur oleh Superadmin) seperti kelola Users, kelola Events, atau kelola Payouts.
   - **Photographer:** (Saat ini disembunyikan pada V1) Untuk fotografer eksternal. Semua pengelolaan foto di V1 dikerjakan oleh Admin/Superadmin.
   - **User:** Pengguna akhir yang mencari dan membeli foto.

## Cara Kerja Sistem (Alur Pengguna)
1. **Pilih Event:** Pengguna mencari dan membuka halaman event olahraga, konser, atau wisuda.
2. **Daftar/Login:** Pengguna membuat akun atau login.
3. **Register Face ID / Ambil Selfie:** Pengguna mengklik tombol registrasi wajah (bisa melalui profil navbar atau prompt di halaman event) lalu mengunggah/mengambil foto selfie. Vektor wajah akan diekstraksi.
4. **Pencocokan:** AI mencocokkan wajah dan menyoroti foto-foto mana yang mengandung wajah pengguna.
5. **Checkout/Unduh:** Pengguna dapat menekan tombol "Unduh Gratis" (jika harga 0) atau "Beli Foto" (jika berbayar).

## Teknologi yang Digunakan
- **Frontend:** Next.js 14, React, Tailwind CSS, Shadcn UI / Lucide Icons.
- **Backend/API:** Next.js API Routes.
- **Database:** MongoDB (dengan Mongoose).
- **Authentication:** NextAuth.js.
- **AI/Biometric:** `@vladmandic/face-api` untuk ekstraksi Face Descriptor di sisi client.

## Arsitektur Tema dan UI
- Menggunakan pendekatan **Elegant Crimson & Minimalist Dark Mode**.
- Konsep desain tidak menggunakan icon emoji, sepenuhnya menggunakan Lucide React icons agar seragam.
- Warna yang digunakan difokuskan pada `primary-600` (Crimson Red) dipadukan dengan palet abu-abu netral (`neutral-900`, `neutral-950`).

## Manajemen Role & Aksesibilitas
* **Superadmin:** Dapat menambahkan admin baru melalui tab `Admins` di halaman Admin Console (`/dashboard/admin`).
* Saat penambahan Admin, Superadmin dapat menyalakan/mematikan Checkbox untuk memberikan izin spesifik (misal, hanya mengizinkan Admin mengatur Event, tidak untuk User/Payouts).

> [!NOTE]
> **Superadmin Configuration**
> Untuk konfigurasi akun Superadmin utama, disarankan untuk mengatur variabel `SUPERADMIN_EMAIL` dan `SUPERADMIN_PASSWORD` di dalam file `.env.local`. Sistem akan membaca variabel ini untuk menjaga keamanan dan mempermudah setup awal tanpa melakukan *hardcoding* di database.

## Pengembangan Kedepan (Roadmap)
- Integrasi Payment Gateway (Midtrans/Stripe) untuk otomatisasi pembayaran.
- Mengaktifkan portal mandiri bagi *Photographer* setelah ekosistem stabil.
- Peningkatan model AI dengan *liveness detection* untuk mencegah pemalsuan identitas.
