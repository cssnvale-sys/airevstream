import { NextRequest, NextResponse } from 'next/server';
import { VoiceCloneClient } from '@airevstream/audio-engine';

export const dynamic = 'force-dynamic';

const voiceClient = process.env.ELEVENLABS_API_KEY 
  ? new VoiceCloneClient(process.env.ELEVENLABS_API_KEY)
  : null;

// Fallback voices for when API key is not configured
const FALLBACK_VOICES = [
  { voiceId: 'alloy', name: 'Alloy', description: 'Balanced, natural voice', category: 'premade', samples: [], createdAt: new Date().toISOString() },
  { voiceId: 'echo', name: 'Echo', description: 'Warm and approachable', category: 'premade', samples: [], createdAt: new Date().toISOString() },
  { voiceId: 'fable', name: 'Fable', description: 'British, sophisticated', category: 'premade', samples: [], createdAt: new Date().toISOString() },
  { voiceId: 'onyx', name: 'Onyx', description: 'Deep and authoritative', category: 'premade', samples: [], createdAt: new Date().toISOString() },
  { voiceId: 'nova', name: 'Nova', description: 'Energetic and bright', category: 'premade', samples: [], createdAt: new Date().toISOString() },
  { voiceId: 'shimmer', name: 'Shimmer', description: 'Clear and optimistic', category: 'premade', samples: [], createdAt: new Date().toISOString() },
];

export async function GET(req: NextRequest) {
  // Note: Authentication should be added here - simplified for now
  try {
    if (!voiceClient) {
      console.warn('ELEVENLABS_API_KEY not configured, returning fallback voices');
      return NextResponse.json({ success: true, data: FALLBACK_VOICES, fallback: true });
    }
    const voices = await voiceClient.listVoices();
    return NextResponse.json({ success: true, data: voices });
  } catch (err) {
    console.error('Failed to list voices, returning fallback:', err);
    return NextResponse.json({ success: true, data: FALLBACK_VOICES, fallback: true });
  }
}

export async function POST(req: NextRequest) {
  // Note: Authentication should be added here - simplified for now
  try {
    if (!voiceClient) {
      return NextResponse.json({ error: 'Voice cloning requires ELEVENLABS_API_KEY to be configured' }, { status: 503 });
    }
    
    const formData = await req.formData();
    const name = formData.get('name') as string;
    const description = formData.get('description') as string | undefined;
    const labelsJson = formData.get('labels') as string | undefined;
    
    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const files: Buffer[] = [];
    const fileEntries = formData.getAll('files');
    
    for (const file of fileEntries) {
      if (file instanceof Blob) {
        const arrayBuffer = await file.arrayBuffer();
        files.push(Buffer.from(arrayBuffer));
      }
    }

    if (files.length === 0) {
      return NextResponse.json({ error: 'At least one audio sample is required' }, { status: 400 });
    }

    const result = await voiceClient.createVoiceClone({
      name,
      description,
      files,
      labels: labelsJson ? JSON.parse(labelsJson) : undefined,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    console.error('Failed to create voice clone', err);
    return NextResponse.json({ error: 'Failed to create voice clone' }, { status: 500 });
  }
}
