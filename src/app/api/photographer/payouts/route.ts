import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import { User, Payout } from '@/lib/db/models';
import { auth } from '@/lib/auth';
import { createPayoutSchema } from '@/lib/validation';
import { checkRateLimit } from '@/lib/rate-limit';

/**
 * POST /api/photographer/payouts - Request a payout
 */
export async function POST(req: NextRequest) {
  const rateLimited = checkRateLimit(req, 'general');
  if (rateLimited) return rateLimited;

  try {
    const session = await auth();
    if (!session?.user || (session.user.role !== 'photographer' && session.user.role !== 'admin' && session.user.role !== 'superadmin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const result = createPayoutSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        {
          error: 'Validation error',
          details: result.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { amount, bankName, bankAccount } = result.data;

    await connectDB();

    const user = await User.findById(session.user.id);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const balance = user.photographerProfile?.availableBalance || 0;
    if (balance < amount) {
      return NextResponse.json(
        { error: 'Insufficient balance to request payout' },
        { status: 400 }
      );
    }

    // Create the payout record
    const payout = await Payout.create({
      photographerId: user._id,
      amount,
      status: 'pending',
      bankName,
      bankAccount,
      requestedAt: new Date(),
    });

    // Deduct the photographer's available balance
    await User.findByIdAndUpdate(user._id, {
      $inc: {
        'photographerProfile.availableBalance': -amount,
      },
    });

    return NextResponse.json(
      {
        message: 'Payout requested successfully',
        payout: {
          id: payout._id,
          amount: payout.amount,
          status: payout.status,
          requestedAt: payout.requestedAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error requesting payout:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
