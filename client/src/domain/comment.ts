/**
 * COMMENT DOMAIN MODEL
 * 
 * This module defines the domain logic for threaded academic discussions
 * around hypotheses and sources. Comments enable nuanced scholarly debate
 * and peer review within our evidence-based evaluation system.
 * 
 * Enterprise Layer: Encapsulates business rules for academic discourse,
 * comment quality, and threaded conversation management.
 */

/**
 * COMMENT CONTENT VALUE OBJECT
 * 
 * Represents validated comment text with quality assurance.
 * Enforces academic discourse standards and content guidelines.
 */
export class CommentContent {
  private constructor(private readonly value: string) {}

  /**
   * FACTORY METHOD: Create Content
   * 
   * Business Rule: Comments must contribute meaningfully to academic discourse
   * while maintaining respectful and constructive tone.
   */
  static create(content: string): CommentContent {
    const trimmed = content.trim();
    
    if (trimmed.length === 0) {
      throw new Error('Comment content cannot be empty');
    }
    
    if (trimmed.length > 512) {
      throw new Error('Comment must not exceed 512 characters for readability');
    }
    
    // Quality check: ensure minimum meaningful content
    const wordCount = trimmed.split(/\s+/).length;
    if (wordCount < 3) {
      throw new Error('Comment must contain at least 3 words to be meaningful');
    }
    
    // Basic content quality filter
    const prohibitedPatterns = [
      /^\w+\s*$/, // Single word comments
      /^(good|bad|yes|no|ok|okay|true|false)\s*$/i, // Non-substantive responses
    ];
    
    if (prohibitedPatterns.some(pattern => pattern.test(trimmed))) {
      throw new Error('Comment must provide substantive contribution to discussion');
    }
    
    return new CommentContent(trimmed);
  }

  toString(): string {
    return this.value;
  }

  /**
   * BUSINESS METHOD: Get Word Count
   * 
   * Returns word count for quality and engagement metrics.
   */
  getWordCount(): number {
    return this.value.split(/\s+/).length;
  }

  /**
   * BUSINESS METHOD: Get Reading Time
   * 
   * Estimates reading time in seconds (assuming 200 words per minute).
   */
  getEstimatedReadingTime(): number {
    const wordsPerMinute = 200;
    const minutes = this.getWordCount() / wordsPerMinute;
    return Math.max(Math.ceil(minutes * 60), 5); // Minimum 5 seconds
  }

  equals(other: CommentContent): boolean {
    return this.value === other.value;
  }
}

/**
 * PARENT REFERENCE VALUE OBJECT
 * 
 * Represents the target entity that a comment responds to.
 * Enables hierarchical comment threading and proper context linking.
 */
export class CommentParent {
  constructor(
    public readonly type: 'hypothesis' | 'comment',
    public readonly id: string,
    public readonly authorPublicKey: string
  ) {
    if (!id || id.trim().length === 0) {
      throw new Error('Parent ID cannot be empty');
    }
    
    if (!authorPublicKey || authorPublicKey.length < 10) {
      throw new Error('Valid parent author public key required');
    }
  }

  /**
   * BUSINESS QUERY: Is Root Level
   * 
   * Determines if this comment responds directly to a hypothesis (root level).
   */
  isRootLevel(): boolean {
    return this.type === 'hypothesis';
  }

  /**
   * BUSINESS QUERY: Is Reply
   * 
   * Determines if this comment replies to another comment.
   */
  isReply(): boolean {
    return this.type === 'comment';
  }

  equals(other: CommentParent): boolean {
    return this.type === other.type && 
           this.id === other.id && 
           this.authorPublicKey === other.authorPublicKey;
  }
}

/**
 * COMMENT AGGREGATE ROOT
 * 
 * Central entity for academic discourse and threaded discussions.
 * Manages comment lifecycle, threading, and quality assessment.
 */
export class Comment {
  private replies: Comment[] = [];
  private isDeleted: boolean = false;

  private constructor(
    public readonly id: string,
    public readonly nostrEventId: string,
    public readonly content: CommentContent,
    public readonly parent: CommentParent,
    public readonly authorPublicKey: string,
    public readonly createdAt: Date,
    public readonly depth: number = 0
  ) {}

