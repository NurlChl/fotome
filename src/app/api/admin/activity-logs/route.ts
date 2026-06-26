import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import { ActivityLog, User, Photo } from '@/lib/db/models';
import { auth } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = session.user.role;
    const canManageLogs = role === 'superadmin' || !!session.user.permissions?.manageLogs;
    if (!canManageLogs) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await connectDB();

    const axiomToken = process.env.AXIOM_TOKEN;
    const axiomDataset = process.env.AXIOM_DATASET;

    let logs: any[] = [];
    let source = 'mongodb';

    if (axiomToken && axiomDataset) {
      try {
        const response = await fetch('https://api.axiom.co/v1/datasets/_apl?format=tabular', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${axiomToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            apl: `['${axiomDataset}'] | order by _time desc | limit 200`,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          // Axiom tabular format returns rows inside `matches` or `tables[0].rows`
          // Let's normalize it
          let rawRows: any[] = [];
          if (data.matches) {
            rawRows = data.matches;
          } else if (data.tables && data.tables[0] && data.tables[0].rows) {
            // Tabular rows mapping
            const columns = data.tables[0].columns.map((c: any) => c.name);
            rawRows = data.tables[0].rows.map((row: any) => {
              const obj: any = {};
              columns.forEach((col: string, idx: number) => {
                obj[col] = row[idx];
              });
              return obj;
            });
          } else if (data.events) {
            rawRows = data.events;
          }

          if (rawRows.length > 0) {
            logs = rawRows.map((r: any) => ({
              _id: r.id || r._id || Math.random().toString(),
              userId: r.userId === 'anonymous' ? null : r.userId,
              photoId: r.photoId || null,
              eventId: r.eventId || null,
              action: r.action,
              details: r.details,
              ipAddress: r.ipAddress,
              createdAt: r._time || r.createdAt,
            }));
            source = 'axiom';
          }
        } else {
          console.warn('Axiom query failed, status code:', response.status);
        }
      } catch (axiomErr) {
        console.error('Failed to query Axiom, falling back to MongoDB:', axiomErr);
      }
    }

    // Fallback to MongoDB if Axiom had no data or request failed
    if (logs.length === 0) {
      const dbLogs = await ActivityLog.find({})
        .populate({
          path: 'photoId',
          select: 'thumbnailUrl watermarkedUrl'
        })
        .sort({ createdAt: -1 })
        .limit(200)
        .lean();
      
      logs = dbLogs.map((l: any) => ({
        _id: l._id.toString(),
        userId: l.userId ? l.userId.toString() : null,
        photoId: l.photoId ? {
          _id: l.photoId._id.toString(),
          thumbnailUrl: l.photoId.thumbnailUrl,
          watermarkedUrl: l.photoId.watermarkedUrl
        } : null,
        eventId: l.eventId ? l.eventId.toString() : null,
        action: l.action,
        details: l.details,
        ipAddress: l.ipAddress,
        createdAt: l.createdAt,
      }));
      source = 'mongodb';
    }

    // Populate user emails/names and photo details
    const userIds = Array.from(new Set(logs.map(l => l.userId).filter(Boolean)));
    const photoIds = Array.from(new Set(logs.map(l => typeof l.photoId === 'string' ? l.photoId : l.photoId?._id).filter(Boolean)));

    const [users, photos] = await Promise.all([
      User.find({ _id: { $in: userIds } }).select('name email').lean(),
      Photo.find({ _id: { $in: photoIds } }).select('thumbnailUrl watermarkedUrl').lean()
    ]);

    const userMap = new Map(users.map((u: any) => [u._id.toString(), u]));
    const photoMap = new Map(photos.map((p: any) => [p._id.toString(), p]));

    const populatedLogs = logs.map(log => {
      const u = log.userId ? userMap.get(log.userId) : null;
      
      let pObj = null;
      if (log.photoId) {
        if (typeof log.photoId === 'object' && log.photoId.thumbnailUrl) {
          pObj = log.photoId;
        } else {
          const photoIdStr = log.photoId.toString();
          const dbPhoto: any = photoMap.get(photoIdStr);
          if (dbPhoto) {
            pObj = {
              _id: dbPhoto._id.toString(),
              thumbnailUrl: dbPhoto.thumbnailUrl,
              watermarkedUrl: dbPhoto.watermarkedUrl,
            };
          }
        }
      }

      return {
        ...log,
        userId: u ? { _id: u._id.toString(), name: u.name, email: u.email } : null,
        photoId: pObj,
      };
    });

    return NextResponse.json({
      success: true,
      source,
      logs: populatedLogs,
    });
  } catch (error) {
    console.error('Error fetching activity logs:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
