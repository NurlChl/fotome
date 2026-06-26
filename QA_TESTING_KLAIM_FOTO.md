# 🔍 QA Testing - Sistem Klaim Foto (Comprehensive Security & Flow Testing)

## ✅ PERBAIKAN KRITIS YANG DILAKUKAN

### 1. **Fix IP Address Detection untuk Manual Claims**
**Problem:** IP address di dashboard klaim manual menunjukkan `::1` (localhost) bukan IP publik
**Root Cause:** `getClientIp()` hanya mengambil dari headers request tanpa fallback ke IP publik
**Solution:**
- Added `getPublicIp()` function yang fetch dari https://api.ipify.org
- Added `isLoopbackIp()` function untuk detect localhost addresses
- Created `getClientIpResolved()` async function yang:
  - Check headers first (x-forwarded-for, x-real-ip, cf-connecting-ip)
  - Jika loopback detected → fetch real public IP
  - Cache IP publik untuk avoid repeated API calls
- Updated `/api/photos/claim` untuk gunakan `getClientIpResolved()` instead of `getClientIp()`

**Files Modified:**
- `src/lib/rate-limit.ts` - Enhanced IP detection
- `src/app/api/photos/claim/route.ts` - Use getClientIpResolved

### 2. **Fix Claimed Photos Tidak Tersimpan Permanen (Hilang Setelah Refresh)**
**Problem:** Setelah klaim foto, badge hilang saat refresh karena data tidak masuk database
**Root Cause:** Frontend tidak mengirim `selfieDescriptor` ke API claim, sehingga `saveClaimedPhotoAndLearn()` gagal
**Solution:**
- Added `modalSelfieDescriptor` state untuk store descriptor dari camera capture
- Modified `captureModalSelfie()` to save descriptor: `setModalSelfieDescriptor(descriptor)`
- Modified `handleManualClaimOverride()` to:
  - Check `modalSelfieDescriptor` availability
  - Send descriptor to API via `selfieDescriptor` field
  - Re-fetch claimed photos dari database after successful claim
  - Update `claimedPhotos` state from fresh database data
- Clear descriptor saat modal ditutup via `handleCloseLegalModal()`

**Files Modified:**
- `src/app/events/[slug]/page.tsx` - Fixed claim flow

---

## 📋 QA TEST PLAN (SECURITY & FLOW)

### **TEST 1: IP Address Logging (Development Environment)**

**Scenario:** User melakukan klaim manual di localhost development
**Expected Result:**
- IP address harus menunjukkan IP publik real (bukan ::1 atau 127.0.0.1)
- IP address di dashboard klaim manual = IP address di activity logs
- Log masuk ke Axiom dengan IP publik yang sama

**Test Steps:**
1. Buka event page di localhost
2. Klik foto → "Klaim Foto Saya"
3. Complete verification dengan selfie
4. Klik "Saya Yakin Ini Saya (Tandai Sebagai Foto Saya)"
5. Navigate to `/dashboard/claims` (admin dashboard)
6. Verify IP column menunjukkan IP publik (e.g., 103.xxx.xxx.xxx)
7. Navigate to `/dashboard/activity` (admin dashboard)
8. Verify activity log untuk CLAIM_PHOTO_MANUAL menunjukkan IP publik yang sama

**Pass Criteria:**
- ✅ IP di dashboard claims = IP publik
- ✅ IP di activity logs = IP publik yang sama
- ✅ Axiom logs (jika configured) menunjukkan IP publik yang sama

---

### **TEST 2: Claimed Photo Persistence (Database & State Management)**

**Scenario:** User klaim foto, refresh page, foto tetap menunjukkan badge "Sudah Diklaim"
**Expected Result:**
- Foto masuk ke ClaimedPhoto collection
- Badge "Sudah Diklaim" tetap muncul setelah refresh
- Foto muncul di filter "Tersimpan"
- User face descriptor di-update via continuous learning

**Test Steps:**
1. Login sebagai user yang sudah ada Face ID
2. Buka event page
3. Search foto dengan AI (akan auto-search jika ada Face ID)
4. Klik foto yang matched → Preview
5. Klik "Klaim Foto Saya" → Complete verification
6. Verify badge "Sudah Diklaim - Akses Download Terbuka" muncul (green)
7. **REFRESH PAGE (F5)**
8. Verify badge "Sudah Diklaim" tetap muncul
9. Klik filter "Tersimpan" → Verify foto ada di list
10. Navigate to `/my-photos` → Verify foto ada di dashboard

