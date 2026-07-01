import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import { FalsePositiveFlag } from '@/lib/db/models';
import { auth } from '@/lib/auth';
import { logActivity } from '@/lib/axiom';
import { getClientIpResolved } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Unauthorized. Silakan login terlebih dahulu untuk melakukan aksi ini.' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { photoId, eventId } = body;

    if (!photoId || !eventId) {
      return NextResponse.json(
        { error: 'photoId dan eventId wajib dikirimkan.' },
        { status: 400 }
      );
    }

    await connectDB();

    // Get public/client IP address
    const ipAddress = await getClientIpResolved(req);

    // Upsert the false positive flag to prevent duplicate entries
    await FalsePositiveFlag.findOneAndUpdate(
      { userId: session.user.id, photoId },
      { userId: session.user.id, photoId, eventId, ipAddress },
      { upsert: true, new: true }
    );

    // Log activity
    await logActivity(
      session.user.id,
      'FLAG_FALSE_POSITIVE',
      `Flagged photo ID: ${photoId} as false positive in event ID: ${eventId}`,
      ipAddress,
      photoId,
      eventId
    );

    return NextResponse.json({
      success: true,
      message: 'Foto berhasil ditandai sebagai bukan foto Anda.',
    });
  } catch (error) {
    console.error('Flag false positive error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan sistem saat menandai foto.' },
      { status: 500 }
    );
  }
}
