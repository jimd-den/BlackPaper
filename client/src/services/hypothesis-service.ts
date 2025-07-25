
/**
 * HYPOTHESIS SERVICE
 * 
 * This module implements the Application Layer service for hypothesis management,
 * providing a clean interface between the presentation layer and domain logic.
 * Handles hypothesis creation, retrieval, and search operations with Nostr integration.
 * 
 * Architecture: This service abstracts the complexity of Nostr protocol operations
 * and domain model transformations, providing simple async methods for UI components.
 */

import { Hypothesis, HypothesisSearchCriteria, AcademicCategory } from "@/domain/hypothesis";
import { nostrClient, createHypothesisEvent, createFilters, ConnectionStatus } from "@/lib/nostr";
import { useNostr } from "@/hooks/use-nostr";

/**
 * HYPOTHESIS DATA TRANSFER OBJECTS
 * 
 * These interfaces define the shape of data transferred between layers,
 * ensuring type safety and clear contracts.
 */
export interface HypothesisDTO {
  id: string;
  nostrEventId: string;
  title: string;
  body: string;
  bodySummary: string;
  category: AcademicCategory;
  categoryMetadata: any;
  creatorPublicKey: string;
  createdAt: Date;
  supportingSourcesCount: number;
  refutingSourcesCount: number;
  commentsCount: number;
  evidenceBalance: number;
  engagementScore: number;
  isControversial: boolean;
  needsMoreEvidence: boolean;
}

export interface CreateHypothesisRequest {
  title: string;
  body: string;
  category: AcademicCategory;
}

/**
 * NOSTR EVENT TO DOMAIN TRANSFORMER
 * 
 * Converts raw Nostr events into domain hypothesis objects.
 * Handles data validation and transformation between protocol and domain layers.
 */
class NostrEventTransformer {
  /**
   * TRANSFORM NOSTR EVENT TO HYPOTHESIS
   * 
   * Converts a Nostr event into a Hypothesis domain object with proper validation.
   */
  static eventToHypothesis(event: any): Hypothesis {
    try {
      // Parse event content (JSON format)
      const content = typeof event.content === 'string' 
        ? JSON.parse(event.content) 
        : event.content;

      // Extract category from tags
      const categoryTag = event.tags.find((tag: string[]) => tag[0] === 'category');
      const category = categoryTag ? categoryTag[1] as AcademicCategory : AcademicCategory.OTHER;

      // Extract title from tags or content
      const titleTag = event.tags.find((tag: string[]) => tag[0] === 'title');
      const title = titleTag ? titleTag[1] : content.title;

      // Create hypothesis using domain factory
      return Hypothesis.create(
        event.id,
        event.id, // Using event ID as both ID and Nostr event ID
        title,
        content.body || content.content || '',
        category,
        event.pubkey,
        new Date(event.created_at * 1000) // Convert Unix timestamp to Date
      );
    } catch (error) {
      throw new Error(`Failed to parse hypothesis event: ${error}`);
    }
  }

  /**
   * VALIDATE HYPOTHESIS EVENT
   * 
   * Ensures a Nostr event represents a valid hypothesis.
   */
  static isValidHypothesisEvent(event: any): boolean {
    try {
      // Check for required hypothesis tags
      const hasHypothesisTag = event.tags.some((tag: string[]) => 
        tag[0] === 't' && tag[1] === 'hypothesis'
      );

      const hasBlackPaperTag = event.tags.some((tag: string[]) => 
        tag[0] === 't' && tag[1] === 'blackpaper'
      );

      // Validate content structure
      const content = typeof event.content === 'string' 
        ? JSON.parse(event.content) 
        : event.content;

      const hasRequiredContent = (content.title || content.body) && 
        (event.tags.some((tag: string[]) => tag[0] === 'title') || content.title);

      return hasHypothesisTag && hasBlackPaperTag && hasRequiredContent;
    } catch {
      return false;
    }
  }
}

