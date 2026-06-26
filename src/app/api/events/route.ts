import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import { Event } from '@/lib/db/models';
import { auth } from '@/lib/auth';
import { createEventSchema } from '@/lib/validation';
import { checkRateLimit } from '@/lib/rate-limit';

/**
 * GET /api/events - List published events (public)
 */
export async function GET(req: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '12');
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const sort = searchParams.get('sort') || 'newest';

    // Build query
    const query: Record<string, unknown> = { status: 'published' };

    if (category && category !== 'all') {
      query.category = category;
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } },
      ];
    }

    // Sort options
    const sortOptions: Record<string, Record<string, 1 | -1>> = {
      newest: { eventDate: -1 },
      oldest: { eventDate: 1 },
      popular: { photoCount: -1 },
    };

    const skip = (page - 1) * limit;
    const sortQuery = sortOptions[sort] || sortOptions.newest;

    const [events, total] = await Promise.all([
      Event.find(query)
        .sort(sortQuery)
        .skip(skip)
        .limit(limit)
        .populate('photographerId', 'name avatar')
        .lean(),
      Event.countDocuments(query),
    ]);

    return NextResponse.json({
      events,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + limit < total,
      },
    });
  } catch (error) {
    console.error('Error fetching events:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/events - Create new event (photographers only)
 */
export async function POST(req: NextRequest) {
  const rateLimited = checkRateLimit(req, 'general');
  if (rateLimited) return rateLimited;

  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (
      session.user.role !== 'photographer' &&
      session.user.role !== 'admin' &&
      session.user.role !== 'superadmin'
    ) {
      return NextResponse.json(
        { error: 'Only authorized roles can create events' },
        { status: 403 }
      );
    }

    if (session.user.role === 'admin' && !session.user.permissions?.manageEvents) {
      return NextResponse.json(
        { error: 'Forbidden: Insufficient permissions' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const result = createEventSchema.safeParse(body);

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

    const event = await Event.create({
      ...result.data,
      photographerId: session.user.id,
      eventDate: new Date(result.data.eventDate),
    });

    return NextResponse.json(
      { message: 'Event created successfully', event },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating event:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
