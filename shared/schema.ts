/**
 * ENTERPRISE LAYER: Domain Model Schema
 * 
 * This module defines the core domain entities for the Black Paper hypothesis evaluation platform.
 * Following Domain-Driven Design principles, these schemas represent the ubiquitous language
 * of our academic discourse domain.
 * 
 * Architecture Note: These schemas serve as the contract between all layers of our clean
 * architecture, ensuring consistency from the database through to the presentation layer.
 */

import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

/**
 * USER IDENTITY AGGREGATE
 * 
 * Represents a participant in the academic discourse platform.
 * In our Nostr-based system, users are identified by their cryptographic keypairs,
 * ensuring decentralized identity management without central authority.
 */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  // Nostr public key in npub format - serves as primary user identifier
  publicKey: text("public_key").notNull().unique(),
  // Optional human-readable identifier (NIP-05)
  nip05: text("nip05"),
  // User display preferences and settings
  displayName: text("display_name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * HYPOTHESIS AGGREGATE ROOT
 * 
 * Central entity representing a testable proposition in our academic discourse.
 * Each hypothesis forms the foundation for evidence-based evaluation and scholarly debate.
 * 
 * Business Rules:
 * - Title must be concise yet descriptive (max 256 characters)
 * - Body provides detailed explanation (max 1024 characters)  
 * - Categories enable domain-specific organization
 */
export const hypotheses = pgTable("hypotheses", {
  id: serial("id").primaryKey(),
  // Nostr event ID for decentralized reference
  nostrEventId: text("nostr_event_id").notNull().unique(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  category: text("category").notNull(),
  // Creator's public key
  creatorPublicKey: text("creator_public_key").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * SOURCE EVIDENCE ENTITY
 * 
 * Represents external evidence that either supports or refutes a hypothesis.
 * Sources form the empirical foundation of our evidence-based evaluation system.
 * 
 * Business Logic:
 * - Each source must clearly indicate support or refutation stance
 * - URL validation ensures accessibility of referenced material
 * - Community voting mechanism enables quality assessment
 */
export const sources = pgTable("sources", {
  id: serial("id").primaryKey(),
  nostrEventId: text("nostr_event_id").notNull().unique(),
  hypothesisId: integer("hypothesis_id").notNull(),
  url: text("url").notNull(),
  description: text("description").notNull(),
  // 'supporting' or 'refuting' - critical business distinction
  stance: text("stance").notNull(),
  contributorPublicKey: text("contributor_public_key").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * VOTE VALUE OBJECT
 * 
 * Captures community assessment of source quality and relevance.
 * Implements democratic evaluation through cryptographically signed votes.
 */
export const votes = pgTable("votes", {
  id: serial("id").primaryKey(),
  nostrEventId: text("nostr_event_id").notNull().unique(),
  sourceId: integer("source_id").notNull(),
  voterPublicKey: text("voter_public_key").notNull(),
  // +1 for upvote, -1 for downvote
  value: integer("value").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * COMMENT DISCOURSE ENTITY
 * 
 * Enables threaded academic discussion around hypotheses and sources.
 * Supports hierarchical conversation structure for nuanced scholarly debate.
 */
export const comments = pgTable("comments", {
  id: serial("id").primaryKey(),
  nostrEventId: text("nostr_event_id").notNull().unique(),
  // Can reference hypothesis or another comment (polymorphic)
  parentType: text("parent_type").notNull(), // 'hypothesis' or 'comment'
  parentId: integer("parent_id").notNull(),
  content: text("content").notNull(),
  authorPublicKey: text("author_public_key").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * MODERATION REPORT ENTITY
 * 
 * Enables community-driven content moderation through transparent reporting.
 * Supports decentralized governance without central censorship authority.
 */
export const reports = pgTable("reports", {
  id: serial("id").primaryKey(),
  nostrEventId: text("nostr_event_id").notNull().unique(),
  reportedEventId: text("reported_event_id").notNull(),
  reporterPublicKey: text("reporter_public_key").notNull(),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// VALIDATION SCHEMAS - Interface Adapters Layer
// These schemas ensure data integrity across layer boundaries

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertHypothesisSchema = createInsertSchema(hypotheses).omit({
  id: true,
  createdAt: true,
}).extend({
  // Enhanced validation for academic content
  title: z.string().min(10).max(256),
  body: z.string().min(50).max(1024),
  category: z.enum(["physics", "biology", "economics", "psychology", "other"]),
});

export const insertSourceSchema = createInsertSchema(sources).omit({
  id: true,
  createdAt: true,
}).extend({
  url: z.string().url(),
  description: z.string().min(20).max(512),
  stance: z.enum(["supporting", "refuting"]),
});

export const insertVoteSchema = createInsertSchema(votes).omit({
  id: true,
  createdAt: true,
}).extend({
  value: z.number().int().min(-1).max(1),
});

export const insertCommentSchema = createInsertSchema(comments).omit({
  id: true,
  createdAt: true,
}).extend({
  content: z.string().min(1).max(512),
  parentType: z.enum(["hypothesis", "comment"]),
});

export const insertReportSchema = createInsertSchema(reports).omit({
  id: true,
  createdAt: true,
});

// TYPE EXPORTS - For use across application layers
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Hypothesis = typeof hypotheses.$inferSelect;
export type InsertHypothesis = z.infer<typeof insertHypothesisSchema>;

export type Source = typeof sources.$inferSelect;
export type InsertSource = z.infer<typeof insertSourceSchema>;

export type Vote = typeof votes.$inferSelect;
export type InsertVote = z.infer<typeof insertVoteSchema>;

export type Comment = typeof comments.$inferSelect;
export type InsertComment = z.infer<typeof insertCommentSchema>;

export type Report = typeof reports.$inferSelect;
export type InsertReport = z.infer<typeof insertReportSchema>;

/**
 * DERIVED BUSINESS OBJECTS
 * 
 * These composite types represent enriched domain objects that combine
 * multiple entities for presentation layer consumption.
 */
export type HypothesisWithCounts = Hypothesis & {
  supportingSourcesCount: number;
  refutingSourcesCount: number;
  commentsCount: number;
};

export type SourceWithVotes = Source & {
  voteScore: number;
  userVote?: number;
};

export type CommentWithReplies = Comment & {
  replies: CommentWithReplies[];
};
