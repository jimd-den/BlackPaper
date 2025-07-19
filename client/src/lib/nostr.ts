/**
 * NOSTR PROTOCOL INFRASTRUCTURE
 * 
 * This module implements the Frameworks & Drivers layer of our Clean Architecture,
 * providing a clean interface to the Nostr protocol for decentralized communication.
 * 
 * The Nostr (Notes and Other Stuff Transmitted by Relays) protocol enables
 * censorship-resistant, decentralized content sharing through cryptographic signatures.
 */

import { 
  SimplePool, 
  getPublicKey, 
  generateSecretKey, 
  getEventHash, 
  finalizeEvent,
  nip19,
  Relay
} from 'nostr-tools';

type NostrEvent = {
  id?: string;
  kind: number;
  created_at: number;
  tags: string[][];
  content: string;
  pubkey: string;
  sig?: string;
};

type Filter = {
  ids?: string[];
  kinds?: number[];
  authors?: string[];
  since?: number;
  until?: number;
  limit?: number;
  [key: string]: any;
};

/**
 * DOMAIN-SPECIFIC EVENT KINDS
 * 
 * These constants define our application-specific Nostr event types,
 * establishing the protocol vocabulary for academic discourse.
 */
export const BLACK_PAPER_EVENT_KINDS = {
  HYPOTHESIS: 1, // Text note with hypothesis tag
  SOURCE: 1, // Text note with source tag
  VOTE: 7, // Reaction event for voting
  REPORT: 1984, // Reporting/moderation event
} as const;

/**
 * RELAY CONFIGURATION
 * 
 * Default relay pool for connecting to the Nostr network.
 * These relays provide redundancy and ensure content availability.
 */
export const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band',
  'wss://nostr.mom',
  'wss://offchain.pub'
] as const;

/**
 * NOSTR CLIENT INTERFACE
 * 
 * This interface defines the contract for our Nostr client implementation,
 * following the Interface Segregation Principle to provide only necessary methods.
 */
export interface NostrClient {
  connect(relays: string[]): Promise<void>;
  disconnect(): Promise<void>;
  getConnectionStatus(): ConnectionStatus;
  publishEvent(event: NostrEvent): Promise<void>;
  subscribeToEvents(filters: Filter[], callback: (event: NostrEvent) => void): () => void;
  generateKeypair(): { privateKey: string; publicKey: string };
  signEvent(event: Partial<NostrEvent>, privateKey: string): NostrEvent;
}

/**
 * CONNECTION STATUS ENUM
 * 
 * Represents the current state of Nostr relay connections.
 */
export enum ConnectionStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ERROR = 'error',
}

/**
 * CONCRETE NOSTR CLIENT IMPLEMENTATION
 * 
 * This class implements the NostrClient interface using the nostr-tools library,
 * providing a clean abstraction over the protocol complexities.
 */
export class BlackPaperNostrClient implements NostrClient {
  private pool: SimplePool;
  private connectedRelays: Set<string> = new Set();
  private status: ConnectionStatus = ConnectionStatus.DISCONNECTED;

  constructor() {
    this.pool = new SimplePool();
  }

  /**
   * ESTABLISH RELAY CONNECTIONS
   * 
   * Connects to the specified relay servers to enable content publishing
   * and subscription to network events.
   */
  async connect(relays: string[]): Promise<void> {
    this.status = ConnectionStatus.CONNECTING;
    
    try {
      // Test connections to all relays
      const connectionPromises = relays.map(async (relay) => {
        try {
          // Simple connection test
          await this.pool.ensureRelay(relay);
          this.connectedRelays.add(relay);
          return true;
        } catch (error) {
          console.warn(`Failed to connect to relay ${relay}:`, error);
          return false;
        }
      });

      await Promise.allSettled(connectionPromises);
      
      if (this.connectedRelays.size > 0) {
        this.status = ConnectionStatus.CONNECTED;
      } else {
        this.status = ConnectionStatus.ERROR;
        throw new Error('Failed to connect to any relays');
      }
    } catch (error) {
      this.status = ConnectionStatus.ERROR;
      throw error;
    }
  }

  /**
   * TERMINATE RELAY CONNECTIONS
   * 
   * Cleanly disconnects from all relay servers and cleans up resources.
   */
  async disconnect(): Promise<void> {
    this.pool.close(Array.from(this.connectedRelays));
    this.connectedRelays.clear();
    this.status = ConnectionStatus.DISCONNECTED;
  }

  /**
   * GET CONNECTION STATUS
   * 
   * Returns the current connection state for UI status indicators.
   */
  getConnectionStatus(): ConnectionStatus {
    return this.status;
  }

  /**
   * PUBLISH EVENT TO NETWORK
   * 
   * Publishes a signed event to all connected relays,
   * ensuring content reaches the decentralized network.
   */
  async publishEvent(event: NostrEvent): Promise<void> {
    if (this.status !== ConnectionStatus.CONNECTED) {
      throw new Error('Not connected to any relays');
    }

    const relays = Array.from(this.connectedRelays);
    await Promise.allSettled(
      relays.map(relay => this.pool.publish([relay], event))
    );
  }

  /**
   * SUBSCRIBE TO NETWORK EVENTS
   * 
   * Establishes subscriptions to receive relevant events from the network
   * based on the provided filters.
   */
  subscribeToEvents(filters: Filter[], callback: (event: NostrEvent) => void): () => void {
    if (this.status !== ConnectionStatus.CONNECTED) {
      throw new Error('Not connected to any relays');
    }

    const relays = Array.from(this.connectedRelays);
    const subscription = this.pool.sub(relays, filters);
    
    subscription.on('event', callback);
    subscription.on('eose', () => {
      console.log('End of stored events received');
    });

    // Return unsubscribe function
    return () => {
      subscription.unsub();
    };
  }

