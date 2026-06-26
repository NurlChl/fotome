# Auto-Claimed Photo Collection & Continuous Learning

## Overview

Sistem ini mengimplementasikan **koleksi foto yang diklaim secara otomatis** dan **continuous learning** untuk meningkatkan akurasi face matching. Ketika user mengklaim foto sebagai "Foto Saya", sistem akan:

1. ✅ **Auto-save ke koleksi pribadi** - Tidak perlu klaim berulang kali
2. ✅ **Auto-grant akses download** - Foto yang sudah diklaim bisa langsung didownload
3. ✅ **Continuous Learning** - Meningkatkan akurasi model dengan averaging face descriptors

---

## Fitur Utama

### 1. Auto-Save Claimed Photos

Ketika user mengklaim foto:
- Foto disimpan ke collection `ClaimedPhoto`
- Face descriptor yang match disimpan untuk learning
- User bisa langsung download tanpa verifikasi ulang

### 2. Continuous Learning

**Cara Kerja:**
- Sistem mengambil semua face descriptors dari foto yang diklaim user
- Menggabungkan dengan face descriptor user yang sudah terdaftar
- Membuat face descriptor baru dengan **averaging** semua samples
- Update face descriptor user → akurasi meningkat seiring waktu

**Formula:**
```
improved_descriptor = average(claimed_faces + registered_face)
```

**Keuntungan:**
- Model jadi lebih robust terhadap variasi pose, lighting, ekspresi
- Tidak perlu retrain neural network
- Berjalan di runtime secara otomatis

### 3. Smart Access Control

**Prioritas Akses (dari tertinggi):**
1. ✅ Admin/Superadmin/Photographer Owner
2. ✅ Foto yang sudah diklaim (ClaimedPhoto)
3. ✅ Foto event gratis
4. ✅ Foto yang sudah dibeli
5. ❌ Verifikasi biometric (jika belum memenuhi di atas)

---

## Database Schema

### ClaimedPhoto Collection

```typescript
{
  userId: ObjectId,          // User yang mengklaim
  photoId: ObjectId,         // Foto yang diklaim
  eventId: ObjectId,         // Event foto
  faceDescriptor: number[],  // Face descriptor yang match (128-d)
  claimedAt: Date           // Timestamp klaim
}
```

**Index:**
- Compound unique: `{ userId, photoId }` - Prevent duplicate claims
- Single: `userId`, `photoId`, `eventId` - Query optimization

---

## API Endpoints

### 1. POST `/api/photos/claim`

**Fitur Baru:**
- Auto-save ke `ClaimedPhoto` collection
- Find best matching face di foto menggunakan selfie descriptor
- Apply continuous learning dengan averaging descriptors
- Return flag `continuousLearning: true` jika berhasil

**Response:**
```json
{
  "success": true,
  "claim": { ... },
  "continuousLearning": true
}
```

### 2. GET `/api/photos/claimed`

**Endpoint Baru** - Retrieve semua foto yang diklaim user

**Query Parameters:**
- `eventId` (optional) - Filter by event

**Response:**
```json
{
  "claimedPhotos": [
    {
      "_id": "...",
      "userId": "...",
      "photoId": {
        "watermarkedUrl": "...",
        "thumbnailUrl": "...",
        ...
      },
      "eventId": {
        "title": "Event Name",
        "slug": "event-slug"
      },
      "claimedAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "count": 5
}
```

### 3. GET `/api/photos/[id]/download`

**Fitur Baru:**
- Check apakah foto sudah diklaim (`isPhotoClaimed`)
- Auto-grant download access untuk claimed photos
- Skip biometric verification untuk claimed photos
- Log download reason: `Claimed Photo`

### 4. POST `/api/orders`

**Fitur Baru:**
- Auto-save matched photos ke `ClaimedPhoto` saat purchase
- Apply continuous learning untuk setiap foto yang dibeli
- Improve user's face descriptor dengan data baru

---

## Helper Functions (biometrics.ts)

### `averageDescriptors(descriptors: number[][]): number[]`
Averaging multiple face descriptors untuk membuat representasi yang lebih robust.

### `saveClaimedPhotoAndLearn(userId, photoId, eventId, faceDescriptor): Promise<boolean>`
- Save ke `ClaimedPhoto` collection (upsert)
- Get semua claimed photos user
- Average semua face descriptors (termasuk yang sudah registered)
- Update user's face descriptor
- Return success status

### `isPhotoClaimed(userId, photoId): Promise<{ claimed: boolean, claimedPhoto? }>`
Check apakah user sudah mengklaim foto tertentu.

---

## User Flow

### Scenario 1: User Klaim Foto Pertama Kali

1. User klik "Klaim Foto Saya" pada foto
2. Upload selfie untuk verifikasi
3. Sistem find best matching face di foto
4. **AUTO-SAVE** ke ClaimedPhoto
5. **CONTINUOUS LEARNING**: Average dengan face descriptor yang ada
6. User bisa download langsung

