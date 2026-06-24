import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import { Photo, Order, OrderItem, Event, User, FaceDescriptor } from '@/lib/db/models';
import { auth } from '@/lib/auth';
import { getSignedDownloadUrl } from '@/lib/cloudinary';

interface RouteParams {
  params: Promise<{ id: string }>;
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;
  return dotProduct / denominator;
}

/**
 * GET /api/photos/[id]/download - Get signed download URL for purchased photo
 */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: photoId } = await params;
    await connectDB();

    // Get photo details
    const photo = await Photo.findById(photoId);
    if (!photo) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
    }

    // Check if the event of the photo is free
    const eventObj = await Event.findById(photo.eventId);
    const isFree = eventObj && eventObj.pricePerPhoto === 0;

    if (!isFree) {
      // Verify the user has purchased this photo
      const paidOrders = await Order.find({
        userId: session.user.id,
        status: 'paid',
      }).distinct('_id');

      const purchasedItem = await OrderItem.findOne({
        orderId: { $in: paidOrders },
        photoId,
      });

      if (!purchasedItem) {
        return NextResponse.json(
          { error: 'You have not purchased this photo' },
          { status: 403 }
        );
      }
    }

    // Biometric Owner Verification (except for Admin & Superadmin)
    if (session.user.role !== 'admin' && session.user.role !== 'superadmin') {
      const fullUser = await User.findById(session.user.id);
      if (!fullUser || !fullUser.faceDescriptor || fullUser.faceDescriptor.length !== 128) {
        return NextResponse.json(
          { error: 'Biometric registration required. Please complete face recognition in your profile settings to download photos.' },
          { status: 400 }
        );
      }

      // Check if photo contains any faces
      const photoFaces = await FaceDescriptor.find({ photoId: photo._id });
      if (photoFaces.length > 0) {
        let hasMatch = false;
        let highestScore = 0;

        for (const face of photoFaces) {
          const score = cosineSimilarity(fullUser.faceDescriptor, face.descriptor);
          if (score > highestScore) highestScore = score;
          if (score >= 0.65) {
            hasMatch = true;
          }
        }

        if (!hasMatch) {
          return NextResponse.json(
            { error: `Biometric verification failed: You are not present in this photo (highest match: ${Math.round(highestScore * 100)}%).` },
            { status: 403 }
          );
        }
      } else {
        // If the photo contains no faces, but it has hasFaces set to true, block it
        if (photo.hasFaces) {
          return NextResponse.json(
            { error: 'Biometric verification pending for this photo.' },
            { status: 403 }
          );
        }
      }
    }

    // Generate signed download URL (expires in 1 hour)
    const downloadUrl = getSignedDownloadUrl(photo.cloudinaryPublicId);

    return NextResponse.json({
      downloadUrl,
      expiresIn: 3600, // seconds
    });
  } catch (error) {
    console.error('Error generating download URL:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
