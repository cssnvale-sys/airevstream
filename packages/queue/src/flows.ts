import { FlowProducer, type FlowJob } from 'bullmq';
import { getConnectionOptions } from './index.js';

let _flowProducer: FlowProducer | null = null;

export function getFlowProducer(): FlowProducer {
  if (!_flowProducer) {
    _flowProducer = new FlowProducer({ connection: getConnectionOptions() });
  }
  return _flowProducer;
}

// ─── Basic Content Pipeline (existing, preserved) ───

export interface ContentPipelineParams {
  contentId: string;
  channelId: string;
  topic: string;
  contentType: string;
  domain?: string;
}

export async function startContentPipeline(params: ContentPipelineParams) {
  const flow = getFlowProducer();

  const tree: FlowJob = {
    name: 'production:generate-storyboard',
    queueName: 'production',
    data: {
      contentId: params.contentId,
      channelId: params.channelId,
      scriptJson: {},
    },
    children: [
      {
        name: 'content:generate',
        queueName: 'content',
        data: {
          contentId: params.contentId,
          channelId: params.channelId,
          contentType: params.contentType,
          prompt: `Create engaging ${params.contentType} content about: ${params.topic}`,
        },
        children: [
          {
            name: 'research:populate-knowledge',
            queueName: 'research',
            data: {
              domain: params.domain ?? 'content_creation',
              topic: params.topic,
              urls: [],
            },
          },
        ],
      },
    ],
  };

  const result = await flow.add(tree);
  return result;
}

// ─── Cinema Production Pipeline (new) ───

export interface CinemaPipelineParams {
  contentId: string;
  channelId: string;
  topic: string;
  contentType: 'short' | 'long' | 'thumbnail' | 'image';
  cinemaBibleId?: string;
  qualityPreset?: 'draft' | 'standard' | 'cinema';
  shotIds?: string[];       // If storyboard already exists
  storyboardId?: string;    // If storyboard already exists
}

/**
 * Cinema Production Pipeline DAG
 *
 * BullMQ FlowProducer executes children BEFORE parents.
 * The tree reads top-down as the final step, with leaves running first.
 *
 * Execution order:
 * 1. research:populate-knowledge (leaf — runs first)
 * 2. content:generate (depends on research)
 * 3. production:generate-storyboard (depends on script)
 * 4. production:generate-shots (depends on storyboard)
 * 5. production:qc-gate (depends on shots)
 * 6. production:mix-audio (depends on QC pass)
 * 7. production:render-video (depends on audio + approved shots)
 * 8. content:final-review (depends on rendered video) — ROOT
 */
export async function startCinemaPipeline(params: CinemaPipelineParams) {
  const flow = getFlowProducer();
  const qualityPreset = params.qualityPreset ?? 'standard';

  const tree: FlowJob = {
    // Step 8: Final review (ROOT — runs last)
    name: 'content:final-review',
    queueName: 'content',
    data: {
      contentId: params.contentId,
      storyboardId: params.storyboardId ?? '',
      autoApprove: qualityPreset === 'draft',
    },
    children: [
      {
        // Step 7: Render video
        name: 'production:render-video',
        queueName: 'production',
        data: {
          contentId: params.contentId,
          storyboardId: params.storyboardId ?? '',
          channelId: params.channelId,
          qualityPreset,
        },
        children: [
          {
            // Step 6: Mix audio
            name: 'production:mix-audio',
            queueName: 'production',
            data: {
              storyboardId: params.storyboardId ?? '',
              contentId: params.contentId,
            },
            children: [
              {
                // Step 5: QC gate
                name: 'production:qc-gate',
                queueName: 'production',
                data: {
                  storyboardId: params.storyboardId ?? '',
                  contentId: params.contentId,
                },
                children: [
                  {
                    // Step 4: Generate shots
                    name: 'production:generate-shots',
                    queueName: 'production',
                    data: {
                      storyboardId: params.storyboardId ?? '',
                      shotIds: params.shotIds ?? [],
                      cinemaBibleId: params.cinemaBibleId ?? '',
                      qualityPreset,
                      contentId: params.contentId,
                      channelId: params.channelId,
                    },
                    children: [
                      {
                        // Step 3: Generate storyboard
                        name: 'production:generate-storyboard',
                        queueName: 'production',
                        data: {
                          contentId: params.contentId,
                          channelId: params.channelId,
                          scriptJson: {},
                        },
                        children: [
                          {
                            // Step 2: Generate content/script
                            name: 'content:generate',
                            queueName: 'content',
                            data: {
                              contentId: params.contentId,
                              channelId: params.channelId,
                              contentType: params.contentType,
                              prompt: `Create cinematic ${params.contentType} content about: ${params.topic}`,
                            },
                            children: [
                              {
                                // Step 1: Research (LEAF — runs first)
                                name: 'research:populate-knowledge',
                                queueName: 'research',
                                data: {
                                  domain: 'content_creation',
                                  topic: params.topic,
                                  urls: [],
                                },
                              },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };

  const result = await flow.add(tree);
  return result;
}

export async function closeFlowProducer(): Promise<void> {
  if (_flowProducer) {
    await _flowProducer.close();
    _flowProducer = null;
  }
}
