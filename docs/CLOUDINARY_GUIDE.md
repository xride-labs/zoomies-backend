# Cloudinary Setup & Integration Guide

Complete guide for setting up and using Cloudinary for image/video uploads in Zoomies.

## 📋 Table of Contents

1. [Account Setup](#account-setup)
2. [Environment Configuration](#environment-configuration)
3. [Upload Endpoints](#upload-endpoints)
4. [Frontend Integration](#frontend-integration)
5. [Image Transformations](#image-transformations)
6. [Best Practices](#best-practices)
7. [Troubleshooting](#troubleshooting)

---

## 🔧 Account Setup

### 1. Create Cloudinary Account

1. Go to [Cloudinary.com](https://cloudinary.com/users/register/free)
2. Sign up for a free account (25GB storage, 25GB bandwidth/month)
3. Verify your email

### 2. Get Your Credentials

After logging in:

1. Go to **Dashboard**
2. Find your **Account Details**:
   - Cloud Name: `dxxxxxxxxx`
   - API Key: `123456789012345`
   - API Secret: `abcdefghijklmnopqrstuvwxyz123456`

### 3. Configure Upload Presets (Optional)

For direct client uploads:

1. Go to **Settings** → **Upload**
2. Click **Add upload preset**
3. Name it (e.g., `zoomies_mobile`)
4. Set **Signing Mode** to `Unsigned` for client uploads
5. Set **Folder** to organize uploads
6. Save

---

## 🔐 Environment Configuration

### Backend (.env)

Add to `zoomies-backend/.env`:

```env
# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

### Verify Configuration

The backend automatically loads these on startup. Check console logs:

```
✅ Cloudinary configured: your_cloud_name
```

---

## 📤 Upload Endpoints

### Backend API Endpoints

All endpoints are in `src/routes/media.routes.ts`:

#### 1. **Profile Avatar**

```
POST /api/media/upload/profile
Body: { "file": "data:image/jpeg;base64,..." }
```

- Updates `user.avatar`
- Size: 400x400px
- Face detection enabled

#### 2. **Profile Cover**

```
POST /api/media/upload/profile/cover
Body: { "file": "data:image/jpeg;base64,..." }
```

- Updates `user.coverImage`
- Size: 1200x400px

#### 3. **Profile Gallery**

```
POST /api/media/upload/profile/gallery
Body: { "file": "data:image/jpeg;base64,..." }
```

- Does NOT update user record
- Returns URL for manual storage

#### 4. **Bike Image**

```
POST /api/media/upload/bike/:bikeId
Body: { "file": "data:image/jpeg;base64,..." }
```

- Updates `bike.image`
- Verifies bike ownership
- Size: 1000x750px

#### 5. **Club Logo**

```
POST /api/media/upload/club/:clubId
Body: { "file": "data:image/jpeg;base64,...", "type": "logo" }
```

- Updates `club.image`
- Verifies club ownership
- Size: 500x500px

#### 6. **Club Cover**

```
POST /api/media/upload/club/:clubId
Body: { "file": "data:image/jpeg;base64,...", "type": "cover" }
```

- Updates `club.coverImage`
- Size: 1200x400px

#### 7. **Club Gallery**

```
POST /api/media/upload/club/:clubId/gallery
Body: { "file": "data:image/jpeg;base64,..." }
```

- Returns URL for manual storage

---

## 📁 Folder Structure

Images are organized in Cloudinary:

```
zoomies/
├── profiles/           # User avatars
│   ├── profile_<userId>
│   ├── covers/        # User cover images
│   │   └── cover_<userId>
│   └── galleries/     # User gallery images
│       └── user_<userId> (tag)
├── bikes/             # Bike images
│   └── bike_<bikeId>
├── clubs/             # Club logos
│   ├── logo_<clubId>
│   ├── covers/        # Club cover images
│   │   └── cover_<clubId>
│   └── galleries/     # Club gallery images
│       └── club_<clubId> (tag)
├── rides/             # Ride photos/videos
│   └── ride_<rideId> (tag)
├── marketplace/       # Listing images
│   └── listing_<listingId> (tag)
└── posts/             # Social post media
    └── post_<postId> (tag)
```

---

## 🎨 Image Transformations

All images are automatically optimized:

### Profile Avatar

```javascript
{
  width: 400,
  height: 400,
  crop: "fill",
  gravity: "face",  // Centers on detected face
  quality: "auto",
  fetch_format: "auto"  // WebP when supported
}
```

### Cover Images

```javascript
{
  width: 1200,
  height: 400,
  crop: "fill",
  quality: "auto",
  fetch_format: "auto"
}
```

### Bike Images

```javascript
{
  width: 1000,
  height: 750,
  crop: "limit",  // Maintains aspect ratio
  quality: "auto",
  fetch_format: "auto"
}
```

### Thumbnails (Auto-generated)

```javascript
{
  width: 200,
  height: 200,
  crop: "fill",
  quality: "auto",
  fetch_format: "auto"
}
```

---

## 🎯 Frontend Integration

### React Native (Mobile) Example

```typescript
import { userService } from '@/lib/services';
import * as ImagePicker from 'expo-image-picker';

// Pick and upload image
const uploadAvatar = async () => {
  // 1. Pick image
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
    base64: true,
  });

  if (!result.canceled && result.assets[0].base64) {
    // 2. Convert to base64 data URI
    const base64 = `data:image/jpeg;base64,${result.assets[0].base64}`;

    // 3. Upload
    const response = await userService.uploadAvatar(base64);
    
    console.log('Uploaded:', response.data.data.imageUrl);
  }
};
```

### Next.js (Web) Example

```typescript
import { userService } from '@/lib/services';

const uploadAvatar = async (file: File) => {
  // Convert file to base64
  const reader = new FileReader();
  reader.readAsDataURL(file);
  
  reader.onload = async () => {
    const base64 = reader.result as string;
    
    const response = await userService.uploadAvatar(base64);
    console.log('Uploaded:', response.data.data.imageUrl);
  };
};
```

### Service Function

Add to `src/lib/services.ts`:

```typescript
export const userService = {
  uploadAvatar: (base64Image: string) =>
    api.post('/media/upload/profile', { file: base64Image }),
    
  uploadCover: (base64Image: string) =>
    api.post('/media/upload/profile/cover', { file: base64Image }),
    
  uploadGalleryImage: (base64Image: string) =>
    api.post('/media/upload/profile/gallery', { file: base64Image }),
};

export const bikeService = {
  uploadBikeImage: (bikeId: string, base64Image: string) =>
    api.post(`/media/upload/bike/${bikeId}`, { file: base64Image }),
};

export const clubService = {
  uploadClubLogo: (clubId: string, base64Image: string) =>
    api.post(`/media/upload/club/${clubId}`, { 
      file: base64Image, 
      type: 'logo' 
    }),
    
  uploadClubCover: (clubId: string, base64Image: string) =>
    api.post(`/media/upload/club/${clubId}`, { 
      file: base64Image, 
      type: 'cover' 
    }),
    
  uploadGalleryImage: (clubId: string, base64Image: string) =>
    api.post(`/media/upload/club/${clubId}/gallery`, { file: base64Image }),
};
```

---

## ✨ Best Practices

### 1. **Image Size Limits**

Before uploading, resize images on client:

```typescript
// React Native
const result = await ImagePicker.launchImageLibraryAsync({
  quality: 0.8,  // Compress to 80%
  allowsEditing: true,
  aspect: [1, 1],  // For avatars
});

// Web - Use libraries like 'browser-image-compression'
import imageCompression from 'browser-image-compression';

const compressedFile = await imageCompression(file, {
  maxSizeMB: 1,
  maxWidthOrHeight: 1920,
});
```

### 2. **Error Handling**

```typescript
try {
  const response = await userService.uploadAvatar(base64);
  // Success
} catch (error) {
  if (error.response?.data?.error?.code === 'UPLOAD_FAILED') {
    alert('Failed to upload image. Please try again.');
  }
}
```

### 3. **Loading States**

```typescript
const [uploading, setUploading] = useState(false);

const handleUpload = async (base64: string) => {
  setUploading(true);
  try {
    await userService.uploadAvatar(base64);
  } finally {
    setUploading(false);
  }
};
```

### 4. **Delete Old Images**

When updating, delete old images:

```typescript
// Backend automatically overwrites with same publicId
// For galleries, track publicIds and delete manually:

await api.delete(`/media/${oldPublicId}?resourceType=image`);
```

---

## 🐛 Troubleshooting

### Issue: "Upload Failed"

**Cause**: Invalid credentials or base64 format

**Solution**:

1. Check `.env` has correct Cloudinary credentials
2. Verify base64 starts with `data:image/...`
3. Check Cloudinary Dashboard → Usage (not exceeded quota)

---

### Issue: "413 Payload Too Large"

**Cause**: Image file too big

**Solution**:

1. Compress image before upload
2. Reduce quality (0.7-0.8)
3. Resize dimensions

---

### Issue: "Unauthorized"

**Cause**: Missing authentication token

**Solution**:

- Ensure user is logged in
- Check session cookie is sent
- Verify API request includes credentials

---

### Issue: "Forbidden - Not owner"

**Cause**: User doesn't own the resource

**Solution**:

- Verify `bikeId` belongs to user
- Check `clubId` ownership
- Ensure user has required role

---

### Issue: Images not loading in app

**Cause**: CORS or HTTPS issues

**Solution**:

1. Use `secureUrl` instead of `url` (HTTPS)
2. Check image URL in browser
3. Verify Cloudinary CORS settings in Dashboard

---

## 📊 Monitoring Usage

### Cloudinary Dashboard

1. **Usage**: Track bandwidth and storage
2. **Media Library**: Browse uploaded images
3. **Reports**: Analyze transformations

### Free Tier Limits

- **Storage**: 25 GB
- **Bandwidth**: 25 GB/month
- **Transformations**: 25,000/month

If exceeded, upgrade to paid plan or optimize:

- Delete unused images
- Use lower quality settings
- Enable client-side caching

---

## 🚀 Advanced Features

### 1. **Direct Client Uploads** (Skip backend)

```typescript
// Generate signature from backend
const { data } = await api.post('/media/signature', { 
  folder: 'profiles' 
});

const { signature, timestamp, cloudName, apiKey } = data.data.signature;

// Upload directly to Cloudinary
const formData = new FormData();
formData.append('file', file);
formData.append('signature', signature);
formData.append('timestamp', timestamp);
formData.append('api_key', apiKey);
formData.append('folder', 'zoomies/profiles');

const response = await fetch(
  `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
  { method: 'POST', body: formData }
);
```

### 2. **Video Uploads**

For ride videos:

```typescript
const result = await uploadRideMedia(
  base64Video,
  rideId,
  MediaType.VIDEO
);
```

### 3. **Lazy Loading Images**

Use Cloudinary's automatic format and quality:

```typescript
<Image 
  source={{ uri: `${imageUrl}?q_auto,f_auto` }} 
  placeholder="blur"
/>
```

---

## 📚 Resources

- [Cloudinary Documentation](https://cloudinary.com/documentation)
- [React Native Image Picker](https://docs.expo.dev/versions/latest/sdk/imagepicker/)
- [Image Optimization Guide](https://cloudinary.com/documentation/image_optimization)

---

**Need Help?** Open an issue or check the API_DOCUMENTATION.md
