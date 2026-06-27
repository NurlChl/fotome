import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI!;

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable inside .env.local');
}

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var mongooseCache: MongooseCache | undefined;
}

const cached: MongooseCache = global.mongooseCache ?? { conn: null, promise: null };

if (!global.mongooseCache) {
  global.mongooseCache = cached;
}

interface DohAnswer {
  name: string;
  type: number;
  TTL: number;
  data: string;
}

/**
 * Dynamically resolves a mongodb+srv:// URI using DNS over HTTPS (DoH) to bypass local DNS resolution limitations.
 */
async function resolveMongodbSrv(uri: string): Promise<string> {
  if (process.env.VERCEL === 'true' || process.env.NODE_ENV === 'production') {
    return uri;
  }

  if (!uri.startsWith('mongodb+srv://')) {
    return uri;
  }

  try {
    const parsed = new URL(uri);
    const hostname = parsed.hostname;

    console.log(`[MongoDB DNS] Resolving SRV/TXT records for ${hostname} via DNS-over-HTTPS...`);

    // Helper to query DNS over HTTPS
    const queryDoh = async (provider: 'cloudflare' | 'google', type: 'SRV' | 'TXT', name: string) => {
      const url = provider === 'cloudflare'
        ? `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}&random=${Math.random()}`
        : `https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${type}&random=${Math.random()}`;

      const res = await fetch(url, {
        headers: { Accept: 'application/dns-json' },
        cache: 'no-store',
      });

      if (!res.ok) {
        throw new Error(`HTTP error ${res.status} from ${provider}`);
      }

      return res.json();
    };

    // Try Cloudflare first, fallback to Google
    let srvAnswer: DohAnswer[] = [];
    let txtAnswer: DohAnswer[] = [];

    try {
      const [srvRes, txtRes] = await Promise.all([
        queryDoh('cloudflare', 'SRV', `_mongodb._tcp.${hostname}`),
        queryDoh('cloudflare', 'TXT', hostname),
      ]);
      srvAnswer = (srvRes.Answer as DohAnswer[]) || [];
      txtAnswer = (txtRes.Answer as DohAnswer[]) || [];
    } catch (cfError) {
      console.warn('[MongoDB DNS] Cloudflare DoH failed, falling back to Google DoH:', cfError);
      try {
        const [srvRes, txtRes] = await Promise.all([
          queryDoh('google', 'SRV', `_mongodb._tcp.${hostname}`),
          queryDoh('google', 'TXT', hostname),
        ]);
        srvAnswer = (srvRes.Answer as DohAnswer[]) || [];
        txtAnswer = (txtRes.Answer as DohAnswer[]) || [];
      } catch (googleError) {
        console.error('[MongoDB DNS] Google DoH also failed:', googleError);
      }
    }

    if (srvAnswer.length === 0) {
      console.warn('[MongoDB DNS] No SRV records resolved, using original connection string');
      return uri;
    }

    // Parse SRV targets
    const hosts = srvAnswer
      .map((ans) => {
        const parts = ans.data.trim().split(/\s+/);
        const port = parts[2] || '27017';
        const target = parts[3].replace(/\.$/, ''); // Strip trailing dot
        return `${target}:${port}`;
      })
      .join(',');

    // Parse TXT records for options (e.g. replicaSet name)
    const txtOptions: Record<string, string> = {};
    txtAnswer.forEach((ans) => {
      const rawData = ans.data.replace(/^"|"$/g, ''); // Strip quotes
      const params = new URLSearchParams(rawData);
      for (const [key, val] of params.entries()) {
        txtOptions[key] = val;
      }
    });

    // Merge search parameters
    const mergedParams = new URLSearchParams(parsed.search);
    for (const [key, val] of Object.entries(txtOptions)) {
      if (!mergedParams.has(key)) {
        mergedParams.set(key, val);
      }
    }
    // Atlas replica sets always require TLS/SSL
    mergedParams.set('ssl', 'true');

    const auth = parsed.username ? `${parsed.username}:${parsed.password}@` : '';
    const pathname = parsed.pathname || '/';
    const resolvedUri = `mongodb://${auth}${hosts}${pathname}?${mergedParams.toString()}`;

    console.log('[MongoDB DNS] Successfully resolved connection string to standard mongodb:// format');
    return resolvedUri;
  } catch (err) {
    console.error('[MongoDB DNS] Error during DNS-over-HTTPS resolution:', err);
    return uri;
  }
}

let resolvedUriPromise: Promise<string> | null = null;

function getResolvedUri(): Promise<string> {
  if (!resolvedUriPromise) {
    resolvedUriPromise = resolveMongodbSrv(MONGODB_URI);
  }
  return resolvedUriPromise;
}

async function connectDB(): Promise<typeof mongoose> {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    };

    cached.promise = getResolvedUri().then((resolvedUri) => {
      return mongoose.connect(resolvedUri, opts).then((mongooseInstance) => {
        console.log('✅ MongoDB connected successfully');
        return mongooseInstance;
      });
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

export default connectDB;
