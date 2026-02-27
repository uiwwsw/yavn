import { z } from 'zod';
import { UI_TEMPLATE_IDS } from './uiTemplates';

export const routeVarValueSchema = z.union([z.boolean(), z.number(), z.string()]);
export const stateSetMapSchema = z.record(routeVarValueSchema);
export const stateAddMapSchema = z.record(z.number());

export const conditionSchema: z.ZodType = z.lazy(() =>
  z.union([
    z.object({
      var: z.string().min(1),
      op: z.enum(['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in']),
      value: z.union([routeVarValueSchema, z.array(routeVarValueSchema).min(1)]),
    }),
    z.object({ all: z.array(conditionSchema).min(1) }),
    z.object({ any: z.array(conditionSchema).min(1) }),
    z.object({ not: conditionSchema }),
  ]),
);

const inputRouteSchema = z.object({
  equals: z.string().min(1),
  set: stateSetMapSchema.optional(),
  add: stateAddMapSchema.optional(),
  goto: z.string().min(1).optional(),
});

const inputActionSchema = z.object({
  prompt: z.string().min(1),
  char: z.string().min(1).optional(),
  with: z.array(z.string().min(1)).optional(),
  correct: z.string().min(1),
  errors: z.array(z.string().min(1)).min(1).optional(),
  saveAs: z.string().min(1).optional(),
  routes: z.array(inputRouteSchema).optional(),
});

const choiceOptionSchema = z.object({
  text: z.string().min(1),
  set: stateSetMapSchema.optional(),
  add: stateAddMapSchema.optional(),
  goto: z.string().min(1).optional(),
  forgiveOnce: z.boolean().optional(),
  forgiveMessage: z.string().min(1).optional(),
});

const stickerLengthSchema = z.union([z.number(), z.string().min(1)]);
const stickerEnterEffectSchema = z.enum([
  'none',
  'fadeIn',
  'wipeLeft',
  'scaleIn',
  'popIn',
  'slideUp',
  'slideDown',
  'slideLeft',
  'slideRight',
  'wipeCenterX',
  'wipeCenterY',
  'blurIn',
  'rotateIn',
]);
const stickerLeaveEffectSchema = z.enum(['none', 'fadeOut', 'wipeLeft', 'wipeRight']);
const stickerEnterSchema = z.union([
  stickerEnterEffectSchema,
  z.object({
    effect: stickerEnterEffectSchema.optional(),
    duration: z.number().int().nonnegative().max(5000).optional(),
    easing: z.string().min(1).max(64).optional(),
    delay: z.number().int().nonnegative().max(5000).optional(),
  }),
]);
const stickerLeaveSchema = z.union([
  stickerLeaveEffectSchema,
  z.object({
    effect: stickerLeaveEffectSchema.optional(),
    duration: z.number().int().nonnegative().max(5000).optional(),
    easing: z.string().min(1).max(64).optional(),
    delay: z.number().int().nonnegative().max(5000).optional(),
  }),
]);

