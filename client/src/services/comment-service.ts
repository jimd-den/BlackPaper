/**
 * COMMENT SERVICE
 * 
 * This module implements the Application Layer service for threaded comment management,
 * handling comment creation, retrieval, and threading operations with Nostr integration.
 * Provides business logic for academic discourse and conversation threading.
 * 
 * Architecture: Implements clean separation between domain logic and Nostr protocol,
 * handling comment hierarchies and discourse quality management.
 */

import { Comment, CommentFilterCriteria, CommentTreeBuilder } from "@/domain/comment";
import { nostrClient, createCommentEvent, createReportEvent } from "@/lib/nostr";

/**
 * COMMENT DATA TRANSFER OBJECTS
 * 
 * Define interfaces for data exchange between service and presentation layers.
 */
export interface CommentDTO {
  id: string;
  nostrEventId: string;
  content: string;
  originalContent: string | null;
  wordCount: number;
  readingTime: number;
  parent: {
    type: 'hypothesis' | 'comment';
    id: string;
    authorPublicKey: string;
  };
  authorPublicKey: string;
  createdAt: Date;
  depth: number;
  isDeleted: boolean;
  isRootComment: boolean;
  canAcceptReplies: boolean;
  replyCount: number;
  threadSize: number;
  engagementScore: number;
  ageInHours: number;
  isRecent: boolean;
  replies: CommentDTO[];
}

export interface AddCommentRequest {
  parentId: string;
  parentType: 'hypothesis' | 'comment';
  content: string;
}

export interface ReportCommentRequest {
  commentId: string;
  reason: string;
}

/**
 * NOSTR EVENT TRANSFORMER FOR COMMENTS
 * 
 * Handles conversion between Nostr events and Comment domain objects.
 */
class CommentEventTransformer {
  /**
   * TRANSFORM NOSTR EVENT TO COMMENT
   * 
   * Converts comment Nostr events into Comment domain objects.
   */
  static eventToComment(event: any, depth: number = 0): Comment {
    try {
      // Extract parent information from tags
      const parentEventTag = event.tags.find((tag: string[]) => tag[0] === 'e');
      const parentAuthorTag = event.tags.find((tag: string[]) => tag[0] === 'p');
      const parentTypeTag = event.tags.find((tag: string[]) => tag[0] === 'parent_type');
      
      if (!parentEventTag || !parentAuthorTag) {
        throw new Error('Invalid comment event: missing parent references');
      }
      
      const parentId = parentEventTag[1];
      const parentAuthorPubkey = parentAuthorTag[1];
      const parentType = (parentTypeTag?.[1] as 'hypothesis' | 'comment') || 'hypothesis';
      
      // Create comment using domain factory
      return Comment.create(
        event.id,
        event.id,
        event.content,
        parentType,
        parentId,
        parentAuthorPubkey,
        event.pubkey,
        new Date(event.created_at * 1000),
        depth
      );
    } catch (error) {
      throw new Error(`Failed to parse comment event: ${error}`);
    }
  }

  /**
   * VALIDATE COMMENT EVENT
   * 
   * Ensures a Nostr event represents a valid comment.
   */
  static isValidCommentEvent(event: any): boolean {
    try {
      const hasCommentTag = event.tags.some((tag: string[]) => 
        tag[0] === 't' && tag[1] === 'blackpaper-comment'
      );
      
      const hasParentRef = event.tags.some((tag: string[]) => tag[0] === 'e');
      const hasAuthorRef = event.tags.some((tag: string[]) => tag[0] === 'p');
      const hasContent = event.content && event.content.trim().length > 0;
      
      return hasCommentTag && hasParentRef && hasAuthorRef && hasContent;
    } catch {
      return false;
    }
  }
}

/**
 * COMMENT SERVICE CLASS
 * 
 * Main service providing business operations for comment management.
 */
