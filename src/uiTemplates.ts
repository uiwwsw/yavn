export const UI_TEMPLATE_IDS = ['cinematic-noir', 'neon-grid', 'paper-stage'] as const;

export type UiTemplateId = (typeof UI_TEMPLATE_IDS)[number];

export const DEFAULT_UI_TEMPLATE: UiTemplateId = 'cinematic-noir';
