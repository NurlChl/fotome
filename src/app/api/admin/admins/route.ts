import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import User from '@/lib/db/models/User';
import { auth } from '@/lib/auth';

/**
 * GET /api/admin/admins - List all administrators (Superadmin only)
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden: Superadmin access required' }, { status: 403 });
    }

    await connectDB();

    const admins = await User.find({ role: { $in: ['admin', 'superadmin'] } })
      .select('name email role adminPermissions createdAt')
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ admins });
  } catch (error) {
    console.error('Error fetching admins:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/admin/admins - Create a new administrator (Superadmin only)
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden: Superadmin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { name, email, password, permissions } = body;

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Name, email, and password are required' }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters long' }, { status: 400 });
    }

    await connectDB();

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 });
    }

    // Set permissions object default values
    const adminPermissions = {
      manageUsers: !!permissions?.manageUsers,
      manageEvents: !!permissions?.manageEvents,
      managePayouts: !!permissions?.managePayouts,
    };

    // Create the admin user
    const newAdmin = await User.create({
      name,
      email: email.toLowerCase(),
      passwordHash: password, // Pre-save hook hashes this
      role: 'admin',
      isVerified: true,
      adminPermissions,
    });

    return NextResponse.json({
      message: 'Admin account created successfully',
      admin: {
        id: newAdmin._id,
        name: newAdmin.name,
        email: newAdmin.email,
        role: newAdmin.role,
        adminPermissions: newAdmin.adminPermissions,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating admin:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