/**
 * HYPOTHESIS SERVICE CLASS
 * 
 * Main service class providing business operations for hypothesis management.
 * Implements the Application Layer pattern with clean separation of concerns.
 */
export class HypothesisService {
  /**
   * CREATE NEW HYPOTHESIS
   * 
   * Creates and publishes a new hypothesis to the Nostr network.
   * Business Rule: User must be authenticated to create hypotheses.
   */
  static async createHypothesis(
    title: string,
    body: string,
    category: AcademicCategory,
    userPrivateKey?: string
  ): Promise<HypothesisDTO> {
    try {
      // Create hypothesis event for Nostr protocol
      const eventTemplate = createHypothesisEvent(title, body, category);

      // Get current user context
      const userContext = getCurrentUserContext();
      const privateKey = userPrivateKey || userContext?.user?.privateKey;

      if (!privateKey) {
        throw new Error('User must be authenticated to create hypotheses');
      }

      // Sign and publish event
      const signedEvent = nostrClient.signEvent(eventTemplate, privateKey);
      console.log('Signed event for publishing:', signedEvent);
      console.log('Event tags:', signedEvent.tags);

      const publishResult = await nostrClient.publishEvent(signedEvent);
      console.log('Publish result:', publishResult);

      // Wait a moment for event to propagate, then test if we can find it
      setTimeout(async () => {
        console.log('Testing: Searching for just-published event...');
        const testFilters = {
          kinds: [1],
          ids: [signedEvent.id],
          limit: 1
        };

        const testUnsubscribe = nostrClient.subscribeToEvents(
          [testFilters],
          (event) => {
            console.log('Found our published event!', event.id);
            testUnsubscribe();
          }
        );

        // Stop test search after 3 seconds
        setTimeout(() => {
          console.log('Test search completed');
          testUnsubscribe();
        }, 3000);
      }, 1000);

      // Create domain object for return
      const hypothesis = Hypothesis.create(
        signedEvent.id,
        signedEvent.id,
        title,
        body,
        category,
        signedEvent.pubkey,
        new Date(signedEvent.created_at * 1000)
      );

      console.log('Created hypothesis object:', hypothesis.toPlainObject());
      return hypothesis.toPlainObject() as HypothesisDTO;
    } catch (error) {
      throw new Error(`Failed to create hypothesis: ${error}`);
    }
  }

  /**
   * GET HYPOTHESIS BY ID
   * 
   * Retrieves a specific hypothesis from the Nostr network.
   */
  static async getHypothesis(id: string): Promise<Hypothesis | null> {
    try {
      const filter = {
        ids: [id],
        kinds: [1],
        '#t': ['hypothesis'],
      };

      return new Promise((resolve, reject) => {
        let eventReceived = false;

        const unsubscribe = nostrClient.subscribeToEvents(
          [filter],
          (event) => {
            if (!eventReceived && NostrEventTransformer.isValidHypothesisEvent(event)) {
              eventReceived = true;
              try {
                const hypothesis = NostrEventTransformer.eventToHypothesis(event);
                // In a real implementation, would also fetch source counts and comments
                resolve(hypothesis);
              } catch (error) {
                reject(error);
              } finally {
                unsubscribe();
              }
            }
          }
        );

        // Timeout after 10 seconds
        setTimeout(() => {
          if (!eventReceived) {
            unsubscribe();
            resolve(null);
          }
        }, 10000);
      });
    } catch (error) {
      throw new Error(`Failed to retrieve hypothesis: ${error}`);
    }
  }

