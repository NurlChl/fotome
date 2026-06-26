import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import { PhotoClaim, FaceDescriptor, User } from '@/lib/db/models';
import { auth } from '@/lib/auth';
import { getClientIpResolved } from '@/lib/rate-limit';
import { cloudinary } from '@/lib/cloudinary';
import { logActivity } from '@/lib/axiom';
import { euclideanDistance, saveClaimedPhotoAndLearn } from '@/lib/biometrics';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Unauthorized. Silakan login terlebih dahulu untuk melakukan klaim foto.' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { selfieDataUrl, photoId, eventId, selfieDescriptor, isAIVerified } = body;

    if (!selfieDataUrl || !photoId || !eventId) {
      return NextResponse.json(
        { error: 'Input tidak lengkap. Data selfie, photoId, dan eventId wajib diisi.' },
        { status: 400 }
      );
    }

    // Upload base64 selfie image to Cloudinary
    let uploadResult;
    try {
      uploadResult = await cloudinary.uploader.upload(selfieDataUrl, {
        folder: 'fotome/claims',
        resource_type: 'image',
        quality: 'auto:good',
      });
    } catch (uploadError) {
      console.error('Cloudinary upload error in manual claim:', uploadError);
      return NextResponse.json(
        { error: 'Gagal mengunggah foto selfie verifikasi ke server penyimpanan.' },
        { status: 500 }
      );
    }

    await connectDB();

    // Find the best matching face descriptor in the photo
    const photoFaces = await FaceDescriptor.find({ photoId }).lean();
    let bestMatchDescriptor: number[] | null = null;
    let lowestDistance = Infinity;

    if (photoFaces.length > 0 && selfieDescriptor && selfieDescriptor.length === 128) {
      // Find the face in the photo that best matches the selfie
      for (const face of photoFaces) {
        const dist = euclideanDistance(selfieDescriptor, face.descriptor);
        if (dist < lowestDistance) {
          lowestDistance = dist;
          bestMatchDescriptor = face.descriptor;
        }
      }
    }

    // Determine if this is a verified AI match or manual claim
    const isMatched = isAIVerified === true; // If frontend confirms AI verified, mark as matched

    // Create the PhotoClaim log
    const ipAddress = await getClientIpResolved(req);
    const claim = await PhotoClaim.create({
      userId: session.user.id,
      eventId,
      photoId,
      selfieUrl: uploadResult.secure_url,
      selfieDescriptor: selfieDescriptor || undefined,
      ipAddress,
      isMatched, // true if AI verified, false if manual claim
    });

    // Auto-save to ClaimedPhoto collection and apply continuous learning
    if (bestMatchDescriptor) {
      const learned = await saveClaimedPhotoAndLearn(
        session.user.id,
        photoId,
        eventId,
        bestMatchDescriptor
      );

      if (learned) {
        console.log(`Auto-saved claimed photo ${photoId} for user ${session.user.id} with continuous learning`);
      }
    } else {
      // If no face match found but user is claiming anyway, try to use user's existing descriptor
      const user = await User.findById(session.user.id);
      if (user?.faceDescriptor && user.faceDescriptor.length === 128) {
        await saveClaimedPhotoAndLearn(
          session.user.id,
          photoId,
          eventId,
          user.faceDescriptor
        );
      }
    }

    // Log activity
    const activityAction = isMatched ? 'CLAIM_PHOTO_AI_VERIFIED' : 'CLAIM_PHOTO_MANUAL';
    const activityDetails = isMatched 
      ? `AI-verified claim for photo ID: ${photoId} in event ID: ${eventId} (face match confirmed)`
      : `Manually claimed photo ID: ${photoId} in event ID: ${eventId} with selfie re-verification`;
    
    await logActivity(
      session.user.id,
      activityAction,
      activityDetails,
      ipAddress,
      photoId,
      eventId
    );

    return NextResponse.json({
      success: true,
      claim,
      continuousLearning: !!bestMatchDescriptor,
      isMatched,
    });
  } catch (error) {
    console.error('Manual photo claim error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan sistem saat memproses klaim foto Anda.' },
      { status: 500 }
    );
  }
}
