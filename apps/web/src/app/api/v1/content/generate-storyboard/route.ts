import { NextRequest, NextResponse } from 'next/server';
import { authenticate, success, error, validationError } from '@/lib/api-server';

export async function POST(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  try {
    const body = await req.json();
    const { script, channelId, contentType } = body;

    if (!script) {
      return validationError('script is required');
    }

    // Parse H.I.C.C. sections from script to generate shots
    const sections = ['HOOK', 'INTRO', 'CONTENT', 'CTA'];
    const shots = sections.map((section, i) => ({
      id: `shot-${i + 1}`,
      shotNumber: i + 1,
      section,
      description: `${section} segment - ${contentType ?? 'video'} frame`,
      duration: section === 'HOOK' ? 5 : section === 'INTRO' ? 25 : section === 'CTA' ? 10 : 20,
      cameraAngle: i % 2 === 0 ? 'medium close-up' : 'wide establishing',
      imageUrl: null,
      status: 'pending',
    }));

    return success({ shots });
  } catch (err: any) {
    console.error('[POST /content/generate-storyboard]', err);
    return error('INTERNAL_ERROR', 'Failed to generate storyboard', 500);
  }
}