export class CommentService {
  /**
   * ADD COMMENT
   * 
   * Creates and publishes a new comment in response to a hypothesis or another comment.
   */
  static async addComment(
    parentId: string,
    parentType: 'hypothesis' | 'comment',
    content: string
  ): Promise<CommentDTO> {
    try {
      const userContext = getCurrentUserContext();
      if (!userContext?.user) {
        throw new Error('User must be authenticated to add comments');
      }

      // Get parent author public key
      const parentAuthorPubkey = await this.getParentAuthor(parentId, parentType);
      
      // Create comment event
      const eventTemplate = createCommentEvent(
        parentId,
        parentAuthorPubkey,
        content,
        parentType
      );
      
      // Sign and publish event
      const signedEvent = nostrClient.signEvent(eventTemplate, userContext.user.privateKey);
      await nostrClient.publishEvent(signedEvent);
      
      // Determine depth for new comment
      const depth = parentType === 'comment' ? await this.getCommentDepth(parentId) + 1 : 0;
      
      // Create domain object
      const comment = Comment.create(
        signedEvent.id,
        signedEvent.id,
        content,
        parentType,
        parentId,
        parentAuthorPubkey,
        signedEvent.pubkey,
        new Date(signedEvent.created_at * 1000),
        depth
      );
      
      return comment.toPlainObject() as CommentDTO;
    } catch (error) {
      throw new Error(`Failed to add comment: ${error}`);
    }
  }

  /**
   * GET COMMENTS FOR HYPOTHESIS
   * 
   * Retrieves all comments associated with a specific hypothesis.
   */
  static async getCommentsForHypothesis(hypothesisId: string): Promise<CommentDTO[]> {
    const criteria = new CommentFilterCriteria(
      'hypothesis',
      hypothesisId,
      'chronological',
      false, // Don't include deleted
      undefined, // No max depth
      100 // Reasonable limit
    );
    
    return this.getComments(criteria);
  }

  /**
   * GET REPLIES TO COMMENT
   * 
   * Retrieves all replies to a specific comment.
   */
  static async getRepliesToComment(
    commentId: string,
    maxDepth?: number
  ): Promise<CommentDTO[]> {
    const criteria = new CommentFilterCriteria(
      'comment',
      commentId,
      'chronological',
      false, // Don't include deleted
      maxDepth,
      50
    );
    
    return this.getComments(criteria);
  }

  /**
   * GET COMMENTS WITH CRITERIA
   * 
   * Retrieves comments based on specified filtering criteria.
   */
  static async getComments(criteria: CommentFilterCriteria): Promise<CommentDTO[]> {
    try {
      const filter = {
        kinds: [1],
        '#e': [criteria.parentId],
        '#t': ['blackpaper-comment'],
        limit: criteria.limit,
      };
      
      return new Promise((resolve) => {
        const comments: Comment[] = [];
        const commentMap = new Map<string, Comment>();
        
        const unsubscribe = nostrClient.subscribeToEvents(
          [filter],
          (event) => {
            if (CommentEventTransformer.isValidCommentEvent(event)) {
              try {
                // Determine comment depth based on parent type and depth
                let depth = 0;
                const parentTypeTag = event.tags.find((tag: string[]) => tag[0] === 'parent_type');
                const parentType = (parentTypeTag?.[1] as 'hypothesis' | 'comment') || 'hypothesis';
                
                if (parentType === 'comment') {
                  const parentEventTag = event.tags.find((tag: string[]) => tag[0] === 'e');
                  const parentId = parentEventTag?.[1];
                  
                  if (parentId && commentMap.has(parentId)) {
                    depth = commentMap.get(parentId)!.depth + 1;
                  } else {
                    depth = 1; // Assume it's a reply if parent type is comment
                  }
                }
                
                const comment = CommentEventTransformer.eventToComment(event, depth);
                
                // Apply filtering criteria
                if (criteria.shouldIncludeComment(comment)) {
                  comments.push(comment);
                  commentMap.set(comment.id, comment);
                }
              } catch (error) {
                console.warn('Failed to parse comment event:', error);
              }
            }
          }
        );
        
        setTimeout(() => {
          unsubscribe();
          
          // Build comment tree structure
          const rootComments = CommentTreeBuilder.buildTree(comments);
          
          // Sort comments according to criteria
          const sortedComments = CommentTreeBuilder.sortComments(rootComments, criteria.sortBy);
          
          // Convert to DTOs
          const commentDTOs = sortedComments.map(c => c.toPlainObject() as CommentDTO);
          
          resolve(commentDTOs);
        }, 4000); // Allow time for all events to be received
      });
    } catch (error) {
      throw new Error(`Failed to get comments: ${error}`);
    }
  }

