import { NextRequest, NextResponse } from 'next/server';
import { authenticate, success, error, notFound } from '@/lib/api-server';

type RouteParams = { params: Promise<{ id: string }> };

// POST /api/v1/content/[id]/quality-score — Score a content item
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await authenticate(req);
    if (ctx instanceof NextResponse) return ctx;

    const { id } = await params;

    const contentItem = await ctx.db.contentItem.findUnique({
      where: { id },
      include: { channel: true },
    });

    if (!contentItem) {
      return notFound('Content item not found');
    }

    // Extract the script/body text from platformMetadata
    const metadata = contentItem.platformMetadata as Record<string, unknown> | null;
    const script =
      (metadata?.script as string) ??
      (metadata?.body as string) ??
      contentItem.prompt ??
      '';

    // Score based on multiple criteria (0-10 scale each)
    const scores = {
      // Hook strength — does it start with a question, bold claim, or pattern interrupt?
      hookStrength: scoreHook(script),
      // Length appropriateness for platform
      lengthScore: scoreLengthForPlatform(script, contentItem.contentType),
      // CTA presence and quality
      ctaScore: scoreCTA(script),
      // Readability (short sentences, active voice indicators)
      readability: scoreReadability(script),
      // Emotional engagement markers
      engagement: scoreEngagement(script),
    };

    const overallScore =
      Object.values(scores).reduce((sum, s) => sum + s, 0) /
      Object.keys(scores).length;
    const roundedScore = Math.round(overallScore * 10) / 10;

    // Update the content item with the quality score
    await ctx.db.contentItem.update({
      where: { id },
      data: { qualityScore: roundedScore },
    });

    return success({
      contentId: id,
      overallScore: roundedScore,
      breakdown: scores,
    });
  } catch (err) {
    console.error('POST /api/v1/content/[id]/quality-score error:', err);
    return error('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}

// GET /api/v1/content/[id]/quality-score — Get existing quality score
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await authenticate(req);
    if (ctx instanceof NextResponse) return ctx;

    const { id } = await params;

    const contentItem = await ctx.db.contentItem.findUnique({
      where: { id },
      select: { id: true, qualityScore: true, title: true },
    });

    if (!contentItem) {
      return notFound('Content item not found');
    }

    return success({
      contentId: contentItem.id,
      qualityScore: contentItem.qualityScore
        ? Number(contentItem.qualityScore)
        : null,
    });
  } catch (err) {
    console.error('GET /api/v1/content/[id]/quality-score error:', err);
    return error('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}

// ─── Scoring Functions ───

function scoreHook(text: string): number {
  if (!text || text.length < 10) return 0;
  const firstSentence = text.split(/[.!?\n]/)[0]?.trim() ?? '';
  let score = 3; // Base score
  // Starts with a question
  if (firstSentence.endsWith('?')) score += 2;
  // Contains power words
  const powerWords = [
    'secret', 'discover', 'shocking', 'truth', 'mistake',
    'instantly', 'never', 'always', 'imagine', 'warning',
  ];
  if (powerWords.some(w => firstSentence.toLowerCase().includes(w))) score += 2;
  // Short and punchy hook (under 15 words)
  if (firstSentence.split(/\s+/).length <= 15) score += 1;
  // Contains numbers
  if (/\d/.test(firstSentence)) score += 1;
  // Contains "you" (directly addresses viewer)
  if (firstSentence.toLowerCase().includes('you')) score += 1;
  return Math.min(10, score);
}

function scoreLengthForPlatform(text: string, contentType: string): number {
  const wordCount = text.split(/\s+/).length;
  // Optimal word counts by content type
  const ranges: Record<string, { min: number; ideal: number; max: number }> = {
    short_video: { min: 50, ideal: 150, max: 300 },
    long_video: { min: 300, ideal: 1000, max: 3000 },
    article: { min: 500, ideal: 1500, max: 5000 },
    post: { min: 20, ideal: 80, max: 200 },
    caption: { min: 10, ideal: 50, max: 150 },
  };
  const range = ranges[contentType] ?? ranges.short_video;
  if (wordCount < range.min)
    return Math.max(1, 5 * (wordCount / range.min));
  if (wordCount > range.max)
    return Math.max(1, 10 - 5 * ((wordCount - range.max) / range.max));
  // Within range — score based on proximity to ideal
  const distFromIdeal = Math.abs(wordCount - range.ideal) / range.ideal;
  return Math.max(5, 10 - distFromIdeal * 5);
}

function scoreCTA(text: string): number {
  if (!text) return 0;
  const lowerText = text.toLowerCase();
  let score = 2;
  // Check for CTA keywords
  const ctaKeywords = [
    'subscribe', 'follow', 'like', 'comment', 'share', 'click',
    'link', 'check out', 'sign up', 'download', 'try', 'buy', 'get',
  ];
  const ctaCount = ctaKeywords.filter(kw => lowerText.includes(kw)).length;
  score += Math.min(4, ctaCount * 2);
  // CTA in the last third of content (proper placement)
  const lastThird = lowerText.slice(Math.floor(lowerText.length * 0.66));
  if (ctaKeywords.some(kw => lastThird.includes(kw))) score += 2;
  // Has URL or link reference
  if (
    lowerText.includes('http') ||
    lowerText.includes('link in') ||
    lowerText.includes('bio')
  )
    score += 1;
  return Math.min(10, score);
}

function scoreReadability(text: string): number {
  if (!text || text.length < 20) return 3;
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  if (sentences.length === 0) return 3;
  const avgWordsPerSentence = text.split(/\s+/).length / sentences.length;
  let score = 5;
  // Ideal: 10-20 words per sentence
  if (avgWordsPerSentence >= 10 && avgWordsPerSentence <= 20) score += 3;
  else if (avgWordsPerSentence < 10) score += 1; // Too choppy
  else score -= Math.min(3, (avgWordsPerSentence - 20) / 5); // Too long
  // Uses short paragraphs (newlines)
  const paragraphs = text.split(/\n\n+/);
  if (paragraphs.length >= 3) score += 1;
  // Active voice indicators (starts with verb-like patterns)
  if (
    sentences.some(s =>
      /^(Get|Try|Learn|See|Watch|Check|Don't|Start|Stop|Make|Do)/i.test(
        s.trim(),
      ),
    )
  )
    score += 1;
  return Math.max(1, Math.min(10, score));
}

function scoreEngagement(text: string): number {
  if (!text) return 0;
  const lowerText = text.toLowerCase();
  let score = 3;
  // Emotional words
  const emotionalWords = [
    'amazing', 'incredible', 'love', 'hate', 'shocking', 'beautiful',
    'terrible', 'awesome', 'worst', 'best', 'mind-blowing', 'game-changer',
  ];
  score += Math.min(
    3,
    emotionalWords.filter(w => lowerText.includes(w)).length,
  );
  // Questions (increases engagement)
  const questionCount = (text.match(/\?/g) ?? []).length;
  score += Math.min(2, questionCount);
  // Emojis (engagement boosters for social)
  const emojiCount = (
    text.match(
      /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu,
    ) ?? []
  ).length;
  if (emojiCount > 0 && emojiCount <= 5) score += 1;
  // Storytelling signals
  if (
    lowerText.includes('when i') ||
    lowerText.includes('i was') ||
    lowerText.includes('one day') ||
    lowerText.includes("here's what happened")
  )
    score += 1;
  return Math.min(10, score);
}
