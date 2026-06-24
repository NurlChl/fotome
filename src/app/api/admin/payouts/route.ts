import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import { User, Payout } from '@/lib/db/models';
import { auth } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';

/**
 * POST /api/admin/payouts - Approve or reject payout
 */
export async function POST(req: NextRequest) {
  const rateLimited = checkRateLimit(req, 'general');
  if (rateLimited) return rateLimited;

  try {
    const session = await auth();
    if (!session?.user || (session.user.role !== 'admin' && session.user.role !== 'superadmin')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (session.user.role === 'admin' && !session.user.permissions?.managePayouts) {
      return NextResponse.json({ error: 'Forbidden: Missing managePayouts permission' }, { status: 403 });
    }

    const { payoutId, action, notes } = await req.json();

    if (!payoutId || !action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'Payout ID and action (approve/reject) are required' },
        { status: 400 }
      );
    }

    await connectDB();

    const payout = await Payout.findById(payoutId);
    if (!payout) {
      return NextResponse.json({ error: 'Payout record not found' }, { status: 404 });
    }

    if (payout.status !== 'pending') {
      return NextResponse.json(
        { error: 'Payout is already processed' },
        { status: 400 }
      );
    }

    if (action === 'approve') {
      payout.status = 'completed';
      payout.notes = notes || 'Approved by Administrator';
      payout.processedAt = new Date();
      await payout.save();
    } else {
      payout.status = 'failed';
      payout.notes = notes || 'Rejected by Administrator';
      payout.processedAt = new Date();
      await payout.save();

      // Refund the photographer's available balance
      await User.findByIdAndUpdate(payout.photographerId, {
        $inc: {
          'photographerProfile.availableBalance': payout.amount,
        },
      });
    }

    return NextResponse.json({
      message: `Payout ${action === 'approve' ? 'approved' : 'rejected'} successfully`,
      payout,
    });
  } catch (error) {
    console.error('Error processing payout:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