  /**
   * REPORT COMMENT
   * 
   * Reports a comment for inappropriate content or policy violations.
   */
  static async reportComment(commentId: string, reason: string): Promise<void> {
    try {
      const userContext = getCurrentUserContext();
      if (!userContext?.user) {
        throw new Error('User must be authenticated to report comments');
      }

      // Get comment author public key
      const commentAuthorPubkey = await this.getCommentAuthor(commentId);
      
      // Create report event
      const eventTemplate = createReportEvent(
        commentId,
        commentAuthorPubkey,
        reason
      );
      
      // Sign and publish event
      const signedEvent = nostrClient.signEvent(eventTemplate, userContext.user.privateKey);
      await nostrClient.publishEvent(signedEvent);
      
    } catch (error) {
      throw new Error(`Failed to report comment: ${error}`);
    }
  }

  /**
   * GET COMMENT THREAD
   * 
   * Retrieves a complete thread starting from a specific comment.
   */
  static async getCommentThread(
    commentId: string,
    maxDepth: number = 10
  ): Promise<CommentDTO[]> {
    try {
      // First get the comment itself
      const rootComment = await this.getCommentById(commentId);
      if (!rootComment) {
        return [];
      }
      
      // Then get all replies recursively
      const allComments = await this.getCommentThreadRecursive(commentId, 0, maxDepth);
      
      return allComments;
    } catch (error) {
      throw new Error(`Failed to get comment thread: ${error}`);
    }
  }

  /**
   * SEARCH COMMENTS
   * 
   * Searches comments by content with basic text matching.
   */
  static async searchComments(
    parentId: string,
    parentType: 'hypothesis' | 'comment',
    query: string,
    limit: number = 50
  ): Promise<CommentDTO[]> {
    try {
      const criteria = new CommentFilterCriteria(
        parentType,
        parentId,
        'recent',
        false,
        undefined,
        limit * 2 // Get more to filter
      );
      
      const allComments = await this.getComments(criteria);
      
      // Filter by search query
      const filteredComments = allComments.filter(comment => 
        comment.content.toLowerCase().includes(query.toLowerCase())
      );
      
      return filteredComments.slice(0, limit);
    } catch (error) {
      throw new Error(`Failed to search comments: ${error}`);
    }
  }

  /**
   * GET TOP COMMENTS
   * 
   * Retrieves comments with highest engagement scores.
   */
  static async getTopComments(
    parentId: string,
    parentType: 'hypothesis' | 'comment',
    limit: number = 10
  ): Promise<CommentDTO[]> {
    const criteria = new CommentFilterCriteria(
      parentType,
      parentId,
      'engagement',
      false,
      undefined,
      limit
    );
    
    return this.getComments(criteria);
  }

  /**
   * HELPER METHODS
   */

  /**
   * Get parent author public key
   */
  private static async getParentAuthor(
    parentId: string, 
    parentType: 'hypothesis' | 'comment'
  ): Promise<string> {
    return new Promise((resolve) => {
      const tag = parentType === 'hypothesis' ? 'hypothesis' : 'blackpaper-comment';
      const filter = {
        ids: [parentId],
        kinds: [1],
        '#t': [tag],
      };
      
      const unsubscribe = nostrClient.subscribeToEvents(
        [filter],
        (event) => {
          unsubscribe();
          resolve(event.pubkey);
        }
      );
      
      setTimeout(() => {
        unsubscribe();
        resolve('unknown');
      }, 2000);
    });
  }

