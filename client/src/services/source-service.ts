/**
 * SOURCE SERVICE
 * 
 * This module implements the Application Layer service for academic source management,
 * handling source addition, voting, and retrieval operations with Nostr integration.
 * Provides business logic for evidence evaluation and community assessment.
 * 
 * Architecture: Abstracts Nostr protocol complexity and implements domain rules
 * for source quality assessment and voting mechanisms.
 */

import { Source, EvidenceStance, SourceFilterCriteria } from "@/domain/source";
import { Vote } from "@/domain/source";
import { nostrClient, createSourceEvent, createVoteEvent } from "@/lib/nostr";

/**
 * SOURCE DATA TRANSFER OBJECTS
 * 
 * Define interfaces for data exchange between service and presentation layers.
 */
export interface SourceDTO {
  id: string;
  nostrEventId: string;
  hypothesisId: string;
  url: string;
  domain: string;
  isAcademicSource: boolean;
  credibilityScore: number;
  description: string;
  descriptionWordCount: number;
  stance: EvidenceStance;
  contributorPublicKey: string;
  createdAt: Date;
  voteScore: number;
  totalVotes: number;
  qualityScore: number;
  isHighQuality: boolean;
  isControversial: boolean;
  isSupporting: boolean;
  isRefuting: boolean;
}

export interface AddSourceRequest {
  hypothesisId: string;
  url: string;
  description: string;
  stance: EvidenceStance;
}

export interface VoteRequest {
  sourceId: string;
  voteValue: number; // +1 for upvote, -1 for downvote, 0 to remove vote
}

/**
 * NOSTR EVENT TRANSFORMER FOR SOURCES
 * 
 * Handles conversion between Nostr events and Source domain objects.
 */
class SourceEventTransformer {
  /**
   * TRANSFORM NOSTR EVENT TO SOURCE
   * 
   * Converts source Nostr events into Source domain objects.
   */
  static eventToSource(event: any): Source {
    try {
      // Parse event content
      const content = typeof event.content === 'string' 
        ? JSON.parse(event.content) 
        : event.content;
      
      // Extract required information from tags
      const hypothesisTag = event.tags.find((tag: string[]) => tag[0] === 'e');
      const stanceTag = event.tags.find((tag: string[]) => tag[0] === 'stance');
      
      if (!hypothesisTag || !stanceTag) {
        throw new Error('Invalid source event: missing required tags');
      }
      
      const hypothesisId = hypothesisTag[1];
      const stance = stanceTag[1] as EvidenceStance;
      
      // Create source using domain factory
      return Source.create(
        event.id,
        event.id,
        hypothesisId,
        content.url,
        content.description,
        stance,
        event.pubkey,
        new Date(event.created_at * 1000)
      );
    } catch (error) {
      throw new Error(`Failed to parse source event: ${error}`);
    }
  }

  /**
   * TRANSFORM VOTE EVENT TO VOTE
   * 
   * Converts vote Nostr events into Vote domain objects.
   */
  static eventToVote(event: any): Vote {
    try {
      // Determine vote value from content or tags
      let voteValue = 0;
      
      if (event.content === '+' || event.content === '+1') {
        voteValue = 1;
      } else if (event.content === '-' || event.content === '-1') {
        voteValue = -1;
      } else {
        // Check for vote_type tag
        const voteTypeTag = event.tags.find((tag: string[]) => tag[0] === 'vote_type');
        if (voteTypeTag) {
          voteValue = voteTypeTag[1] === 'up' ? 1 : -1;
        }
      }
      
      return Vote.create(
        voteValue,
        event.pubkey,
        new Date(event.created_at * 1000)
      );
    } catch (error) {
      throw new Error(`Failed to parse vote event: ${error}`);
    }
  }

  /**
   * VALIDATE SOURCE EVENT
   * 
   * Ensures a Nostr event represents a valid source.
   */
  static isValidSourceEvent(event: any): boolean {
    try {
      const hasSourceTag = event.tags.some((tag: string[]) => 
        tag[0] === 't' && tag[1] === 'source'
      );
      
      const hasHypothesisRef = event.tags.some((tag: string[]) => tag[0] === 'e');
      const hasStanceTag = event.tags.some((tag: string[]) => tag[0] === 'stance');
      
      const content = typeof event.content === 'string' 
        ? JSON.parse(event.content) 
        : event.content;
      
      const hasValidContent = content.url && content.description;
      
      return hasSourceTag && hasHypothesisRef && hasStanceTag && hasValidContent;
    } catch {
      return false;
    }
  }

  /**
   * VALIDATE VOTE EVENT
   * 
   * Ensures a Nostr event represents a valid vote.
   */
  static isValidVoteEvent(event: any): boolean {
    try {
      const hasSourceRef = event.tags.some((tag: string[]) => tag[0] === 'e');
      const hasVoteContent = event.content === '+' || event.content === '-' ||
        event.tags.some((tag: string[]) => tag[0] === 'vote_type');
      
      return hasSourceRef && hasVoteContent;
    } catch {
      return false;
    }
  }
}

/**
 * SOURCE SERVICE CLASS
 * 
 * Main service providing business operations for source management.
 */
