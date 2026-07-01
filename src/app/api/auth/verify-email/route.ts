import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import User from '@/lib/db/models/User';

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();

    if (!token) {
      return NextResponse.json({ error: 'Token tidak ditemukan' }, { status: 400 });
    }

    await connectDB();

    const user = await User.findOne({
      verificationToken: token,
    });

    if (!user) {
      return NextResponse.json({ error: 'Token verifikasi tidak valid atau tidak ditemukan.' }, { status: 400 });
    }

    if (user.verificationTokenExpiry && user.verificationTokenExpiry < new Date()) {
      return NextResponse.json({ 
        error: 'Tautan verifikasi telah kedaluwarsa. Silakan masuk (login) ke akun Anda untuk mengirim ulang tautan verifikasi baru.' 
      }, { status: 400 });
    }

    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpiry = undefined;
    user.verificationEmailSentAt = undefined;
    await user.save();

    return NextResponse.json({ message: 'Email berhasil diverifikasi' });
  } catch (error) {
    console.error('Verify email error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan internal' }, { status: 500 });
  }
}
