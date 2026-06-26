import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import { User } from '@/lib/db/models';

export async function POST(req: NextRequest) {
  try {
    const { userIds } = await req.json();
    await connectDB();

    const users = await User.find(
      { _id: { $in: userIds } },
      { _id: 1, name: 1, email: 1 }
    );

    return NextResponse.json({ users });
  } catch (error) {
    console.error('Error fetching users in batch:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
