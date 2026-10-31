import { z } from "zod";
import { externalUrlSchema } from "./schemas";

/**
 * The public copy of a portfolio (T10.9, architecture.md §13). The browser
 * builds it from the saved draft (`features/publishing/snapshot.ts`) and the
 * server validates it again before writing anything to GitHub: data from the
 * browser is untrusted (rules.md §7.3.5).
 *
 * It holds only what the local preview shows a visitor. No ids, evidence,
 * review state, email address, or demo content.
 */

const text = (max: number) => z.string().trim().max(max);
const required = (max: number) => text(max).min(1);

const publicLinkSchema = z.strictObject({
  label: required(40),
  url: externalUrlSchema,
});

export const publicProjectSchema = z.strictObject({
  name: required(100),
  summary: text(500),
  technologies: z.array(required(40)).max(30),
  achievements: z.array(required(500)).max(50),
  links: z.array(publicLinkSchema).max(10),
});

export const publicPortfolioSchema = z.strictObject({
  profile: z.strictObject({
    name: required(100),
    headline: text(140),
    intro: text(2000),
    location: text(100).optional(),
    links: z.array(publicLinkSchema).max(20),
  }),
  skills: z.array(required(40)).max(100),
  projects: z.array(publicProjectSchema).max(100),
  achievements: z.array(required(500)).max(200),
});

export type PublicPortfolio = z.infer<typeof publicPortfolioSchema>;
export type PublicProject = z.infer<typeof publicProjectSchema>;

/** Confirmations the developer gave for changes Updater would otherwise refuse to make on their repository. */
export const publishConfirmationsSchema = z.strictObject({
  /** Replace the content of an existing `gh-pages` branch that Updater didn't create. */
  replaceBranch: z.boolean().optional(),
  /** Point GitHub Pages at the `gh-pages` branch when it currently serves something else. */
  switchPagesSource: z.boolean().optional(),
});

export const publishRequestSchema = z.strictObject({
  portfolio: publicPortfolioSchema,
  confirm: publishConfirmationsSchema.default({}),
});

export type PublishConfirmations = z.infer<typeof publishConfirmationsSchema>;
export type PublishRequest = z.input<typeof publishRequestSchema>;

/** Largest publish request body the server reads, in bytes. Larger portfolios get a clear refusal. */
export const MAX_PUBLISH_BODY_BYTES = 1024 * 1024;
