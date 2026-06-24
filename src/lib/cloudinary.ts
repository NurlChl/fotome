import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export { cloudinary };

// ============================================
// Upload Helpers
// ============================================

interface UploadOptions {
  folder: string;
  publicId?: string;
  tags?: string[];
  detectFaces?: boolean;
}

/**
 * Upload image to Cloudinary
 */
export async function uploadImage(
  fileBuffer: Buffer,
  options: UploadOptions
): Promise<UploadApiResponse> {
  return new Promise((resolve, reject) => {
    const uploadOptions: Record<string, unknown> = {
      folder: options.folder,
      resource_type: 'image',
      faces: options.detectFaces ?? true,
      quality: 'auto:best',
      fetch_format: 'auto',
      tags: options.tags || [],
    };

    if (options.publicId) {
      uploadOptions.public_id = options.publicId;
    }

    const uploadStream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        if (error) {
          reject(error);
        } else if (result) {
          resolve(result);
        } else {
          reject(new Error('Upload failed: no result returned'));
        }
      }
    );

    uploadStream.end(fileBuffer);
  });
}

/**
 * Upload event photo with face detection enabled
 */
export async function uploadEventPhoto(
  fileBuffer: Buffer,
  eventSlug: string,
  photographerId: string
): Promise<UploadApiResponse> {
  return uploadImage(fileBuffer, {
    folder: `fotome/events/${eventSlug}`,
    detectFaces: true,
    tags: ['event-photo', eventSlug, photographerId],
  });
}

// ============================================
// URL Generators
// ============================================

/**
 * Generate watermarked preview URL
 * Applies a semi-transparent "FotoMe" text overlay
 */
export function getWatermarkedUrl(publicId: string): string {
  return cloudinary.url(publicId, {
    transformation: [
      { width: 1200, crop: 'limit', quality: 'auto:good' },
      {
        overlay: {
          font_family: 'Arial',
          font_size: 60,
          font_weight: 'bold',
          text: 'FotoMe',
        },
        opacity: 40,
        gravity: 'center',
        color: '#FFFFFF',
      },
      {
        overlay: {
          font_family: 'Arial',
          font_size: 60,
          font_weight: 'bold',
          text: 'FotoMe',
        },
        opacity: 30,
        gravity: 'north_east',
        x: 20,
        y: 20,
        color: '#FFFFFF',
      },
      {
        overlay: {
          font_family: 'Arial',
          font_size: 40,
          text: 'FotoMe',
        },
        opacity: 25,
        gravity: 'south_west',
        x: 20,
        y: 20,
        color: '#FFFFFF',
        angle: -30,
      },
    ],
    secure: true,
  });
}

/**
 * Generate thumbnail URL
 */
export function getThumbnailUrl(publicId: string, size = 400): string {
  return cloudinary.url(publicId, {
    transformation: [
      {
        width: size,
        height: size,
        crop: 'fill',
        gravity: 'face',
        quality: 'auto:low',
        fetch_format: 'auto',
      },
    ],
    secure: true,
  });
}

/**
 * Generate signed download URL for purchased photos (expires in 1 hour)
 */
export function getSignedDownloadUrl(publicId: string): string {
  const expiresAt = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
  return cloudinary.url(publicId, {
    sign_url: true,
    type: 'authenticated',
    transformation: [
      { quality: 'auto:best', fetch_format: 'auto' },
    ],
    secure: true,
    resource_type: 'image',
    expires_at: expiresAt,
  });
}

/**
 * Delete image from Cloudinary
 */
export async function deleteImage(publicId: string): Promise<void> {
  await cloudinary.uploader.destroy(publicId);
}

/**
 * Get face crop URL (for face thumbnails within a photo)
 */
export function getFaceCropUrl(
  publicId: string,
  boundingBox: { x: number; y: number; width: number; height: number }
): string {
  return cloudinary.url(publicId, {
    transformation: [
      {
        width: boundingBox.width,
        height: boundingBox.height,
        x: boundingBox.x,
        y: boundingBox.y,
        crop: 'crop',
      },
      {
        width: 150,
        height: 150,
        crop: 'fill',
        gravity: 'face',
      },
    ],
    secure: true,
  });
}
