import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import { Category } from '@/lib/db/models';

const DEFAULT_CATEGORIES = [
  { name: 'Marathon', value: 'marathon' },
  { name: 'Concert', value: 'concert' },
  { name: 'Graduation', value: 'graduation' },
  { name: 'Wedding', value: 'wedding' },
  { name: 'Corporate', value: 'corporate' },
  { name: 'Community', value: 'community' },
  { name: 'Other', value: 'other' },
];

export async function GET(req: NextRequest) {
  try {
    await connectDB();

    // Check if empty, seed defaults
    const count = await Category.countDocuments();
    if (count === 0) {
      console.log('[Category Seed] Seeding default categories to database...');
      await Category.insertMany(DEFAULT_CATEGORIES);
    }

    const categories = await Category.find({}).sort({ name: 1 }).lean();

    return NextResponse.json({ categories });
  } catch (error) {
    console.error('Error fetching public categories:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
