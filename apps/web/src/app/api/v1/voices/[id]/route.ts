import { NextRequest, NextResponse } from 'next/server';
import { VoiceCloneClient } from '@airevstream/audio-engine';

export const dynamic = 'force-dynamic';

const voiceClient = new VoiceCloneClient(process.env.ELEVENLABS_API_KEY);

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  // Note: Authentication should be added here - simplified for now
  try {
    const params = await context.params;
    const { id } = await params;
    await voiceClient.deleteVoice(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Failed to delete voice', err);
    return NextResponse.json({ error: 'Failed to delete voice' }, { status: 500 });
  }
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  // Note: Authentication should be added here - simplified for now
  try {
    const params = await context.params;
    const { id } = await params;
    const voice = await voiceClient.getVoice(id);
    return NextResponse.json({ success: true, data: voice });
  } catch (err) {
    console.error('Failed to get voice details', err);
    return NextResponse.json({ error: 'Failed to get voice details' }, { status: 500 });
  }
}
