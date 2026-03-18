# ComfyUI Workflow Templates

This directory contains ComfyUI API-format workflow JSON templates used by the AiRevStream production pipeline to generate images. Each template is designed for a specific use case and follows the ComfyUI `/prompt` API format.

## Workflow Files

| File | Resolution | Purpose |
|------|-----------|---------|
| `thumbnail-generation.json` | 1024x576 | YouTube/social media thumbnail images |
| `scenery-generation.json` | 1024x768 | Background scenery and environment images for video shots |
| `avatar-generation.json` | 768x768 | Channel avatar and character portrait images |
| `storyboard-frame.json` | 1280x720 | Individual storyboard shot frames for video production |

## Node Structure

All workflows share the same 7-node pipeline:

1. **CheckpointLoaderSimple** (Node 1) -- Loads the SDXL checkpoint model
2. **CLIPTextEncode - Positive** (Node 2) -- Encodes the positive prompt via CLIP
3. **CLIPTextEncode - Negative** (Node 3) -- Encodes the negative prompt via CLIP
4. **EmptyLatentImage** (Node 4) -- Creates the blank latent at the target resolution
5. **KSampler** (Node 5) -- Runs the diffusion sampling process
6. **VAEDecode** (Node 6) -- Decodes the latent into a pixel image
7. **SaveImage** (Node 7) -- Saves the output image to disk

## Placeholder System

Workflows use `{{placeholder|default_value}}` syntax for values that the production pipeline fills at runtime. The production pipeline should perform string replacement before submitting to ComfyUI.

### Available Placeholders

| Placeholder | Description | Example |
|-------------|-------------|---------|
| `{{model\|sd_xl_base_1.0.safetensors}}` | Checkpoint filename in ComfyUI models directory | `dreamshaperXL_v21.safetensors` |
| `{{positive_prompt\|...}}` | Positive text prompt describing desired image | `A stunning mountain landscape at sunset` |
| `{{negative_prompt\|...}}` | Negative text prompt describing what to avoid | `blurry, low quality, watermark` |
| `{{seed\|0}}` | Random seed for reproducibility (0 = random) | `42` |
| `{{filename_prefix\|...}}` | Prefix for saved output filenames | `thumb_abc123` |

### Replacement Example

Before submitting to ComfyUI, replace placeholders:

```typescript
import fs from 'fs';

function loadWorkflow(
  templatePath: string,
  params: Record<string, string>
): object {
  let template = fs.readFileSync(templatePath, 'utf-8');

  // Replace each {{key|default}} with the provided value or the default
  template = template.replace(
    /\{\{(\w+)\|([^}]*)\}\}/g,
    (_, key, defaultValue) => params[key] ?? defaultValue
  );

  return JSON.parse(template);
}

// Usage
const workflow = loadWorkflow('comfyui-workflows/thumbnail-generation.json', {
  positive_prompt: 'An epic space battle scene, explosions, dramatic',
  negative_prompt: 'blurry, text, watermark',
  seed: '12345',
  model: 'dreamshaperXL_v21.safetensors',
  filename_prefix: 'thumb_content_abc',
});
```

## Submitting to ComfyUI

After placeholder replacement, submit the workflow JSON to the ComfyUI API:

```typescript
const COMFYUI_BASE_URL = process.env.COMFYUI_BASE_URL ?? 'http://localhost:8188';

async function queuePrompt(workflow: object): Promise<{ prompt_id: string }> {
  const response = await fetch(`${COMFYUI_BASE_URL}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: workflow }),
  });

  if (!response.ok) {
    throw new Error(`ComfyUI error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}
```

## Default Sampling Parameters

All workflows use these defaults (tunable per-workflow if needed):

- **Steps**: 25
- **CFG Scale**: 7.0
- **Sampler**: `euler_ancestral`
- **Scheduler**: `normal`
- **Denoise**: 1.0

## Existing Subdirectories

The following subdirectories are reserved for additional specialized workflows:

- `character/` -- Character-specific generation workflows (e.g., consistent identity)
- `environment/` -- Extended environment workflows (e.g., interior, weather variants)
- `style/` -- Style transfer and artistic filter workflows
- `upscale/` -- Upscaling and enhancement workflows

## Prerequisites

- ComfyUI running and accessible at `COMFYUI_BASE_URL` (default: `http://localhost:8188`)
- An SDXL-compatible checkpoint placed in ComfyUI's `models/checkpoints/` directory
- The checkpoint filename in your `.env` or passed as the `model` parameter must match exactly
