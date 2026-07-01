import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import User from '@/lib/db/models/User';
import { registerSchema } from '@/lib/validation';
import { checkRateLimit } from '@/lib/rate-limit';
import { sendVerificationEmail } from '@/lib/mailer';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  // Rate limit check
  const rateLimited = checkRateLimit(req, 'auth');
  if (rateLimited) return rateLimited;

  try {
    const body = await req.json();

    // Validate input
    const result = registerSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        {
          error: 'Validation error',
          details: result.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { name, email, password, role } = result.data;

    if (role === 'photographer') {
      return NextResponse.json(
        { error: 'Photographer registration is temporarily suspended.' },
        { status: 400 }
      );
    }

    await connectDB();

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      // If user exists but hasn't verified yet, help them resend
      if (!existingUser.isVerified) {
        const COOLDOWN_MS = 60 * 1000;
        const canResend = !existingUser.verificationEmailSentAt ||
          (Date.now() - existingUser.verificationEmailSentAt.getTime() >= COOLDOWN_MS);

        if (canResend) {
          const verificationToken = crypto.randomBytes(32).toString('hex');
          const verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
          existingUser.verificationToken = verificationToken;
          existingUser.verificationTokenExpiry = verificationTokenExpiry;
          existingUser.verificationEmailSentAt = new Date();
          await existingUser.save();
          sendVerificationEmail(email, verificationToken).catch((err) => {
            console.error('Failed to resend verification email in background:', err);
          });
        }

        const remainingSecs = canResend ? 0 : Math.ceil(
          (COOLDOWN_MS - (Date.now() - existingUser.verificationEmailSentAt!.getTime())) / 1000
        );

        return NextResponse.json(
          {
            error: 'Email ini sudah terdaftar namun belum diverifikasi.',
            code: 'unverified',
            emailSent: canResend,
            cooldownSecs: remainingSecs,
          },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: 'Email ini sudah terdaftar. Silakan masuk atau gunakan email lain.' },
        { status: 409 }
      );
    }

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create user
    const user = await User.create({
      name,
      email,
      passwordHash: password, // Will be hashed by pre-save hook
      role,
      isVerified: false,
      verificationToken,
      verificationTokenExpiry,
      verificationEmailSentAt: new Date(),
      photographerProfile: undefined,
    });

    // Send email asynchronously in the background
    sendVerificationEmail(email, verificationToken).catch((err) => {
      console.error('Failed to send verification email in background:', err);
    });

    return NextResponse.json(
      {
        message: 'Account created successfully',
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
