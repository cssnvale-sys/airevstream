import { NextRequest, NextResponse } from 'next/server';
import { VoiceCloneClient } from '@airevstream/audio-engine';

export const dynamic = 'force-dynamic';

const voiceClient = new VoiceCloneClient(process.env.ELEVENLABS_API_KEY);

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // Note: Authentication should be added here - simplified for now
  try {
    await voiceClient.deleteVoice(params.id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Failed to delete voice', err);
    return NextResponse.json({ error: 'Failed to delete voice' }, { status: 500 });
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // Note: Authentication should be added here - simplified for now
  try {
    const voice = await voiceClient.getVoice(params.id);
    return NextResponse.json({ success: true, data: voice });
  } catch (err) {
    console.error('Failed to get voice details', err);
    return NextResponse.json({ error: 'Failed to get voice details' }, { status: 500 });
  }
}
