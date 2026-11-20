import { z } from "zod";

/** Matches comments_body_check in 20261121010000_comments.sql. */
export const COMMENT_MAX = 2000;

export const commentBodySchema = z
  .string()
  .trim()
  .min(1, "Write something first.")
  .max(COMMENT_MAX, `Keep comments to ${COMMENT_MAX} characters.`);