  /**
   * Get comment author public key
   */
  private static async getCommentAuthor(commentId: string): Promise<string> {
    return this.getParentAuthor(commentId, 'comment');
  }

  /**
   * Get comment depth in thread hierarchy
   */
  private static async getCommentDepth(commentId: string): Promise<number> {
    return new Promise((resolve) => {
      const filter = {
        ids: [commentId],
        kinds: [1],
        '#t': ['blackpaper-comment'],
      };
      
      const unsubscribe = nostrClient.subscribeToEvents(
        [filter],
        (event) => {
          unsubscribe();
          
          // Check if this comment has a parent comment
          const parentTypeTag = event.tags.find((tag: string[]) => tag[0] === 'parent_type');
          const parentType = parentTypeTag?.[1];
          
          if (parentType === 'comment') {
            const parentEventTag = event.tags.find((tag: string[]) => tag[0] === 'e');
            const parentId = parentEventTag?.[1];
            
            if (parentId) {
              // Recursively get parent depth
              this.getCommentDepth(parentId).then(parentDepth => {
                resolve(parentDepth + 1);
              });
            } else {
              resolve(1);
            }
          } else {
            resolve(0); // Root comment
          }
        }
      );
      
      setTimeout(() => {
        unsubscribe();
        resolve(0);
      }, 2000);
    });
  }

  /**
   * Get comment by ID
   */
  private static async getCommentById(commentId: string): Promise<CommentDTO | null> {
    return new Promise((resolve) => {
      const filter = {
        ids: [commentId],
        kinds: [1],
        '#t': ['blackpaper-comment'],
      };
      
      const unsubscribe = nostrClient.subscribeToEvents(
        [filter],
        (event) => {
          unsubscribe();
          
          try {
            const comment = CommentEventTransformer.eventToComment(event);
            resolve(comment.toPlainObject() as CommentDTO);
          } catch (error) {
            resolve(null);
          }
        }
      );
      
      setTimeout(() => {
        unsubscribe();
        resolve(null);
      }, 2000);
    });
  }

  /**
   * Get comment thread recursively
   */
  private static async getCommentThreadRecursive(
    parentId: string,
    currentDepth: number,
    maxDepth: number
  ): Promise<CommentDTO[]> {
    if (currentDepth >= maxDepth) {
      return [];
    }
    
    const replies = await this.getRepliesToComment(parentId);
    const allComments: CommentDTO[] = [...replies];
    
    // Recursively get replies to each reply
    for (const reply of replies) {
      const subReplies = await this.getCommentThreadRecursive(
        reply.id,
        currentDepth + 1,
        maxDepth
      );
      allComments.push(...subReplies);
    }
    
    return allComments;
  }
}

/**
 * UTILITY FUNCTIONS
 */

function getCurrentUserContext() {
  if (typeof window !== 'undefined' && (window as any).__currentUserContext) {
    return (window as any).__currentUserContext;
  }
  return null;
}

/**
 * VALIDATION UTILITIES
 */
export const CommentValidation = {
  /**
   * Validates comment addition request
   */
  validateAddRequest(data: AddCommentRequest): string[] {
    const errors: string[] = [];
    
    if (!data.content || data.content.trim().length < 3) {
      errors.push('Comment must be at least 3 characters long');
    }
    
    if (data.content && data.content.length > 512) {
      errors.push('Comment must not exceed 512 characters');
    }
    
    if (!data.parentId) {
      errors.push('Parent ID is required');
    }
    
    if (!['hypothesis', 'comment'].includes(data.parentType)) {
      errors.push('Invalid parent type');
    }
    
    return errors;
  },

  /**
   * Validates report request
   */
  validateReportRequest(data: ReportCommentRequest): string[] {
    const errors: string[] = [];
    
    if (!data.commentId) {
      errors.push('Comment ID is required');
    }
    
    if (!data.reason || data.reason.trim().length < 10) {
      errors.push('Report reason must be at least 10 characters');
    }
    
    return errors;
  }
};