  /**
   * FACTORY METHOD: Create New Comment
   * 
   * Creates a new comment with validation of all business rules.
   */
  static create(
    id: string,
    nostrEventId: string,
    content: string,
    parentType: 'hypothesis' | 'comment',
    parentId: string,
    parentAuthorPublicKey: string,
    authorPublicKey: string,
    createdAt: Date = new Date(),
    depth: number = 0
  ): Comment {
    const validatedContent = CommentContent.create(content);
    const parent = new CommentParent(parentType, parentId, parentAuthorPublicKey);
    
    if (!authorPublicKey || authorPublicKey.length < 10) {
      throw new Error('Valid author public key required');
    }
    
    if (depth < 0) {
      throw new Error('Comment depth cannot be negative');
    }
    
    // Business rule: Limit thread depth to prevent excessive nesting
    if (depth > 10) {
      throw new Error('Comment thread depth cannot exceed 10 levels');
    }
    
    return new Comment(
      id,
      nostrEventId,
      validatedContent,
      parent,
      authorPublicKey,
      createdAt,
      depth
    );
  }

  /**
   * FACTORY METHOD: From Database Record
   * 
   * Reconstructs domain object from persistence layer data.
   */
  static fromRecord(record: any): Comment {
    const comment = new Comment(
      record.id,
      record.nostrEventId,
      CommentContent.create(record.content),
      new CommentParent(record.parentType, record.parentId, record.parentAuthorPublicKey),
      record.authorPublicKey,
      new Date(record.createdAt),
      record.depth || 0
    );

    // Mark as deleted if flagged in record
    if (record.isDeleted) {
      comment.markAsDeleted();
    }

    return comment;
  }

  /**
   * BUSINESS METHOD: Add Reply
   * 
   * Adds a child comment as a reply to this comment.
   * Manages threading hierarchy and depth validation.
   */
  addReply(reply: Comment): void {
    if (this.isDeleted) {
      throw new Error('Cannot reply to deleted comment');
    }
    
    if (!reply.parent.equals(new CommentParent('comment', this.id, this.authorPublicKey))) {
      throw new Error('Reply parent reference must match this comment');
    }
    
    if (reply.depth !== this.depth + 1) {
      throw new Error('Reply depth must be exactly one level deeper than parent');
    }
    
    this.replies.push(reply);
  }

  /**
   * BUSINESS METHOD: Mark as Deleted
   * 
   * Soft deletes the comment while preserving thread structure.
   * Business Rule: Deleted comments maintain threading but hide content.
   */
  markAsDeleted(): void {
    this.isDeleted = true;
  }

  /**
   * BUSINESS METHOD: Get Thread Size
   * 
   * Calculates total number of comments in this thread branch.
   */
  getThreadSize(): number {
    let size = 1; // Count this comment
    
    for (const reply of this.replies) {
      size += reply.getThreadSize();
    }
    
    return size;
  }

  /**
   * BUSINESS QUERY: Is Root Comment
   * 
   * Determines if this is a top-level comment on a hypothesis.
   */
  isRootComment(): boolean {
    return this.parent.isRootLevel() && this.depth === 0;
  }

  /**
   * BUSINESS QUERY: Can Accept Replies
   * 
   * Determines if new replies can be added to this comment.
   */
  canAcceptReplies(): boolean {
    return !this.isDeleted && this.depth < 10;
  }

  /**
   * BUSINESS QUERY: Get Engagement Score
   * 
   * Calculates engagement based on thread depth and reply count.
   */
  getEngagementScore(): number {
    const replyCount = this.replies.length;
    const threadSize = this.getThreadSize();
    const contentLength = this.content.getWordCount();
    
    // Weight: replies are more valuable than thread size, content contributes too
    return replyCount * 3 + threadSize * 1 + Math.min(contentLength / 10, 5);
  }

  /**
   * BUSINESS QUERY: Get Age in Hours
   * 
   * Calculates age of comment for recency sorting.
   */
  getAgeInHours(): number {
    const now = new Date();
    const diffMs = now.getTime() - this.createdAt.getTime();
    return diffMs / (1000 * 60 * 60); // Convert to hours
  }

  /**
   * BUSINESS QUERY: Is Recent
   * 
   * Determines if comment is considered recent (within 24 hours).
   */
  isRecent(): boolean {
    return this.getAgeInHours() < 24;
  }

  // Getters for accessing private state
  get getReplies(): readonly Comment[] {
    return [...this.replies];
  }

  get getIsDeleted(): boolean {
    return this.isDeleted;
  }