### Scenario 2: User Download Foto yang Sudah Diklaim

1. User klik download pada foto yang pernah diklaim
2. Sistem check `ClaimedPhoto` collection
3. ✅ Found → **Auto-grant download access**
4. ❌ Not found → Verifikasi biometric seperti biasa

### Scenario 3: User Beli Foto

1. User checkout foto di cart
2. Verifikasi biometric untuk semua foto
3. Payment berhasil
4. **AUTO-SAVE** semua foto ke ClaimedPhoto
5. **CONTINUOUS LEARNING**: Update face descriptor
6. User bisa download berkali-kali tanpa verifikasi ulang

### Scenario 4: Continuous Improvement

- Claim 1 foto → 1 face sample
- Claim 5 foto → 5 face samples  
- Model semakin akurat dengan berbagai pose/lighting
- Reduced false negatives
- Better matching pada foto future

---

## Benefits

### 1. User Experience
✅ Tidak perlu klaim berulang kali  
✅ Download instant untuk foto yang sudah diklaim  
✅ Akurasi matching meningkat seiring waktu  
✅ Reduced frustration dari false negatives

### 2. System Performance
✅ Tidak perlu retrain neural network  
✅ Learning berjalan di runtime  
✅ Efficient query dengan claimed photo check  
✅ Reduced biometric verification calls

### 3. Business Value
✅ Better user retention  
✅ Increased photo claims  
✅ Higher satisfaction rate  
✅ Personalized experience

---

## Technical Implementation

### Continuous Learning Algorithm

```typescript
// 1. Get all claimed photos for user
const claimedPhotos = await ClaimedPhoto.find({ userId });

// 2. Extract face descriptors
const claimedDescriptors = claimedPhotos.map(cp => cp.faceDescriptor);

// 3. Include user's registered face
if (user.faceDescriptor) {
  claimedDescriptors.push(user.faceDescriptor);
}

// 4. Average all descriptors
const improvedDescriptor = averageDescriptors(claimedDescriptors);

// 5. Update user's face descriptor
await User.findByIdAndUpdate(userId, {
  faceDescriptor: improvedDescriptor
});
```

### Why Averaging Works

1. **Reduce Noise**: Individual faces bisa terpengaruh lighting/pose
2. **Increase Robustness**: Average dari banyak samples lebih stable
3. **Preserve Identity**: Face descriptors dari orang yang sama akan cluster together
4. **Simple & Effective**: Tidak perlu training, langsung applicable

---

## Security Considerations

### Duplicate Prevention
- Compound unique index pada `{ userId, photoId }`
- `findOneAndUpdate` dengan `upsert: true`
- Graceful handling duplicate claims

### Access Control
- Only logged-in users can claim photos
- ClaimedPhoto tied to specific userId
- Cannot claim others' photos

### Biometric Integrity
- Claimed photos still require initial verification
- Continuous learning only uses verified matches
- Hard negatives still suppress false positives

---

## Testing Checklist

### Manual Testing

- [ ] Klaim foto pertama kali → saved to ClaimedPhoto
- [ ] Download foto yang diklaim → auto-granted access
- [ ] Klaim foto kedua → face descriptor updated (averaged)
- [ ] Face search accuracy improved after multiple claims
- [ ] Cannot claim same photo twice (duplicate prevention)
- [ ] Claimed photo accessible across multiple sessions
- [ ] Order purchase auto-saves to ClaimedPhoto
- [ ] Log activity shows "Claimed Photo" as download reason

### Automated Testing

```bash
# TypeScript compilation
.\node_modules\.bin\tsc.cmd --noEmit

# Next.js build
npm run build
```

---

## Future Enhancements

1. **Claim History UI** - Show all claimed photos in dashboard
2. **Smart Recommendations** - Suggest similar photos based on claimed ones
3. **Bulk Claim** - Allow claiming multiple photos at once
4. **Export Collection** - Download all claimed photos as ZIP
5. **Analytics Dashboard** - Show learning progress over time

---

## Integration with Existing Features

### Works With:
✅ Hard Negative Suppression (false positives)  
✅ Face Search API  
✅ Biometric Verification  
✅ Order System  
✅ Activity Logging

### Complements:
- False positives → negative learning
- Claimed photos → positive learning
- Together → more accurate model

---

## Conclusion

Sistem **Auto-Claimed Photo Collection & Continuous Learning** memberikan pengalaman yang lebih baik untuk user dengan:
- Menghilangkan friction dari klaim berulang
- Meningkatkan akurasi matching secara otomatis
- Menyederhanakan workflow download
- Memberikan value jangka panjang dari setiap klaim

**Result:** Happy users + Better AI = Win-win! 🎉
