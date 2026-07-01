import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import User from '@/lib/db/models/User';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  const rateLimited = checkRateLimit(req, 'auth');
  if (rateLimited) return rateLimited;

  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ unverified: false });
    }

    await connectDB();

    const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
    if (!user) {
      return NextResponse.json({ unverified: false });
    }

    const isValid = await user.comparePassword(password);
    if (!isValid) {
      return NextResponse.json({ unverified: false });
    }

    if (!user.isVerified) {
      return NextResponse.json({ unverified: true });
    }

    return NextResponse.json({ unverified: false });
  } catch (error) {
    console.error('Verify status check error:', error);
    return NextResponse.json({ unverified: false });
  }
}