  /**
   * SEARCH HYPOTHESES
   * 
   * Searches for hypotheses based on provided criteria.
   * Implements pagination and filtering according to domain rules.
   */
  static async searchHypotheses(
    criteria: HypothesisSearchCriteria
  ): Promise<Hypothesis[]> {
    try {
      // Check if connected to Nostr network
      if (nostrClient.getConnectionStatus() !== ConnectionStatus.CONNECTED) {
        throw new Error('Not connected to Nostr relays. Please connect first.');
      }

      // Convert domain criteria to Nostr filters
      const filters = criteria.toNostrFilters();
      console.log('Searching for hypotheses with filters:', filters);
      console.log('Connected relays:', nostrClient.getConnectedRelays());

      return new Promise((resolve, reject) => {
        const hypotheses: Hypothesis[] = [];
        let isComplete = false;
        let eventCount = 0;

        const unsubscribe = nostrClient.subscribeToEvents(
          [filters],
          (event) => {
            eventCount++;
            console.log(`Received event ${eventCount}:`, event);
            console.log('Event tags:', event.tags);
            console.log('Event content preview:', event.content.substring(0, 100));

            // Check if it's a hypothesis event (has both blackpaper and hypothesis tags)
            const hasBlackpaperTag = event.tags.some((tag: string[]) => tag[0] === 't' && tag[1] === 'blackpaper');
            const hasHypothesisTag = event.tags.some((tag: string[]) => tag[0] === 't' && tag[1] === 'hypothesis');

            if (hasBlackpaperTag && hasHypothesisTag) {
              console.log('Found BlackPaper hypothesis event:', event.id, event.tags);

              if (NostrEventTransformer.isValidHypothesisEvent(event)) {
                console.log('Valid hypothesis event found:', event.id);
                try {
                  const hypothesis = NostrEventTransformer.eventToHypothesis(event);

                  // Apply client-side filtering for text search
                  if (criteria.query) {
                    const searchQuery = criteria.query.toLowerCase();
                    const titleMatch = hypothesis.title.toString().toLowerCase().includes(searchQuery);
                    const bodyMatch = hypothesis.body.toString().toLowerCase().includes(searchQuery);

                    if (!titleMatch && !bodyMatch) {
                      console.log('Event filtered out by search query');
                      return; // Skip this event
                    }
                  }

                  hypotheses.push(hypothesis);
                  console.log(`Added hypothesis: "${hypothesis.title.toString()}" (total: ${hypotheses.length})`);
                } catch (error) {
                  console.warn('Failed to parse hypothesis event:', error);
                }
              } else {
                console.log('Event failed detailed validation:', event.id);
              }
            } else {
              console.log('Event missing required tags:', event.id, 'blackpaper:', hasBlackpaperTag, 'hypothesis:', hasHypothesisTag);
            }
          }
        );

        // Handle end-of-stored-events
        setTimeout(() => {
          if (!isComplete) {
            isComplete = true;
            unsubscribe();

            console.log(`Search completed. Found ${hypotheses.length} hypotheses from ${eventCount} events`);
            console.log('Connected relays:', nostrClient.getConnectedRelays());

            if (eventCount === 0) {
              console.warn('No events received from relays. This could indicate:');
              console.warn('1. No hypotheses have been published yet');
              console.warn('2. Relay connection issues');
              console.warn('3. Filter mismatch');
              console.warn('4. Events may be too old or not propagated yet');
              console.warn('5. Testing with broader search (no time filter)');
            }

            // Sort hypotheses according to criteria
            const sortedHypotheses = this.sortHypotheses(hypotheses, criteria.sortBy);

            // Apply pagination
            const paginatedHypotheses = sortedHypotheses.slice(
              criteria.offset,
              criteria.offset + criteria.limit
            );

            // Convert to DTOs
            const hypothesisData = paginatedHypotheses.map(h => 
              h.toPlainObject() as HypothesisDTO
            );

            resolve(paginatedHypotheses);
          }
        }, 10000); // Wait 10 seconds for events
      });
    } catch (error) {
      throw new Error(`Failed to search hypotheses: ${error}`);
    }
  }

  /**
   * GET HYPOTHESES BY CATEGORY
   * 
   * Retrieves hypotheses filtered by academic category.
   */
  static async getHypothesesByCategory(
    category: AcademicCategory,
    limit: number = 20,
    offset: number = 0
  ): Promise<HypothesisDTO[]> {
    const criteria = new HypothesisSearchCriteria(
      undefined, // no search query
      category,
      'recent',
      limit,
      offset
    );

    return this.searchHypotheses(criteria);
  }

