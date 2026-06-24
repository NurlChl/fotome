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

/**
 * PUT /api/admin/admins - Update administrator (Superadmin only)
 */
export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden: Superadmin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { adminId, name, email, permissions } = body;

    if (!adminId) {
      return NextResponse.json({ error: 'Admin ID is required' }, { status: 400 });
    }

    await connectDB();

    const admin = await User.findById(adminId);
    if (!admin) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
    }

    // Cannot edit superadmin
    if (admin.role === 'superadmin') {
      return NextResponse.json({ error: 'Cannot edit superadmin account' }, { status: 403 });
    }

    // Update fields
    if (name) admin.name = name;
    if (email) admin.email = email.toLowerCase();
    if (permissions) {
      admin.adminPermissions = {
        manageUsers: !!permissions.manageUsers,
        manageEvents: !!permissions.manageEvents,
        managePayouts: !!permissions.managePayouts,
      };
    }

    await admin.save();

    return NextResponse.json({
      message: 'Admin updated successfully',
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        adminPermissions: admin.adminPermissions,
      },
    });
  } catch (error) {
    console.error('Error updating admin:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/admins - Delete administrator (Superadmin only)
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden: Superadmin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { adminId } = body;

    if (!adminId) {
      return NextResponse.json({ error: 'Admin ID is required' }, { status: 400 });
    }

    await connectDB();

    const admin = await User.findById(adminId);
    if (!admin) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
    }

    // Cannot delete superadmin
    if (admin.role === 'superadmin') {
      return NextResponse.json({ error: 'Cannot delete superadmin account' }, { status: 403 });
    }

    // Cannot delete self
    if (admin._id.toString() === session.user.id) {
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 403 });
    }

    await User.findByIdAndDelete(adminId);

    return NextResponse.json({ message: 'Admin deleted successfully' });
  } catch (error) {
    console.error('Error deleting admin:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
