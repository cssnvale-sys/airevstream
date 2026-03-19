import { FlowProducer, type FlowJob } from 'bullmq';
import { getConnectionOptions } from './index.js';

let _flowProducer: FlowProducer | null = null;

export function getFlowProducer(): FlowProducer {
  if (!_flowProducer) {
    _flowProducer = new FlowProducer({ connection: getConnectionOptions() });
  }
  return _flowProducer;
}

/**
 * Content Production Pipeline:
 * research:populate-knowledge → content:generate → content:quality-check → production:generate-storyboard
 *
 * Each step's output feeds the next via BullMQ job dependencies.
 */
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

export async function closeFlowProducer(): Promise<void> {
  if (_flowProducer) {
    await _flowProducer.close();
    _flowProducer = null;
  }
}