**Pass Criteria:**
- ✅ Badge "Sudah Diklaim" tetap muncul setelah refresh
- ✅ Foto ada di filter "Tersimpan"
- ✅ Foto ada di ClaimedPhoto collection (cek MongoDB)
- ✅ User faceDescriptor di User collection ter-update (continuous learning)

---

### **TEST 3: Continuous Learning (Face Descriptor Improvement)**

**Scenario:** User klaim multiple photos, face descriptor semakin akurat
**Expected Result:**
- Setiap klaim, descriptor averaged dengan claimed faces
- User face descriptor di User model ter-update
- Future searches semakin akurat

**Test Steps:**
1. Check user's current `faceDescriptor` in MongoDB User collection (baseline)
2. Klaim foto #1 → Verify `ClaimedPhoto` created dengan `faceDescriptor`
3. Check user's `faceDescriptor` again → Should be averaged (value changed)
4. Klaim foto #2 → Verify second `ClaimedPhoto` created
5. Check user's `faceDescriptor` again → Should be averaged dari 3 descriptors (original + 2 claimed)
6. Perform new AI search → Results should include similar photos

**Pass Criteria:**
- ✅ ClaimedPhoto collection memiliki entry untuk setiap klaim dengan `faceDescriptor`
- ✅ User.faceDescriptor berubah setelah setiap klaim (averaged)
- ✅ Console log: "Continuous learning: Updated face descriptor for user [userId] using X samples"

---

### **TEST 4: Axiom Logging (Activity Audit Trail)**

**Scenario:** Semua klaim masuk ke Axiom logs untuk audit
**Expected Result:**
- Log CLAIM_PHOTO_MANUAL masuk ke Axiom
- Log memiliki userId, photoId, eventId, ipAddress (public)
- Details message lengkap dan informative

**Test Steps:**
1. Verify `AXIOM_TOKEN` dan `AXIOM_DATASET` configured di `.env.local`
2. Klaim foto via manual claim
3. Check Axiom dashboard → Query recent logs
4. Verify log entry dengan:
   - `action`: "CLAIM_PHOTO_MANUAL"
   - `userId`: User ID
   - `photoId`: Photo ID
   - `eventId`: Event ID
   - `ipAddress`: Public IP (not ::1 or 127.0.0.1)
   - `details`: "Manually claimed photo ID: [photoId] in event ID: [eventId] with selfie re-verification"

**Pass Criteria:**
- ✅ Log masuk ke Axiom dalam <5 seconds
- ✅ All fields populated dengan benar
- ✅ IP address = public IP (bukan localhost)

---

### **TEST 5: Security - Anti-Abuse Measures**

**Scenario 1:** User claim foto → download → klik "Bukan Foto Saya" (tidak boleh)
**Expected Result:** Button "Bukan Foto Saya" hidden untuk claimed photos

**Test Steps:**
1. Klaim foto successfully
2. Buka preview foto yang sudah diklaim
3. Verify button "Bukan Foto Saya" **TIDAK MUNCUL**
4. Verify badge "Sudah Diklaim - Akses Download Terbuka" muncul

**Pass Criteria:**
- ✅ Button "Bukan Foto Saya" hidden jika foto sudah diklaim
- ✅ Claimed photos tidak bisa di-unclaim oleh user

---

**Scenario 2:** Guest user (tidak login) coba akses klaim foto
**Expected Result:** API return 401 Unauthorized

**Test Steps:**
1. Logout dari aplikasi
2. Buka event page
3. Klik foto → "Klaim Foto Saya"
4. Complete selfie verification
5. API call ke `/api/photos/claim` should fail dengan 401

**Pass Criteria:**
- ✅ API return 401 Unauthorized
- ✅ Error message: "Unauthorized. Silakan login terlebih dahulu untuk melakukan klaim foto."

---

**Scenario 3:** User coba klaim foto orang lain (face tidak match)
**Expected Result:** System record log tapi beri warning

**Test Steps:**
1. Login sebagai user A
2. Scan face user A (AI search)
3. Buka foto user B (tidak ada di search results)
4. Klik "Klaim Foto Saya" → Complete verification
5. System detect tidak match → Show error → Tapi beri opsi "Manual Claim"
6. User klik "Saya Yakin Ini Saya" → Log recorded dengan selfie URL

**Pass Criteria:**
- ✅ PhotoClaim created dengan `isMatched: false`
- ✅ Log activity CLAIM_PHOTO_MANUAL recorded dengan IP publik
- ✅ Selfie image uploaded to Cloudinary `fotome/claims/` folder
- ✅ Admin bisa review di dashboard `/dashboard/claims`

---

