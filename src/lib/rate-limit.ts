import { NextRequest, NextResponse } from 'next/server';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// Cache for public IP to avoid repeated API calls
let cachedPublicIp: string | null = null;

/**
 * Fetch public IP from external service
 */
async function getPublicIp(): Promise<string | null> {
  if (cachedPublicIp) return cachedPublicIp;
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1000); // 1-second timeout
    
    const response = await fetch('https://api.ipify.org?format=json', { 
      signal: controller.signal 
    });
    
    clearTimeout(timeoutId);
    
    const data = await response.json();
    if (data && data.ip) {
      cachedPublicIp = data.ip;
      return cachedPublicIp;
    }
  } catch (err) {
    console.warn('Failed to resolve public IP:', err);
  }
  
  return null;
}

/**
 * Check if IP is a loopback/localhost address
 */
function isLoopbackIp(ip: string): boolean {
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

// In-memory store (suitable for single-instance deployment)
// For production multi-instance, use Redis
const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  keyPrefix?: string;
}

const RATE_LIMIT_CONFIGS: Record<string, RateLimitConfig> = {
  'face-search': {
    maxRequests: 10,
    windowMs: 60 * 1000, // 10 requests per minute
    keyPrefix: 'fs',
  },
  upload: {
    maxRequests: 100,
    windowMs: 60 * 60 * 1000, // 100 requests per hour
    keyPrefix: 'ul',
  },
  auth: {
    maxRequests: 10,
    windowMs: 15 * 60 * 1000, // 10 requests per 15 minutes
    keyPrefix: 'au',
  },
  general: {
    maxRequests: 100,
    windowMs: 60 * 1000, // 100 requests per minute
    keyPrefix: 'gn',
  },
};

/**
 * Get client IP from request
 */
function getClientIp(req: NextRequest): string {
  // Check standard proxy headers
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  const realIp = req.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }
  
  // Check Cloudflare header
  const cfConnectingIp = req.headers.get('cf-connecting-ip');
  if (cfConnectingIp) {
    return cfConnectingIp;
  }
  
  // Try NextRequest.ip property (available in some environments)
  const reqIp = (req as any).ip;
  if (reqIp) {
    return reqIp;
  }
  
  // Default to localhost
  return '127.0.0.1';
}

/**
 * Check rate limit for a given key and config type
 * Returns null if within limit, or a NextResponse if rate limited
 */
export function checkRateLimit(
  req: NextRequest,
  configType: keyof typeof RATE_LIMIT_CONFIGS = 'general',
  customKey?: string
): NextResponse | null {
  const config = RATE_LIMIT_CONFIGS[configType];
  if (!config) return null;

  const clientIp = getClientIp(req);
  const key = `${config.keyPrefix}:${customKey || clientIp}`;
  const now = Date.now();

  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetTime) {
    // New window
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + config.windowMs,
    });
    return null;
  }

  if (entry.count >= config.maxRequests) {
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
    return NextResponse.json(
      {
        error: 'Too many requests',
        message: `Rate limit exceeded. Please try again in ${retryAfter} seconds.`,
        retryAfter,
      },
      {
        status: 429,
        headers: {
          'Retry-After': retryAfter.toString(),
          'X-RateLimit-Limit': config.maxRequests.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': new Date(entry.resetTime).toISOString(),
        },
      }
    );
  }

  entry.count++;
  return null;
}

/**
 * Get client IP helper (exported for use in API routes)
 */
export { getClientIp };

/**
 * Get client IP with public IP resolution for loopback addresses
 * Use this when you need the actual public IP (e.g., for logging, claims)
 */
export async function getClientIpResolved(req: NextRequest): Promise<string> {
  let ip = getClientIp(req);
  
  // If we detected a loopback IP, try to get the public IP
  if (isLoopbackIp(ip)) {
    const publicIp = await getPublicIp();
    if (publicIp) {
      return publicIp;
    }
  }
  
  return ip;
}
