/**
 * Extracted validation schemas for testability.
 * These are the exact same schemas used inline in the routers.
 * Centralizing them here avoids restructuring router files.
 */
import { z } from "zod";

/** moderation.report input schema */
export const reportInputSchema = z.object({
  targetType: z.enum(["topic", "rating", "comment", "user"]),
  targetId: z.string().uuid(),
  reason: z.enum(["spam", "harassment", "hate_speech", "off_topic", "private_individual", "other"]),
  details: z.string().max(1000).optional(),
});

/** topics.create input schema */
export const topicCreateInputSchema = z.object({
  title: z.string().min(5).max(100),
  description: z.string().max(2000).optional(),
  categoryId: z.number().int().positive(),
  imageUrl: z.string().url().optional(),
  sourceUrl: z.string().url().optional(),
  options: z.array(z.object({
    name: z.string().min(1).max(200),
    description: z.string().max(1000).optional(),
    imageUrl: z.string().url().optional(),
  })).min(2, "At least 2 options required").max(20),
});