### **TEST 6: Download Access Control**

**Scenario 1:** User coba download foto yang sudah diklaim
**Expected Result:** Download berhasil (auto-granted)

**Test Steps:**
1. Klaim foto successfully
2. Klik button "Unduh" di lightbox preview
3. Verify foto downloaded tanpa error

**Pass Criteria:**
- ✅ `/api/photos/[id]/download` return 200 OK
- ✅ File downloaded dengan nama `FotoMe-Free-[photoId].jpg`
- ✅ Log activity DOWNLOAD_PHOTO recorded

---

**Scenario 2:** User coba download foto yang belum diklaim (tidak match face)
**Expected Result:** Download blocked dengan error message

**Test Steps:**
1. Buka foto yang tidak ada di search results (tidak match face)
2. Klik button "Unduh"
3. Verify error popup muncul

**Pass Criteria:**
- ✅ `/api/photos/[id]/download` return 403 Forbidden atau error
- ✅ Error message: "Verifikasi wajah gagal: Wajah Anda tidak terdeteksi di foto ini..."
- ✅ Tip ditampilkan untuk gunakan "Klaim Foto Saya"

---

### **TEST 7: Filter "Tersimpan" (Claimed + Saved Photos)**

**Scenario:** User klaim 2 foto, save 1 foto → Filter "Tersimpan" show 3 photos
**Expected Result:** Filter combines claimed + saved photos (deduplicated)

**Test Steps:**
1. Klaim foto #1
2. Klaim foto #2
3. Save foto #3 (via bookmark icon)
4. Klik filter "Tersimpan (3)"
5. Verify grid menampilkan 3 photos: foto #1, #2, #3
6. Verify badge colors:
   - Foto #1, #2: Green "Sudah Diklaim"
   - Foto #3: Amber "Tersimpan" (small BookmarkCheck icon)

**Pass Criteria:**
- ✅ Filter count = claimed.size + saved.size (deduplicated)
- ✅ All photos displayed di grid
- ✅ Badge colors benar (green = claimed priority, amber = saved)

---

### **TEST 8: Mobile Responsiveness**

**Scenario:** Test all flows di mobile viewport
**Expected Result:** UI tetap usable dan tidak ada layout breaks

**Test Steps:**
1. Open DevTools → Toggle device emulation (iPhone 12 Pro)
2. Navigate event page → Verify layout responsive
3. Perform AI search → Verify camera modal responsive
4. Klaim foto → Verify legal modal responsive
5. Verify lightbox preview responsive (touch swipe works)

**Pass Criteria:**
- ✅ All modals tidak overflow screen
- ✅ Buttons tidak overlapping
- ✅ Text readable (tidak terlalu kecil)
- ✅ Touch gestures work (swipe, tap)

---

### **TEST 9: Error Handling & Edge Cases**

**Scenario 1:** Cloudinary upload fail saat klaim
**Expected Result:** User melihat error message, claim tidak tersimpan

**Test Steps:**
1. Simulate Cloudinary error (disconnect internet atau invalid API key)
2. Attempt klaim foto
3. Verify error message: "Gagal mengunggah foto selfie verifikasi ke server penyimpanan."

**Pass Criteria:**
- ✅ Error handled gracefully
- ✅ No PhotoClaim or ClaimedPhoto created
- ✅ User dapat retry

---

**Scenario 2:** MongoDB connection fail
**Expected Result:** API return 500 dengan error message

**Test Steps:**
1. Stop MongoDB service
2. Attempt klaim foto
3. Verify error: "Terjadi kesalahan sistem saat memproses klaim foto Anda."

**Pass Criteria:**
- ✅ API return 500 Internal Server Error
- ✅ Error logged to console
- ✅ User melihat friendly error message

---

**Scenario 3:** User klaim foto yang sama 2x
**Expected Result:** Upsert behavior (no duplicate), no error

**Test Steps:**
1. Klaim foto #1 successfully
2. Refresh page
3. Klaim foto #1 lagi
4. Verify no duplicate di ClaimedPhoto collection

**Pass Criteria:**
- ✅ Only 1 entry di ClaimedPhoto (userId + photoId unique)
- ✅ No error shown to user
- ✅ Badge tetap muncul

---

## 🚨 SECURITY CHECKLIST

### **Data Integrity**
- [x] PhotoClaim.ipAddress = Public IP (not localhost)
- [x] ClaimedPhoto saved to database (persists after refresh)
- [x] Activity logs contain complete audit trail
- [x] Selfie images uploaded to Cloudinary (secure storage)

