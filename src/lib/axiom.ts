import connectDB from '@/lib/db/mongodb';
import { ActivityLog } from '@/lib/db/models';

let cachedPublicIp: string | null = null;

async function getPublicIp(): Promise<string | null> {
  if (cachedPublicIp) return cachedPublicIp;
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 1000); // 1-second timeout
    const res = await fetch('https://api.ipify.org?format=json', { signal: controller.signal });
    clearTimeout(id);
    const data = await res.json();
    if (data && data.ip) {
      cachedPublicIp = data.ip;
      return cachedPublicIp;
    }
  } catch (err) {
    console.warn('Failed to resolve public IP:', err);
  }
  return null;
}

function isLoopback(ip: string): boolean {
  if (!ip) return true;
  const cleaned = ip.trim().toLowerCase();
  return (
    cleaned === '::1' ||
    cleaned === '127.0.0.1' ||
    cleaned === '::ffff:127.0.0.1' ||
    cleaned === 'localhost' ||
    cleaned === 'unknown'
  );
}

export async function logActivity(
  userId: string | undefined | null,
  action: string,
  details: string,
  ipAddress: string,
  photoId?: string | null,
  eventId?: string | null
) {
  try {
    await connectDB();

    let resolvedIp = ipAddress;
    if (isLoopback(ipAddress)) {
      const publicIp = await getPublicIp();
      resolvedIp = publicIp || '36.81.174.122';
    }

    // 1. Log to MongoDB
    const logDoc = await ActivityLog.create({
      userId: userId || undefined,
      photoId: photoId || undefined,
      eventId: eventId || undefined,
      action,
      details,
      ipAddress: resolvedIp,
    });

    // 2. Log to Axiom if configured
    const axiomToken = process.env.AXIOM_TOKEN;
    const axiomDataset = process.env.AXIOM_DATASET;
    
    if (axiomToken && axiomDataset) {
      const logEvent = {
        _time: new Date().toISOString(),
        userId: userId || 'anonymous',
        photoId: photoId || undefined,
        eventId: eventId || undefined,
        action,
        details,
        ipAddress: resolvedIp,
        id: logDoc._id.toString(),
      };

      // Ingest to Axiom using Fetch API
      fetch(`https://api.axiom.co/v1/datasets/${axiomDataset}/ingest`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${axiomToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([logEvent]),
      }).catch((axiomErr) => {
        console.error('Axiom Ingestion Background Error:', axiomErr);
      });
    }
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
}
