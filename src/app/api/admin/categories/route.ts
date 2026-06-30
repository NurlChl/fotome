import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import { Category, ActivityLog } from '@/lib/db/models';
import { auth } from '@/lib/auth';

// Helper to check admin permission
async function checkPermission() {
  const session = await auth();
  if (!session?.user) {
    return { error: 'Unauthorized', status: 401 };
  }
  const isSuperadmin = session.user.role === 'superadmin';
  const hasPermission = isSuperadmin || !!session.user.permissions?.manageCategories;
  
  if (!hasPermission) {
    return { error: 'Forbidden', status: 403 };
  }
  return { session };
}

export async function GET(req: NextRequest) {
  try {
    const authCheck = await checkPermission();
    if (authCheck.error) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
    }

    await connectDB();
    const categories = await Category.find({}).sort({ createdAt: -1 });
    return NextResponse.json({ categories });
  } catch (error) {
    console.error('Error in GET /api/admin/categories:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authCheck = await checkPermission();
    if (authCheck.error) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
    }

    const body = await req.json();
    const { name, value } = body;

    if (!name || !value) {
      return NextResponse.json({ error: 'Name and Value are required' }, { status: 400 });
    }

    const cleanName = name.trim();
    const cleanValue = value.toLowerCase().trim().replace(/\s+/g, '-');

    await connectDB();

    // Check duplicates
    const duplicate = await Category.findOne({
      $or: [{ name: cleanName }, { value: cleanValue }],
    });
    if (duplicate) {
      return NextResponse.json(
        { error: 'Category with this Name or Value already exists' },
        { status: 400 }
      );
    }

    const newCategory = await Category.create({
      name: cleanName,
      value: cleanValue,
    });

    // Log Activity
    await ActivityLog.create({
      userId: authCheck.session?.user.id,
      action: 'create_category',
      details: `Created category: ${cleanName} (${cleanValue})`,
      ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
    });

    return NextResponse.json({ category: newCategory });
  } catch (error) {
    console.error('Error in POST /api/admin/categories:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const authCheck = await checkPermission();
    if (authCheck.error) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
    }

    const body = await req.json();
    const { id, name, value } = body;

    if (!id || !name || !value) {
      return NextResponse.json({ error: 'ID, Name, and Value are required' }, { status: 400 });
    }

    const cleanName = name.trim();
    const cleanValue = value.toLowerCase().trim().replace(/\s+/g, '-');

    await connectDB();

    const category = await Category.findById(id);
    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    // Check duplicates excluding itself
    const duplicate = await Category.findOne({
      _id: { $ne: id },
      $or: [{ name: cleanName }, { value: cleanValue }],
    });
    if (duplicate) {
      return NextResponse.json(
        { error: 'Another category with this Name or Value already exists' },
        { status: 400 }
      );
    }

    const oldName = category.name;
    category.name = cleanName;
    category.value = cleanValue;
    await category.save();

    // Log Activity
    await ActivityLog.create({
      userId: authCheck.session?.user.id,
      action: 'update_category',
      details: `Updated category from "${oldName}" to "${cleanName}" (${cleanValue})`,
      ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
    });

    return NextResponse.json({ category });
  } catch (error) {
    console.error('Error in PUT /api/admin/categories:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const authCheck = await checkPermission();
    if (authCheck.error) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID parameter is required' }, { status: 400 });
    }

    await connectDB();

    const category = await Category.findById(id);
    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    await Category.findByIdAndDelete(id);

    // Log Activity
    await ActivityLog.create({
      userId: authCheck.session?.user.id,
      action: 'delete_category',
      details: `Deleted category: ${category.name} (${category.value})`,
      ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
    });

    return NextResponse.json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Error in DELETE /api/admin/categories:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
