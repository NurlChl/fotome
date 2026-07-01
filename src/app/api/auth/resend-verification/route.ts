import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import User from '@/lib/db/models/User';
import { checkRateLimit } from '@/lib/rate-limit';
import { sendVerificationEmail } from '@/lib/mailer';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  // Rate limit check
  const rateLimited = checkRateLimit(req, 'auth');
  if (rateLimited) return rateLimited;

  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: 'Email wajib diisi.' }, { status: 400 });
    }

    await connectDB();

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return NextResponse.json({ error: 'Akun dengan email ini tidak ditemukan.' }, { status: 404 });
    }

    if (user.isVerified) {
      return NextResponse.json({ error: 'Email Anda sudah terverifikasi. Silakan masuk.' }, { status: 400 });
    }

    // Cooldown check (60 seconds)
    const COOLDOWN_MS = 60 * 1000;
    if (user.verificationEmailSentAt && (Date.now() - user.verificationEmailSentAt.getTime() < COOLDOWN_MS)) {
      const remainingSecs = Math.ceil((COOLDOWN_MS - (Date.now() - user.verificationEmailSentAt.getTime())) / 1000);
      return NextResponse.json({ 
        error: `Silakan tunggu ${remainingSecs} detik sebelum mengirim ulang email verifikasi.` 
      }, { status: 429 });
    }

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    user.verificationToken = verificationToken;
    user.verificationTokenExpiry = verificationTokenExpiry;
    user.verificationEmailSentAt = new Date();
    await user.save();

    // Send email asynchronously in the background
    sendVerificationEmail(user.email, verificationToken).catch((err) => {
      console.error('Failed to resend verification email in background:', err);
    });

    return NextResponse.json({
      message: 'Email verifikasi baru telah dikirim. Silakan periksa inbox atau kotak spam Anda.',
    });
  } catch (error) {
    console.error('Resend verification error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan internal.' },
      { status: 500 }
    );
  }
}
