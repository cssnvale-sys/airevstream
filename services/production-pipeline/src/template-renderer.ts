import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createLogger } from '@airevstream/shared';

const logger = createLogger('template-renderer');

// Path to workflow templates directory
const TEMPLATES_DIR = resolve(__dirname, '../../../comfyui-workflows');

export type WorkflowTemplate =
  | 'thumbnail-generation'
  | 'scenery-generation'
  | 'avatar-generation'
  | 'storyboard-frame';

export interface TemplateParams {
  [key: string]: string | number;
}

/**
 * Load a ComfyUI workflow template and substitute {{placeholder|default}} patterns.
 *
 * Placeholder format: {{name}} or {{name|default_value}}
 * - If params[name] exists, use that value
 * - If params[name] is missing but a default exists, use the default
 * - If params[name] is missing and no default, throw an error
 */
export async function renderTemplate(
  templateName: WorkflowTemplate,
  params: TemplateParams,
): Promise<Record<string, unknown>> {
  const templatePath = resolve(TEMPLATES_DIR, `${templateName}.json`);
  const raw = await readFile(templatePath, 'utf-8');

  const rendered = raw.replace(
    /\{\{(\w+)(?:\|([^}]*))?\}\}/g,
    (_match, name: string, defaultValue?: string) => {
      if (name in params) {
        return String(params[name]);
      }
      if (defaultValue !== undefined) {
        return defaultValue;
      }
      throw new Error(`Missing required template parameter: ${name}`);
    },
  );

  try {
    return JSON.parse(rendered) as Record<string, unknown>;
  } catch (error) {
    logger.error({ templateName, error }, 'Failed to parse rendered template');
    throw new Error(`Invalid JSON after rendering template ${templateName}`);
  }
}

/**
 * Get the list of placeholders in a template.
 */
export async function getTemplatePlaceholders(
  templateName: WorkflowTemplate,
): Promise<Array<{ name: string; defaultValue?: string }>> {
  const templatePath = resolve(TEMPLATES_DIR, `${templateName}.json`);
  const raw = await readFile(templatePath, 'utf-8');

  const placeholders: Array<{ name: string; defaultValue?: string }> = [];
  const regex = /\{\{(\w+)(?:\|([^}]*))?\}\}/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(raw)) !== null) {
    const name = match[1];
    const defaultValue = match[2];
    // Avoid duplicates
    if (!placeholders.some((p) => p.name === name)) {
      placeholders.push({ name, defaultValue });
    }
  }

  return placeholders;
}
