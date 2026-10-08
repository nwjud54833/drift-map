import { z } from "zod";

export const directionSchema = z.enum(["response", "request", "event"]);
export const workspaceCreateSchema = z.object({ name: z.string().trim().min(1).max(120), direction: directionSchema.default("response") }).strict();
export const workspaceUpdateSchema = z.object({ name: z.string().trim().min(1).max(120).optional(), direction: directionSchema.optional() }).strict().refine((value) => Object.keys(value).length > 0);export const snapshotUpdateSchema = z.object({ versionLabel: z.string().trim().min(1).max(120).optional(), notes: z.string().max(2000).optional() }).strict().refine((value) => Object.keys(value).length > 0);
export const snapshotCreateSchema = z.object({ versionLabel: z.string().trim().min(1).max(120), notes: z.string().max(2000).optional().default(""), sourceFileName: z.string().max(255).nullable().optional(), payloads: z.array(z.unknown()).min(1).max(100) }).strict();