import { z } from 'zod';

const actionSchema = z.union([
  z.object({ bg: z.string() }),
  z.object({ music: z.string() }),
  z.object({ sound: z.string() }),
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
      text: z.string(),
    }),
  }),
]);

export const gameSchema = z.object({
  meta: z.object({
    title: z.string(),
    author: z.string().optional(),
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
  script: z.array(z.object({ scene: z.string() })).min(1),
  scenes: z.record(
    z.object({
      actions: z.array(actionSchema),
    }),
  ),
});