export const actionSchema = z.union([
  z.object({ bg: z.string() }),
  z.object({
    sticker: z.object({
      id: z.string().min(1),
      image: z.string().min(1),
      x: stickerLengthSchema.optional(),
      y: stickerLengthSchema.optional(),
      width: stickerLengthSchema.optional(),
      height: stickerLengthSchema.optional(),
      anchorX: z.enum(['left', 'center', 'right']).optional(),
      anchorY: z.enum(['top', 'center', 'bottom']).optional(),
      rotate: z.number().optional(),
      opacity: z.number().min(0).max(1).optional(),
      zIndex: z.number().int().optional(),
      enter: stickerEnterSchema.optional(),
      inputLockMs: z.number().int().nonnegative().max(60000).optional(),
    }),
  }),
  z.object({
    clearSticker: z.union([
      z.string().min(1),
      z.object({
        id: z.string().min(1),
        leave: stickerLeaveSchema.optional(),
      }),
    ]),
  }),
  z.object({ music: z.string() }),
  z.object({ sound: z.string() }),
  z.object({
    video: z.object({
      src: z.string().min(1),
      holdToSkipMs: z.number().int().positive().max(5000).optional(),
    }),
  }),
  z.object({
    input: inputActionSchema.transform((input) => ({
      prompt: input.prompt,
      char: input.char,
      with: input.with,
      correct: input.correct,
      errors: input.errors && input.errors.length > 0 ? input.errors : ['정답이 아닙니다.'],
      saveAs: input.saveAs,
      routes: input.routes ?? [],
    })),
  }),
  z.object({ set: stateSetMapSchema }),
  z.object({ add: stateAddMapSchema }),
  z.object({ get: z.string().min(1) }),
  z.object({ use: z.string().min(1) }),
  z.object({
    choice: z.object({
      key: z.string().min(1).optional(),
      prompt: z.string().min(1),
      char: z.string().min(1).optional(),
      with: z.array(z.string().min(1)).optional(),
      forgiveOnceDefault: z.boolean().optional(),
      forgiveMessage: z.string().min(1).optional(),
      options: z.array(choiceOptionSchema).min(1),
    }),
  }),
  z.object({
    branch: z.object({
      cases: z
        .array(
          z.object({
            when: conditionSchema,
            goto: z.string().min(1),
          }),
        )
        .min(1),
      default: z.string().min(1).optional(),
    }),
  }),
  z.object({ ending: z.string().min(1) }),
  z.object({ wait: z.number().nonnegative() }),
  z.object({ effect: z.string() }),
  z.object({ goto: z.string() }),
  z.object({
    char: z.object({
      id: z.string(),
      position: z.enum(['left', 'center', 'right']),
      emotion: z.string().optional(),
    }),
  }),
  z.object({
    say: z.object({
      char: z.string().optional(),
      with: z.array(z.string().min(1)).optional(),
      text: z.string(),
    }),
  }),
]);

export const authorContactSchema = z.union([
  z.string(),
  z.object({
    label: z.string().optional(),
    value: z.string(),
    href: z.string().optional(),
  }),
]);

export const authorObjectSchema = z.object({
  name: z.string().optional(),
  contacts: z.array(authorContactSchema).optional(),
});

export const endingDefinitionSchema = z.object({
  title: z.string().min(1),
  message: z.string().optional(),
});

export const endingRuleSchema = z.object({
  when: conditionSchema,
  ending: z.string().min(1),
});

const startButtonPositionSchema = z.enum(['auto', 'bottom-center', 'bottom-left', 'bottom-right', 'center']);
const uiTemplateSchema = z.enum(UI_TEMPLATE_IDS);
const uiConfigSchema = z
  .object({
    template: uiTemplateSchema,
  })
  .strict();

const seoConfigSchema = z
  .object({
    description: z.string().min(1).optional(),
    keywords: z.array(z.string().min(1)).optional(),
    image: z.string().min(1).optional(),
    imageAlt: z.string().min(1).optional(),
  })
  .strict()
  .transform((value) => {
    const normalizeOptionalText = (raw?: string): string | undefined => {
      const trimmed = raw?.trim();
      return trimmed ? trimmed : undefined;
    };
    const normalizedKeywords = value.keywords
      ? Array.from(
          new Set(
            value.keywords
              .map((entry) => entry.trim())
              .filter((entry) => entry.length > 0),
          ),
        )
      : undefined;
    return {
      description: normalizeOptionalText(value.description),
      keywords: normalizedKeywords && normalizedKeywords.length > 0 ? normalizedKeywords : undefined,
      image: normalizeOptionalText(value.image),
      imageAlt: normalizeOptionalText(value.imageAlt),
    };
  });

const startScreenSchema = z
  .object({
    enabled: z.boolean().optional(),
    image: z.string().min(1).optional(),
    music: z.string().min(1).optional(),
    startButtonText: z.string().min(1).optional(),
    buttonPosition: startButtonPositionSchema.optional(),
  })
  .strict()
  .transform((value) => {
    const normalizeOptionalText = (raw?: string): string | undefined => {
      const trimmed = raw?.trim();
      return trimmed ? trimmed : undefined;
    };
    return {
      enabled: value.enabled ?? true,
      image: normalizeOptionalText(value.image),
      music: normalizeOptionalText(value.music),
      startButtonText: value.startButtonText?.trim() || '시작하기',
      buttonPosition: value.buttonPosition ?? 'auto',
    };
  });