  /**
   * GENERATE CRYPTOGRAPHIC KEYPAIR
   * 
   * Creates a new private/public key pair for user identity.
   * The private key must be kept secure and never transmitted.
   */
  generateKeypair(): { privateKey: string; publicKey: string } {
    const privateKey = generateSecretKey();
    const publicKey = getPublicKey(privateKey);
    
    return {
      privateKey: nip19.nsecEncode(privateKey),
      publicKey: nip19.npubEncode(publicKey),
    };
  }

  /**
   * SIGN EVENT WITH PRIVATE KEY
   * 
   * Creates a cryptographically signed event that can be published
   * to the network with proof of authorship.
   */
  signEvent(eventTemplate: Partial<NostrEvent>, privateKey: string): NostrEvent {
    // Decode nsec format to hex if needed
    const hexPrivateKey = privateKey.startsWith('nsec') 
      ? nip19.decode(privateKey).data as string
      : privateKey;

    const event = {
      kind: eventTemplate.kind || 1,
      created_at: eventTemplate.created_at || Math.floor(Date.now() / 1000),
      tags: eventTemplate.tags || [],
      content: eventTemplate.content || '',
      pubkey: getPublicKey(hexPrivateKey),
    };

    // Use finalizeEvent to sign and add id/sig
    return finalizeEvent(event, hexPrivateKey) as NostrEvent;
  }
}

/**
 * HYPOTHESIS EVENT FACTORY
 * 
 * Creates properly formatted Nostr events for hypothesis publication.
 */
export function createHypothesisEvent(
  title: string, 
  body: string, 
  category: string
): Partial<NostrEvent> {
  return {
    kind: BLACK_PAPER_EVENT_KINDS.HYPOTHESIS,
    content: JSON.stringify({ title, body }),
    tags: [
      ['t', 'hypothesis'],
      ['t', 'blackpaper'],
      ['category', category],
      ['title', title],
    ],
  };
}

/**
 * SOURCE EVENT FACTORY
 * 
 * Creates properly formatted Nostr events for source citation.
 */
export function createSourceEvent(
  hypothesisEventId: string,
  hypothesisAuthorPubkey: string,
  url: string,
  description: string,
  stance: 'supporting' | 'refuting'
): Partial<NostrEvent> {
  return {
    kind: BLACK_PAPER_EVENT_KINDS.SOURCE,
    content: JSON.stringify({ url, description }),
    tags: [
      ['t', 'source'],
      ['t', 'blackpaper'],
      ['e', hypothesisEventId],
      ['p', hypothesisAuthorPubkey],
      ['stance', stance],
    ],
  };
}

/**
 * VOTE EVENT FACTORY
 * 
 * Creates properly formatted Nostr events for source voting.
 */
export function createVoteEvent(
  sourceEventId: string,
  sourceAuthorPubkey: string,
  voteValue: number
): Partial<NostrEvent> {
  return {
    kind: BLACK_PAPER_EVENT_KINDS.VOTE,
    content: voteValue > 0 ? '+' : '-',
    tags: [
      ['e', sourceEventId],
      ['p', sourceAuthorPubkey],
      ['t', 'blackpaper-vote'],
    ],
  };
}

/**
 * COMMENT EVENT FACTORY
 * 
 * Creates properly formatted Nostr events for threaded comments.
 */
export function createCommentEvent(
  parentEventId: string,
  parentAuthorPubkey: string,
  content: string,
  parentType: 'hypothesis' | 'comment'
): Partial<NostrEvent> {
  return {
    kind: 1, // Standard text note
    content,
    tags: [
      ['e', parentEventId],
      ['p', parentAuthorPubkey],
      ['t', 'blackpaper-comment'],
      ['parent_type', parentType],
    ],
  };
}

/**
 * REPORT EVENT FACTORY
 * 
 * Creates properly formatted Nostr events for content reporting.
 */
export function createReportEvent(
  reportedEventId: string,
  reportedAuthorPubkey: string,
  reason: string
): Partial<NostrEvent> {
  return {
    kind: BLACK_PAPER_EVENT_KINDS.REPORT,
    content: reason,
    tags: [
      ['e', reportedEventId],
      ['p', reportedAuthorPubkey],
      ['t', 'blackpaper-report'],
    ],
  };
}

/**
 * EVENT FILTER FACTORY
 * 
 * Creates filter objects for querying specific types of content from relays.
 */
export const createFilters = {
  hypotheses: (): Filter => ({
    kinds: [BLACK_PAPER_EVENT_KINDS.HYPOTHESIS],
    '#t': ['hypothesis'],
    limit: 50,
  }),

  sourcesForHypothesis: (hypothesisEventId: string): Filter => ({
    kinds: [BLACK_PAPER_EVENT_KINDS.SOURCE],
    '#e': [hypothesisEventId],
    '#t': ['source'],
  }),

  votesForSource: (sourceEventId: string): Filter => ({
    kinds: [BLACK_PAPER_EVENT_KINDS.VOTE],
    '#e': [sourceEventId],
  }),

  commentsForEvent: (eventId: string): Filter => ({
    kinds: [1],
    '#e': [eventId],
    '#t': ['blackpaper-comment'],
  }),

  userEvents: (pubkey: string): Filter => ({
    authors: [pubkey],
    '#t': ['blackpaper'],
  }),
};

// Export singleton instance
export const nostrClient = new BlackPaperNostrClient();
