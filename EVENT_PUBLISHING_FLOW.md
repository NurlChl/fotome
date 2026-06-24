# Event Publishing Flow

## Ringkasan
Setiap event yang dibuat akan otomatis dalam status **Draft** dan tidak terlihat oleh publik. Photographer harus secara manual mempublish event setelah siap.

## Flow Lengkap

### 1. **Create Event** (Status: Draft)
- Buka Dashboard → "Create New Event"
- Isi detail event (title, description, category, location, date, price, tags)
- Klik "Create Event"
- Event dibuat dengan status **Draft** (tidak terlihat publik)

### 2. **Upload Photos** (Status: Masih Draft)
- Setelah event dibuat, redirect otomatis ke halaman manage event
- Upload foto-foto event menggunakan drag & drop atau file browser
- Sistem otomatis mendeteksi wajah di setiap foto
- Foto terupload tapi event masih **Draft**

### 3. **Publish Event** (Status: Published)
- Di halaman manage event, akan ada badge status "DRAFT" dan pesan amber warning
- Tombol **"Publish Event"** akan muncul di header
- Tombol publish hanya aktif jika minimal ada 1 foto
- Klik "Publish Event" untuk membuat event terlihat publik
- Status berubah jadi **Published** dan badge berubah hijau

### 4. **Unpublish Event** (Opsional)
- Jika ingin hide event lagi, klik tombol "Unpublish"
- Status kembali ke **Draft**

## Status Badge
- 🟡 **Draft**: Event belum terlihat publik
- 🟢 **Published**: Event sudah live dan terlihat di halaman events
- ⚫ **Archived**: Event dihapus (soft delete)

## Visual Indicators

### Di Dashboard:
- Status badge ditampilkan di card event
- Event draft akan ada badge amber "DRAFT"
- Event published akan ada badge green "PUBLISHED"

### Di Manage Event Page:
- Badge status di sebelah judul event
- Warning message amber untuk draft event:
  > "Event is in Draft Mode - This event is not visible to the public yet. Upload your photos and click 'Publish Event' when you're ready to make it live."
- Tombol "Publish Event" (primary button) untuk draft
- Tombol "Unpublish" (ghost button) untuk published event

## Validasi
- Event tidak bisa dipublish jika belum ada foto (minimum 1 foto)
- Hover tooltip akan muncul: "Upload at least 1 photo before publishing"

## Perubahan dari Sebelumnya
**Sebelumnya**: Event langsung published otomatis saat dibuat
**Sekarang**: Event dibuat sebagai draft, photographer kontrol kapan publish

## Keuntungan
✅ Photographer bisa prepare foto dulu sebelum publish
✅ Tidak ada event kosong tanpa foto terlihat publik
✅ Lebih kontrol dan profesional
✅ Mudah unpublish jika butuh edit atau maintenance