const endingScreenSchema = z
  .object({
    image: z.string().min(1).optional(),
  })
  .strict()
  .transform((value) => {
    const trimmed = value.image?.trim();
    return {
      image: trimmed ? trimmed : undefined,
    };
  });

const characterAssetsSchema = z.record(
  z.object({
    base: z.string(),
    emotions: z.record(z.string()).optional(),
  }),
);

const inventoryItemSchema = z
  .object({
    name: z.string().min(1),
    description: z.string().min(1).optional(),
    image: z.string().min(1).optional(),
    owned: z.boolean().optional(),
  })
  .strict()
  .transform((value) => {
    const normalizeOptionalText = (raw?: string): string | undefined => {
      const trimmed = raw?.trim();
      return trimmed ? trimmed : undefined;
    };
    return {
      name: value.name.trim(),
      description: normalizeOptionalText(value.description),
      image: normalizeOptionalText(value.image),
      owned: value.owned ?? false,
    };
  });

const fullAssetsSchema = z.object({
  backgrounds: z.record(z.string()),
  characters: characterAssetsSchema,
  music: z.record(z.string()),
  sfx: z.record(z.string()),
});

export const layerAssetsSchema = z
  .object({
    backgrounds: z.record(z.string()).optional(),
    characters: characterAssetsSchema.optional(),
    music: z.record(z.string()).optional(),
    sfx: z.record(z.string()).optional(),
  })
  .strict();

export const layerStateSchema = z.record(routeVarValueSchema);
export const layerInventorySchema = z.record(inventoryItemSchema);
export const runtimeStateSchema = z.object({
  defaults: z.record(routeVarValueSchema),
});
export const runtimeInventorySchema = z.object({
  defaults: z.record(inventoryItemSchema),
});

export const configSchema = z
  .object({
    title: z.string().min(1),
    author: z.union([z.string(), authorObjectSchema]).optional(),
    version: z.string().optional(),
    seo: seoConfigSchema.optional(),
    textSpeed: z.number().positive(),
    autoSave: z.boolean(),
    clickToInstant: z.boolean(),
    endings: z.record(endingDefinitionSchema).optional(),
    endingRules: z.array(endingRuleSchema).optional(),
    defaultEnding: z.string().min(1).optional(),
    startScreen: startScreenSchema.optional(),
    endingScreen: endingScreenSchema.optional(),
    ui: uiConfigSchema.optional(),
  })
  .strict();

export const baseLayerSchema = z
  .object({
    assets: layerAssetsSchema.optional(),
    state: layerStateSchema.optional(),
    inventory: layerInventorySchema.optional(),
  })
  .strict();

export const chapterSchema = z
  .object({
    assets: layerAssetsSchema.optional(),
    state: layerStateSchema.optional(),
    inventory: layerInventorySchema.optional(),
    script: z.array(z.object({ scene: z.string() })).min(1),
    scenes: z.record(
      z.object({
        actions: z.array(actionSchema),
      }),
    ),
  })
  .strict();

export const gameSchema = z.object({
  meta: z.object({
    title: z.string(),
    author: z.union([z.string(), authorObjectSchema]).optional(),
    version: z.string().optional(),
    seo: seoConfigSchema.optional(),
  }),
  settings: z.object({
    textSpeed: z.number().positive(),
    autoSave: z.boolean(),
    clickToInstant: z.boolean(),
  }),
  assets: fullAssetsSchema,
  state: runtimeStateSchema.optional(),
  inventory: runtimeInventorySchema.optional(),
  endings: z.record(endingDefinitionSchema).optional(),
  endingRules: z.array(endingRuleSchema).optional(),
  defaultEnding: z.string().min(1).optional(),
  startScreen: startScreenSchema.optional(),
  endingScreen: endingScreenSchema.optional(),
  ui: uiConfigSchema.optional(),
  script: z.array(z.object({ scene: z.string() })).min(1),
  scenes: z.record(
    z.object({
      actions: z.array(actionSchema),
    }),
  ),
});
