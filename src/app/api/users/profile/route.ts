import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import { User, FaceSearch } from '@/lib/db/models';
import { auth } from '@/lib/auth';
import { updateProfileSchema } from '@/lib/validation';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { logActivity } from '@/lib/axiom';

/**
 * GET /api/users/profile - Get current user profile
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();
    const user = await User.findById(session.user.id).select('-passwordHash');
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Error fetching profile:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/users/profile - Update user profile
 */
export async function PUT(req: NextRequest) {
  const rateLimited = checkRateLimit(req, 'general');
  if (rateLimited) return rateLimited;

  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const result = updateProfileSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        {
          error: 'Validation error',
          details: result.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    await connectDB();
    const user = await User.findById(session.user.id);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { name, bio, portfolio, faceDescriptor, faceDescriptorLeft, faceDescriptorRight, faceImageUrl } = result.data;

    if (name) user.name = name;

    let uploadedFaceImageUrl = '';
    if (faceImageUrl && faceImageUrl.startsWith('data:image/')) {
      try {
        const { uploadImage } = await import('@/lib/cloudinary');
        const base64Data = faceImageUrl.split(';base64,').pop();
        if (base64Data) {
          const buffer = Buffer.from(base64Data, 'base64');
          const uploadResult = await uploadImage(buffer, {
            folder: 'fotome/users/face-ids',
            tags: ['user-face-id', user._id.toString()],
          });
          uploadedFaceImageUrl = uploadResult.secure_url;
        }
      } catch (uploadErr) {
        console.error('Error uploading face image to Cloudinary:', uploadErr);
      }
    }

    if (faceImageUrl !== undefined) {
      if (uploadedFaceImageUrl) {
        user.faceImageUrl = uploadedFaceImageUrl;
      } else if (faceImageUrl === null || faceImageUrl === '') {
        user.faceImageUrl = undefined;
      }
    }

    if (faceDescriptor) {
      user.faceDescriptor = faceDescriptor;
    }
    if (faceDescriptorLeft) {
      user.faceDescriptorLeft = faceDescriptorLeft;
    }
    if (faceDescriptorRight) {
      user.faceDescriptorRight = faceDescriptorRight;
    }
    if (faceDescriptor || faceDescriptorLeft || faceDescriptorRight) {
      await logActivity(
        user._id.toString(),
        'REGISTER_FACE_ID',
        'Registered/updated Face ID biometric profile with multi-angle descriptors',
        getClientIp(req)
      );
    }

    if (user.role === 'photographer') {
      if (!user.photographerProfile) {
        user.photographerProfile = {
          bio: bio || '',
          portfolio: portfolio || '',
          totalRevenue: 0,
          availableBalance: 0,
        };
      } else {
        if (bio !== undefined) user.photographerProfile.bio = bio;
        if (portfolio !== undefined) user.photographerProfile.portfolio = portfolio;
      }
    }

    await user.save();

    return NextResponse.json({
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        photographerProfile: user.photographerProfile,
      },
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/users/profile - Delete all biometric search history
 */
export async function DELETE(req: NextRequest) {
  const rateLimited = checkRateLimit(req, 'general');
  if (rateLimited) return rateLimited;

  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    // Delete all face search logs for this user
    const deleteResult = await FaceSearch.deleteMany({
      userId: session.user.id,
    });

    // Also delete user's registered face descriptor and face image
    const user = await User.findById(session.user.id);
    if (user) {
      user.faceDescriptor = undefined;
      user.faceDescriptorLeft = undefined;
      user.faceDescriptorRight = undefined;
      user.faceImageUrl = undefined;
      await user.save();
    }

    await logActivity(
      session.user.id,
      'DELETE_BIOMETRICS',
      'Deleted Face ID biometric profile and search logs',
      getClientIp(req)
    );

    return NextResponse.json({
      message: 'Biometric data and search logs deleted successfully',
      deletedCount: deleteResult.deletedCount,
    });
  } catch (error) {
    console.error('Error deleting biometric data:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
