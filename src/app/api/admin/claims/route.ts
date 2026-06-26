import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import { PhotoClaim, FalsePositiveFlag } from '@/lib/db/models';
import { auth } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = session.user.role;
    if (role !== 'admin' && role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (role === 'admin' && !session.user.permissions?.manageUsers) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await connectDB();

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '50')));
    const windowSize = Math.min(500, page * limit);

    const [claimsData, falsePositivesData, totalClaims, totalFalsePositives] = await Promise.all([
      PhotoClaim.find({})
        .populate({
          path: 'userId',
          select: 'name email faceDescriptor faceImageUrl',
        })
        .populate({
          path: 'eventId',
          select: 'title slug',
        })
        .populate({
          path: 'photoId',
          select: 'watermarkedUrl thumbnailUrl',
        })
        .sort({ createdAt: -1 })
        .limit(windowSize)
        .lean(),
      FalsePositiveFlag.find({})
        .populate({
          path: 'userId',
          select: 'name email',
        })
        .populate({
          path: 'eventId',
          select: 'title slug',
        })
        .populate({
          path: 'photoId',
          select: 'watermarkedUrl thumbnailUrl',
        })
        .sort({ createdAt: -1 })
        .limit(windowSize)
        .lean(),
      PhotoClaim.countDocuments({}),
      FalsePositiveFlag.countDocuments({}),
    ]);

    // Map PhotoClaim entries
    const mappedClaims = claimsData.map(c => ({
      ...c,
      _id: c._id.toString(),
      ipAddress: c.ipAddress || 'N/A',
      type: c.isMatched ? 'biometric' : 'override',
    }));

    // Map FalsePositiveFlag entries
    const mappedFalsePositives = falsePositivesData.map(fp => ({
      _id: fp._id.toString(),
      userId: fp.userId,
      eventId: fp.eventId,
      photoId: fp.photoId,
      ipAddress: fp.ipAddress || 'N/A',
      selfieUrl: null, // False positives don't have selfie
      selfieDescriptor: null,
      isMatched: false, // False positives are not matches
      type: 'false_positive',
      createdAt: fp.createdAt,
    }));

    // Combine both arrays
    const allEntries = [...mappedClaims, ...mappedFalsePositives].sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const total = totalClaims + totalFalsePositives;
    const skip = (page - 1) * limit;
    const paged = allEntries.slice(skip, skip + limit);

    return NextResponse.json({ 
      claims: paged,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + limit < total,
      },
    });
  } catch (error) {
    console.error('Error fetching admin claims:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