  get getDisplayContent(): string {
    return this.isDeleted ? '[Comment deleted]' : this.content.toString();
  }

  /**
   * BUSINESS METHOD: Flatten Thread
   * 
   * Returns flattened list of all comments in thread for linear display.
   */
  flattenThread(): Comment[] {
    const flattened: Comment[] = [this];
    
    for (const reply of this.replies) {
      flattened.push(...reply.flattenThread());
    }
    
    return flattened;
  }

  /**
   * VALUE OBJECT CONVERSION
   * 
   * Converts domain object to plain object for serialization.
   */
  toPlainObject(): any {
    return {
      id: this.id,
      nostrEventId: this.nostrEventId,
      content: this.getDisplayContent,
      originalContent: this.isDeleted ? null : this.content.toString(),
      wordCount: this.isDeleted ? 0 : this.content.getWordCount(),
      readingTime: this.isDeleted ? 0 : this.content.getEstimatedReadingTime(),
      parent: {
        type: this.parent.type,
        id: this.parent.id,
        authorPublicKey: this.parent.authorPublicKey,
      },
      authorPublicKey: this.authorPublicKey,
      createdAt: this.createdAt,
      depth: this.depth,
      isDeleted: this.isDeleted,
      isRootComment: this.isRootComment(),
      canAcceptReplies: this.canAcceptReplies(),
      replyCount: this.replies.length,
      threadSize: this.getThreadSize(),
      engagementScore: this.getEngagementScore(),
      ageInHours: this.getAgeInHours(),
      isRecent: this.isRecent(),
      replies: this.replies.map(reply => reply.toPlainObject()),
    };
  }
}

/**
 * COMMENT FILTER CRITERIA VALUE OBJECT
 * 
 * Encapsulates filtering and sorting logic for comment threads.
 */
export class CommentFilterCriteria {
  constructor(
    public readonly parentType: 'hypothesis' | 'comment',
    public readonly parentId: string,
    public readonly sortBy: 'recent' | 'engagement' | 'chronological' = 'chronological',
    public readonly includeDeleted: boolean = false,
    public readonly maxDepth?: number,
    public readonly limit: number = 100
  ) {
    if (!parentId) {
      throw new Error('Parent ID is required for comment filtering');
    }
    
    if (limit < 1 || limit > 500) {
      throw new Error('Limit must be between 1 and 500');
    }
    
    if (maxDepth !== undefined && maxDepth < 0) {
      throw new Error('Max depth cannot be negative');
    }
  }

  /**
   * BUSINESS METHOD: Should Include Comment
   * 
   * Determines if a comment should be included based on filter criteria.
   */
  shouldIncludeComment(comment: Comment): boolean {
    if (!this.includeDeleted && comment.getIsDeleted) {
      return false;
    }
    
    if (this.maxDepth !== undefined && comment.depth > this.maxDepth) {
      return false;
    }
    
    return true;
  }
}

/**
 * COMMENT TREE BUILDER
 * 
 * Utility class for constructing hierarchical comment structures from flat lists.
 */
export class CommentTreeBuilder {
  /**
   * BUSINESS METHOD: Build Tree
   * 
   * Constructs hierarchical comment tree from flat array of comments.
   */
  static buildTree(comments: Comment[]): Comment[] {
    const commentMap = new Map<string, Comment>();
    const rootComments: Comment[] = [];
    
    // First pass: create map of all comments
    for (const comment of comments) {
      commentMap.set(comment.id, comment);
    }
    
    // Second pass: build hierarchy
    for (const comment of comments) {
      if (comment.isRootComment()) {
        rootComments.push(comment);
      } else {
        const parent = commentMap.get(comment.parent.id);
        if (parent) {
          try {
            parent.addReply(comment);
          } catch (error) {
            console.warn(`Failed to add reply: ${error}`);
          }
        }
      }
    }
    
    return rootComments;
  }

  /**
   * BUSINESS METHOD: Sort Comments
   * 
   * Sorts comments according to specified criteria.
   */
  static sortComments(comments: Comment[], sortBy: string): Comment[] {
    switch (sortBy) {
      case 'recent':
        return [...comments].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      
      case 'engagement':
        return [...comments].sort((a, b) => b.getEngagementScore() - a.getEngagementScore());
      
      case 'chronological':
      default:
        return [...comments].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    }
  }
}