export class SourceService {
  /**
   * ADD SOURCE TO HYPOTHESIS
   * 
   * Creates and publishes a new source to support or refute a hypothesis.
   */
  static async addSource(
    hypothesisId: string,
    url: string,
    description: string,
    stance: EvidenceStance
  ): Promise<SourceDTO> {
    try {
      // Get current user context
      const userContext = getCurrentUserContext();
      if (!userContext?.user) {
        throw new Error('User must be authenticated to add sources');
      }

      // Get hypothesis author public key (would need to fetch from hypothesis)
      const hypothesisAuthorPubkey = await this.getHypothesisAuthor(hypothesisId);
      
      // Create source event
      const eventTemplate = createSourceEvent(
        hypothesisId,
        hypothesisAuthorPubkey,
        url,
        description,
        stance
      );
      
      // Sign and publish event
      const signedEvent = nostrClient.signEvent(eventTemplate, userContext.user.privateKey);
      await nostrClient.publishEvent(signedEvent);
      
      // Create domain object
      const source = Source.create(
        signedEvent.id,
        signedEvent.id,
        hypothesisId,
        url,
        description,
        stance,
        signedEvent.pubkey,
        new Date(signedEvent.created_at * 1000)
      );
      
      return source.toPlainObject() as SourceDTO;
    } catch (error) {
      throw new Error(`Failed to add source: ${error}`);
    }
  }

  /**
   * GET SOURCES FOR HYPOTHESIS
   * 
   * Retrieves all sources associated with a specific hypothesis.
   */
  static async getSourcesForHypothesis(hypothesisId: string): Promise<SourceDTO[]> {
    try {
      const filter = {
        kinds: [1],
        '#e': [hypothesisId],
        '#t': ['source'],
      };
      
      return new Promise((resolve, reject) => {
        const sources: Source[] = [];
        const sourceVotes: Map<string, Vote[]> = new Map();
        let isComplete = false;
        
        // Subscribe to source events
        const unsubscribe = nostrClient.subscribeToEvents(
          [filter],
          (event) => {
            if (SourceEventTransformer.isValidSourceEvent(event)) {
              try {
                const source = SourceEventTransformer.eventToSource(event);
                sources.push(source);
              } catch (error) {
                console.warn('Failed to parse source event:', error);
              }
            }
          }
        );
        
        // Also get votes for sources
        setTimeout(async () => {
          if (!isComplete) {
            isComplete = true;
            unsubscribe();
            
            // Fetch votes for all sources
            if (sources.length > 0) {
              const sourceIds = sources.map(s => s.nostrEventId);
              const votes = await this.getVotesForSources(sourceIds);
              
              // Apply votes to sources
              sources.forEach(source => {
                const sourceVoteList = votes.get(source.nostrEventId) || [];
                sourceVoteList.forEach(vote => {
                  source.addVote(vote.voterPublicKey, vote.value);
                });
              });
            }
            
            // Convert to DTOs and sort by quality score
            const sourceDTOs = sources
              .map(s => s.toPlainObject() as SourceDTO)
              .sort((a, b) => b.qualityScore - a.qualityScore);
            
            resolve(sourceDTOs);
          }
        }, 3000);
      });
    } catch (error) {
      throw new Error(`Failed to get sources: ${error}`);
    }
  }

  /**
   * VOTE ON SOURCE
   * 
   * Records a community vote on source quality and relevance.
   */
  static async voteOnSource(sourceId: string, voteValue: number): Promise<void> {
    try {
      // Validate vote value
      if (voteValue !== -1 && voteValue !== 0 && voteValue !== 1) {
        throw new Error('Vote value must be -1, 0, or 1');
      }

      const userContext = getCurrentUserContext();
      if (!userContext?.user) {
        throw new Error('User must be authenticated to vote');
      }

      // If vote value is 0, we're removing the vote (don't publish event)
      if (voteValue === 0) {
        // In Nostr, we can't delete events, so we might publish a new event
        // indicating vote removal, but for simplicity, we'll just not do anything
        return;
      }

      // Get source author public key
      const sourceAuthorPubkey = await this.getSourceAuthor(sourceId);
      
      // Create vote event
      const eventTemplate = createVoteEvent(
        sourceId,
        sourceAuthorPubkey,
        voteValue
      );
      
      // Sign and publish event
      const signedEvent = nostrClient.signEvent(eventTemplate, userContext.user.privateKey);
      await nostrClient.publishEvent(signedEvent);
      
    } catch (error) {
      throw new Error(`Failed to vote on source: ${error}`);
    }
  }

