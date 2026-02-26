import { z } from 'zod';

const routeVarValueSchema = z.union([z.boolean(), z.number(), z.string()]);
const stateSetMapSchema = z.record(routeVarValueSchema);
const stateAddMapSchema = z.record(z.number());

const conditionSchema: z.ZodType = z.lazy(() =>
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

const actionSchema = z.union([
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
      correct: input.correct,
      errors: input.errors && input.errors.length > 0 ? input.errors : ['정답이 아닙니다.'],
      saveAs: input.saveAs,
      routes: input.routes ?? [],
    })),
  }),
  z.object({ set: stateSetMapSchema }),
  z.object({ add: stateAddMapSchema }),
  z.object({
    choice: z.object({
      key: z.string().min(1).optional(),
      prompt: z.string().min(1),
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

const authorContactSchema = z.union([
  z.string(),
  z.object({
    label: z.string().optional(),
    value: z.string(),
    href: z.string().optional(),
  }),
]);

const authorObjectSchema = z.object({
  name: z.string().optional(),
  contacts: z.array(authorContactSchema).optional(),
});

export const gameSchema = z.object({
  meta: z.object({
    title: z.string(),
    author: z.union([z.string(), authorObjectSchema]).optional(),
    version: z.string().optional(),
  }),
  settings: z.object({
    textSpeed: z.number().positive(),
    autoSave: z.boolean(),
    clickToInstant: z.boolean(),
  }),
  assets: z.object({
    backgrounds: z.record(z.string()),
    characters: z.record(
      z.object({
        base: z.string(),
        emotions: z.record(z.string()).optional(),
      }),
    ),
    music: z.record(z.string()),
    sfx: z.record(z.string()),
  }),
  state: z
    .object({
      defaults: z.record(routeVarValueSchema),
    })
    .optional(),
  endings: z
    .record(
      z.object({
        title: z.string().min(1),
        message: z.string().optional(),
      }),
    )
    .optional(),
  endingRules: z
    .array(
      z.object({
        when: conditionSchema,
        ending: z.string().min(1),
      }),
    )
    .optional(),
  defaultEnding: z.string().min(1).optional(),
  script: z.array(z.object({ scene: z.string() })).min(1),
  scenes: z.record(
    z.object({
      actions: z.array(actionSchema),
    }),
  ),
});
