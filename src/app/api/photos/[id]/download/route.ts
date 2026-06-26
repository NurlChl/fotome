import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import { Photo, Order, OrderItem, Event, User, FaceDescriptor } from '@/lib/db/models';
import { auth } from '@/lib/auth';
import { getSignedDownloadUrl } from '@/lib/cloudinary';
import { logActivity } from '@/lib/axiom';
import { getClientIp } from '@/lib/rate-limit';
import { getUserHardNegatives, isHardNegativeMatch, euclideanDistance, isPhotoClaimed } from '@/lib/biometrics';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/photos/[id]/download - Get signed download URL for purchased photo
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
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

    // Check photographer owner permission
    const isPhotographerOwner = eventObj && eventObj.photographerId && session.user.id === eventObj.photographerId.toString();
    const isBypassUser = session.user.role === 'admin' || session.user.role === 'superadmin' || !!isPhotographerOwner;

    // Check if photo was already claimed by the user (auto-grant access)
    const { claimed } = await isPhotoClaimed(session.user.id, photoId);
    const isClaimedPhoto = claimed;

    if (!isFree && !isBypassUser && !isClaimedPhoto) {
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

    // Biometric Owner Verification (except for Admin, Superadmin, Photographer Owner, and Claimed Photos)
    if (!isBypassUser && !isClaimedPhoto) {
      const fullUser = await User.findById(session.user.id);
      if (!fullUser || !fullUser.faceDescriptor || fullUser.faceDescriptor.length !== 128) {
        return NextResponse.json(
          { error: 'Biometric registration required. Please complete face recognition in your profile settings to download photos.' },
          { status: 400 }
        );
      }

      // Load user's hard negatives for continuous learning
      const hardNegatives = await getUserHardNegatives(session.user.id);

      // Check if photo contains any faces
      const photoFaces = await FaceDescriptor.find({ photoId: photo._id });
      if (photoFaces.length > 0) {
        let hasMatch = false;
        let lowestDistance = Infinity;

        for (const face of photoFaces) {
          const dist = euclideanDistance(fullUser.faceDescriptor, face.descriptor);
          if (dist < lowestDistance) lowestDistance = dist;
          
          // Check if this face matches a hard negative
          const isHardNegative = isHardNegativeMatch(face.descriptor, hardNegatives, dist);
          
          // Only count as match if distance is within threshold AND not a hard negative
          if (dist <= 0.55 && !isHardNegative) {
            hasMatch = true;
          }
        }

        if (!hasMatch) {
          const highestMatchPercentage = Math.round(Math.max(0, 1 - lowestDistance) * 100);
          return NextResponse.json(
            { error: `Biometric verification failed: You are not present in this photo (highest match: ${highestMatchPercentage}%).` },
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

    // Log download activity
    const clientIp = getClientIp(req);
    const downloadReason = isBypassUser ? 'Admin/Photographer' : isClaimedPhoto ? 'Claimed Photo' : isFree ? 'Free' : 'Purchased';
    logActivity(
      session.user.id,
      'DOWNLOAD_PHOTO',
      `Downloaded photo ID: ${photoId} from event: ${eventObj?.title || 'Unknown'} (${downloadReason})`,
      clientIp,
      photoId,
      eventObj?._id?.toString()
    );

    const downloadParam = req.nextUrl.searchParams.get('download');
    if (downloadParam === 'true') {
      const imageRes = await fetch(downloadUrl);
      if (!imageRes.ok) {
        return NextResponse.json(
          { error: 'Failed to fetch image from storage' },
          { status: 502 }
        );
      }
      const arrayBuffer = await imageRes.arrayBuffer();
      const contentType = imageRes.headers.get('Content-Type') || 'image/jpeg';
      
      return new NextResponse(Buffer.from(arrayBuffer), {
        headers: {
          'Content-Disposition': `attachment; filename="FotoMe-${photoId}.jpg"`,
          'Content-Type': contentType,
        },
      });
    }

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
