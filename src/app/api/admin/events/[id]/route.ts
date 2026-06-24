import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import { Event } from '@/lib/db/models';
import { auth } from '@/lib/auth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * DELETE /api/admin/events/[id] - Delete event (Admin/Superadmin only)
 */
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Security: Only admin/superadmin with manageEvents permission
    const role = session.user.role;
    const canManageEvents = role === 'superadmin' || 
      (role === 'admin' && session.user.permissions?.manageEvents);

    if (!canManageEvents) {
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;
    await connectDB();

    const event = await Event.findById(id);
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Soft delete: archive instead of hard delete
    event.status = 'archived';
    await event.save();

    return NextResponse.json({ message: 'Event archived successfully' });
  } catch (error) {
    console.error('Error deleting event:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