  /**
   * GET TRENDING HYPOTHESES
   * 
   * Retrieves hypotheses with high engagement scores.
   */
  static async getTrendingHypotheses(limit: number = 10): Promise<HypothesisDTO[]> {
    const criteria = new HypothesisSearchCriteria(
      undefined,
      undefined,
      'discussed', // Sort by most discussed
      limit,
      0
    );

    return this.searchHypotheses(criteria);
  }

  /**
   * SORT HYPOTHESES
   * 
   * Applies sorting logic based on specified criteria.
   * Private method for internal use by search operations.
   */
  private static sortHypotheses(
    hypotheses: Hypothesis[],
    sortBy: 'recent' | 'discussed' | 'sources' | 'controversial'
  ): Hypothesis[] {
    return [...hypotheses].sort((a, b) => {
      switch (sortBy) {
        case 'recent':
          return b.createdAt.getTime() - a.createdAt.getTime();

        case 'discussed':
          return b.getEngagementScore() - a.getEngagementScore();

        case 'sources':
          const aSources = a.supportingSourcesCount + a.refutingSourcesCount;
          const bSources = b.supportingSourcesCount + b.refutingSourcesCount;
          return bSources - aSources;

        case 'controversial':
          // Sort by how close evidence balance is to neutral (0)
          const aBalance = Math.abs(a.getEvidenceBalance());
          const bBalance = Math.abs(b.getEvidenceBalance());
          return aBalance - bBalance;

        default:
          return b.createdAt.getTime() - a.createdAt.getTime();
      }
    });
  }

  /**
   * UPDATE HYPOTHESIS STATISTICS
   * 
   * Updates cached statistics for a hypothesis (sources, comments).
   * Called when related entities are modified.
   */
  static async updateHypothesisStatistics(
    hypothesisId: string,
    supportingSourcesCount: number,
    refutingSourcesCount: number,
    commentsCount: number
  ): Promise<void> {
    // In a real implementation, this might update cached data
    // For Nostr, statistics are typically calculated in real-time
    // This method provides interface for future caching implementations
  }
}

/**
 * UTILITY FUNCTIONS
 * 
 * Helper functions for service operations.
 */

/**
 * GET CURRENT USER CONTEXT
 * 
 * Retrieves current user authentication context.
 * This is a placeholder - in real implementation would integrate with useNostr hook.
 */
function getCurrentUserContext() {
  // This is a temporary implementation
  // In practice, this would be injected or obtained from React context
  if (typeof window !== 'undefined' && (window as any).__currentUserContext) {
    return (window as any).__currentUserContext;
  }

  return null;
}

/**
 * VALIDATION UTILITIES
 * 
 * Helper functions for validating hypothesis data.
 */
export const HypothesisValidation = {
  /**
   * Validates hypothesis creation data
   */
  validateCreateRequest(data: CreateHypothesisRequest): string[] {
    const errors: string[] = [];

    if (!data.title || data.title.length < 10) {
      errors.push('Title must be at least 10 characters long');
    }

    if (!data.body || data.body.length < 50) {
      errors.push('Body must be at least 50 characters long');
    }

    if (!Object.values(AcademicCategory).includes(data.category)) {
      errors.push('Invalid academic category');
    }

    return errors;
  },

  /**
   * Validates hypothesis search criteria
   */
  validateSearchCriteria(criteria: HypothesisSearchCriteria): string[] {
    const errors: string[] = [];

    if (criteria.limit < 1 || criteria.limit > 100) {
      errors.push('Limit must be between 1 and 100');
    }

    if (criteria.offset < 0) {
      errors.push('Offset cannot be negative');
    }

    return errors;
  }
};

/**
 * SERVICE INTEGRATION HELPER
 * 
 * Helper function to integrate with React components.
 * Sets up user context for service operations.
 */
export function initializeHypothesisService(userContext: any) {
  if (typeof window !== 'undefined') {
    (window as any).__currentUserContext = userContext;
  }
}