  /**
   * GET VOTES FOR SOURCES
   * 
   * Retrieves all votes for the specified sources.
   */
  private static async getVotesForSources(sourceIds: string[]): Promise<Map<string, Vote[]>> {
    return new Promise((resolve) => {
      const voteMap = new Map<string, Vote[]>();
      let processedSources = 0;
      
      if (sourceIds.length === 0) {
        resolve(voteMap);
        return;
      }
      
      sourceIds.forEach(sourceId => {
        const filter = {
          kinds: [7], // Reaction events
          '#e': [sourceId],
        };
        
        const votes: Vote[] = [];
        
        const unsubscribe = nostrClient.subscribeToEvents(
          [filter],
          (event) => {
            if (SourceEventTransformer.isValidVoteEvent(event)) {
              try {
                const vote = SourceEventTransformer.eventToVote(event);
                votes.push(vote);
              } catch (error) {
                console.warn('Failed to parse vote event:', error);
              }
            }
          }
        );
        
        setTimeout(() => {
          unsubscribe();
          voteMap.set(sourceId, votes);
          processedSources++;
          
          if (processedSources === sourceIds.length) {
            resolve(voteMap);
          }
        }, 2000);
      });
    });
  }

  /**
   * SEARCH SOURCES
   * 
   * Searches sources based on criteria and filters.
   */
  static async searchSources(
    criteria: SourceFilterCriteria
  ): Promise<SourceDTO[]> {
    try {
      const filter = {
        kinds: [1],
        '#e': [criteria.hypothesisId],
        '#t': ['source'],
        limit: criteria.limit,
      };
      
      // Add stance filter if specified
      if (criteria.stance) {
        (filter as any)['#stance'] = [criteria.stance];
      }
      
      return new Promise((resolve) => {
        const sources: Source[] = [];
        
        const unsubscribe = nostrClient.subscribeToEvents(
          [filter],
          (event) => {
            if (SourceEventTransformer.isValidSourceEvent(event)) {
              try {
                const source = SourceEventTransformer.eventToSource(event);
                
                // Apply quality filter if specified
                if (criteria.minQualityScore && 
                    source.getQualityScore() < criteria.minQualityScore) {
                  return;
                }
                
                sources.push(source);
              } catch (error) {
                console.warn('Failed to parse source event:', error);
              }
            }
          }
        );
        
        setTimeout(() => {
          unsubscribe();
          
          // Sort sources
          const sortedSources = this.sortSources(sources, criteria.sortBy);
          
          // Convert to DTOs
          const sourceDTOs = sortedSources.map(s => s.toPlainObject() as SourceDTO);
          
          resolve(sourceDTOs);
        }, 3000);
      });
    } catch (error) {
      throw new Error(`Failed to search sources: ${error}`);
    }
  }

  /**
   * GET HIGH QUALITY SOURCES
   * 
   * Retrieves sources that meet high quality thresholds.
   */
  static async getHighQualitySources(
    hypothesisId: string,
    limit: number = 10
  ): Promise<SourceDTO[]> {
    const criteria = new SourceFilterCriteria(
      hypothesisId,
      undefined,
      'quality',
      2.0, // Minimum quality score
      limit
    );
    
    return this.searchSources(criteria);
  }

  /**
   * SORT SOURCES
   * 
   * Applies sorting logic based on specified criteria.
   */
  private static sortSources(
    sources: Source[],
    sortBy: 'quality' | 'recent' | 'votes'
  ): Source[] {
    return [...sources].sort((a, b) => {
      switch (sortBy) {
        case 'quality':
          return b.getQualityScore() - a.getQualityScore();
        
        case 'recent':
          return b.createdAt.getTime() - a.createdAt.getTime();
        
        case 'votes':
          return b.getVoteScore() - a.getVoteScore();
        
        default:
          return b.getQualityScore() - a.getQualityScore();
      }
    });
  }

  /**
   * GET HYPOTHESIS AUTHOR
   * 
   * Helper method to get the author of a hypothesis.
   * In practice, this would query the hypothesis event.
   */
  private static async getHypothesisAuthor(hypothesisId: string): Promise<string> {
    // Simplified implementation - would query actual hypothesis
    return new Promise((resolve) => {
      const filter = {
        ids: [hypothesisId],
        kinds: [1],
        '#t': ['hypothesis'],
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
        resolve('unknown'); // Fallback
      }, 2000);
    });
  }

  /**
   * GET SOURCE AUTHOR
   * 
   * Helper method to get the author of a source.
   */
  private static async getSourceAuthor(sourceId: string): Promise<string> {
    // Simplified implementation - would query actual source
    return new Promise((resolve) => {
      const filter = {
        ids: [sourceId],
        kinds: [1],
        '#t': ['source'],
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
export const SourceValidation = {
  /**
   * Validates source addition request
   */
  validateAddRequest(data: AddSourceRequest): string[] {
    const errors: string[] = [];
    
    if (!data.url || !data.url.startsWith('https://')) {
      errors.push('URL must be a valid HTTPS address');
    }
    
    if (!data.description || data.description.length < 20) {
      errors.push('Description must be at least 20 characters');
    }
    
    if (!Object.values(EvidenceStance).includes(data.stance)) {
      errors.push('Invalid evidence stance');
    }
    
    return errors;
  },

  /**
   * Validates vote request
   */
  validateVoteRequest(data: VoteRequest): string[] {
    const errors: string[] = [];
    
    if (![- 1, 0, 1].includes(data.voteValue)) {
      errors.push('Vote value must be -1, 0, or 1');
    }
    
    if (!data.sourceId) {
      errors.push('Source ID is required');
    }
    
    return errors;
  }
};