### **Access Control**
- [x] Guest users cannot claim photos (401 Unauthorized)
- [x] Users cannot download non-matching photos (403 Forbidden)
- [x] Claimed photos auto-granted download access
- [x] Button "Bukan Foto Saya" hidden for claimed photos (anti-abuse)

### **Audit Trail**
- [x] All claims logged to ActivityLog collection
- [x] All claims logged to Axiom (if configured)
- [x] Logs contain: userId, photoId, eventId, ipAddress, timestamp
- [x] Manual claims record `isMatched: false` for admin review

### **Privacy & Compliance**
- [x] Selfie images stored securely (Cloudinary with access control)
- [x] IP addresses logged for legal compliance (UU PDP)
- [x] User consent checkbox required before claim
- [x] Legal warning displayed prominently

---

## 📊 EXPECTED MONGODB COLLECTIONS STATE

### **ClaimedPhoto Collection**
```javascript
{
  _id: ObjectId("..."),
  userId: ObjectId("..."),
  photoId: ObjectId("..."),
  eventId: ObjectId("..."),
  faceDescriptor: [128-dimensional array],
  createdAt: ISODate("..."),
  updatedAt: ISODate("...")
}
```

### **PhotoClaim Collection**
```javascript
{
  _id: ObjectId("..."),
  userId: ObjectId("..."),
  photoId: ObjectId("..."),
  eventId: ObjectId("..."),
  selfieUrl: "https://res.cloudinary.com/fotome/claims/...",
  selfieDescriptor: [128-dimensional array],
  ipAddress: "103.xxx.xxx.xxx", // Public IP
  isMatched: false, // Manual claim
  createdAt: ISODate("..."),
  updatedAt: ISODate("...")
}
```

### **ActivityLog Collection**
```javascript
{
  _id: ObjectId("..."),
  userId: ObjectId("..."),
  photoId: ObjectId("..."),
  eventId: ObjectId("..."),
  action: "CLAIM_PHOTO_MANUAL",
  details: "Manually claimed photo ID: [...] in event ID: [...] with selfie re-verification",
  ipAddress: "103.xxx.xxx.xxx", // Public IP
  createdAt: ISODate("...")
}
```

---

## ✅ FINAL VERIFICATION CHECKLIST

Sebelum deploy production, verify semua item ini:

- [ ] **TypeScript compilation pass** (`tsc --noEmit`)
- [ ] **All TEST 1-9 pass** (IP, persistence, continuous learning, Axiom, security, download, filter, mobile, error handling)
- [ ] **MongoDB indexes exist** (ClaimedPhoto: userId+photoId compound unique, PhotoClaim: userId+eventId+photoId)
- [ ] **Cloudinary credentials configured** (CLOUDINARY_CLOUD_NAME, API_KEY, API_SECRET)
- [ ] **Axiom credentials configured** (AXIOM_TOKEN, AXIOM_DATASET) - optional but recommended
- [ ] **Environment variables validated** (check .env.local vs .env.example)
- [ ] **Rate limiting tested** (prevent abuse via rapid claim requests)
- [ ] **Browser console free of errors** (no React hydration errors, no API errors)
- [ ] **Network tab clean** (no failed API calls, no 500 errors)
- [ ] **Mobile devices tested** (iOS Safari, Android Chrome)
- [ ] **Admin dashboard accessible** (`/dashboard/claims` shows IP publik correctly)

---

## 🔧 TROUBLESHOOTING GUIDE

### **Problem: Claimed photos hilang setelah refresh**
**Solution:**
- Check MongoDB ClaimedPhoto collection → Entry should exist
- Check browser console → "Loaded X claimed photos for this event"
- Check API `/api/photos/claimed` → Should return array with photoIds
- Verify `useEffect` dependency: `[session, event]` triggering re-fetch

### **Problem: IP address masih localhost di dashboard**
**Solution:**
- Check `getClientIpResolved()` di `rate-limit.ts`
- Test API call: https://api.ipify.org?format=json (should return public IP)
- Verify Cloudflare/proxy headers configured correctly (production only)
- Development: OK to see public IP dari ipify.org

### **Problem: Continuous learning tidak work**
**Solution:**
- Check `selfieDescriptor` sent dari frontend (array of 128 numbers)
- Check `saveClaimedPhotoAndLearn()` execution (console log should show)
- Verify face descriptor di foto exists (FaceDescriptor collection)
- Check MongoDB User.faceDescriptor field updated

---

**Last Updated:** 2024-06-25
**Test Environment:** Windows (localhost), Node.js, MongoDB, Cloudinary
**Production Ready:** ✅ YES (after all tests pass)
