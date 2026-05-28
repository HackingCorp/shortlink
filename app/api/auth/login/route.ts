import { NextRequest, NextResponse } from 'next/server';
import { checkLoginRateLimit } from '@/lib/rate-limit';

/**
 * Rate-limited login endpoint.
 * The client should call this before signIn('credentials') to check
 * if the IP is rate-limited. Returns 429 if too many attempts.
 *
 * After a failed signIn, the client should POST here to record the attempt.
 */
export async function POST(req: NextRequest) {
  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';

  try {
    const result = await checkLoginRateLimit(ip);

    if (!result.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: 'Too many login attempts. Please try again later.',
          retryAfter: Math.ceil((result.resetAt.getTime() - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            'Retry-After': Math.ceil((result.resetAt.getTime() - Date.now()) / 1000).toString(),
            'X-RateLimit-Limit': '5',
            'X-RateLimit-Remaining': result.remaining.toString(),
            'X-RateLimit-Reset': result.resetAt.toISOString(),
          },
        }
      );
    }

    return NextResponse.json({
      success: true,
      remaining: result.remaining,
    });
  } catch (error) {
    console.error('[Login Rate Limit] Error:', error);
    // Allow login if rate limiting fails
    return NextResponse.json({ success: true });
  }
}
