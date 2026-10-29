import { z } from 'zod';
import { editorialSources } from '../src/data/editorial-topics';

export const additionalEditorialSourcesSchema = z
  .array(
    z
      .string()
      .max(80)
      .refine((id) => Object.hasOwn(editorialSources, id), 'Unapproved source ID'),
  )
  .max(4)
  .refine((ids) => new Set(ids).size === ids.length, 'Duplicate source IDs');

export const editorialRevisionSchema = z
  .object({
    path: z.string().regex(/^(learn|compare)\/[a-z][a-z0-9-]{2,65}$/),
    expectedRevision: z.string().regex(/^[a-f0-9]{64}$/),
    instructions: z.string().min(20).max(1500),
    additionalSourceIds: additionalEditorialSourcesSchema.optional(),
  })
  .strict();

export type EditorialRevision = z.infer<typeof editorialRevisionSchema>;
