/**
 * USER DOMAIN MODEL
 * 
 * This module defines the domain logic for user identity and participation
 * in our decentralized academic discourse platform. Users are identified by
 * cryptographic keypairs following the Nostr protocol.
 * 
 * Enterprise Layer: Encapsulates business rules for user identity, reputation,
 * and participation tracking in academic discourse.
 */

/**
 * PUBLIC KEY VALUE OBJECT
 * 
 * Represents a validated Nostr public key that serves as user identity.
 * Encapsulates key validation and format conversion business rules.
 */
export class PublicKey {
  private constructor(
    private readonly value: string,
    private readonly format: 'hex' | 'npub'
  ) {}

  /**
   * FACTORY METHOD: Create from Hex
   * 
   * Creates public key from hexadecimal format.
   */
  static fromHex(hex: string): PublicKey {
    const trimmed = hex.trim().toLowerCase();
    
    if (!/^[0-9a-f]{64}$/.test(trimmed)) {
      throw new Error('Invalid hex public key format');
    }
    
    return new PublicKey(trimmed, 'hex');
  }

  /**
   * FACTORY METHOD: Create from Npub
   * 
   * Creates public key from npub (bech32) format.
   */
  static fromNpub(npub: string): PublicKey {
    const trimmed = npub.trim();
    
    if (!trimmed.startsWith('npub1')) {
      throw new Error('Invalid npub format - must start with npub1');
    }
    
    if (trimmed.length !== 63) {
      throw new Error('Invalid npub format - incorrect length');
    }
    
    return new PublicKey(trimmed, 'npub');
  }

  /**
   * BUSINESS METHOD: To Hex
   * 
   * Returns public key in hexadecimal format.
   */
  toHex(): string {
    if (this.format === 'hex') {
      return this.value;
    }
    
    // In real implementation, would use nip19.decode
    // For now, return as-is (this would be properly implemented with nostr-tools)
    return this.value;
  }

  /**
   * BUSINESS METHOD: To Npub
   * 
   * Returns public key in npub (user-friendly) format.
   */
  toNpub(): string {
    if (this.format === 'npub') {
      return this.value;
    }
    
    // In real implementation, would use nip19.npubEncode
    // For now, return as-is (this would be properly implemented with nostr-tools)
    return this.value;
  }

  /**
   * BUSINESS METHOD: Get Short Display
   * 
   * Returns abbreviated public key for UI display.
   */
  toShortDisplay(): string {
    const npub = this.toNpub();
    return `${npub.slice(0, 8)}...${npub.slice(-4)}`;
  }

  toString(): string {
    return this.toNpub();
  }

  equals(other: PublicKey): boolean {
    return this.toHex() === other.toHex();
  }
}

/**
 * DISPLAY NAME VALUE OBJECT
 * 
 * Represents an optional human-readable name for user identification.
 * Enforces naming standards for academic discourse.
 */
export class DisplayName {
  private constructor(private readonly value: string) {}

  /**
   * FACTORY METHOD: Create Display Name
   * 
   * Business Rule: Display names must be professional and appropriate
   * for academic discourse contexts.
   */
  static create(name: string): DisplayName {
    const trimmed = name.trim();
    
    if (trimmed.length === 0) {
      throw new Error('Display name cannot be empty');
    }
    
    if (trimmed.length > 50) {
      throw new Error('Display name must not exceed 50 characters');
    }
    
    // Basic content filter for academic appropriateness
    if (!/^[a-zA-Z0-9\s\-_\.]+$/.test(trimmed)) {
      throw new Error('Display name must contain only letters, numbers, spaces, hyphens, underscores, and periods');
    }
    
    return new DisplayName(trimmed);
  }

  toString(): string {
    return this.value;
  }

  equals(other: DisplayName): boolean {
    return this.value === other.value;
  }
}

/**
 * USER REPUTATION VALUE OBJECT
 * 
 * Represents community-assessed reputation based on contribution quality.
 * Encapsulates reputation calculation and tier classification.
 */
export class UserReputation {
  private constructor(
    private readonly score: number,
    private readonly contributionCount: number,
    private readonly positiveVotes: number,
    private readonly negativeVotes: number
  ) {}

  /**
   * FACTORY METHOD: Calculate Reputation
   * 
   * Calculates reputation based on user contributions and community feedback.
   */
  static calculate(
    contributionCount: number,
    positiveVotes: number,
    negativeVotes: number
  ): UserReputation {
    if (contributionCount < 0 || positiveVotes < 0 || negativeVotes < 0) {
      throw new Error('Reputation metrics cannot be negative');
    }
    
    // Reputation algorithm: weighted by contribution quality and quantity
    const voteRatio = positiveVotes + negativeVotes > 0 
      ? positiveVotes / (positiveVotes + negativeVotes)
      : 0.5; // Neutral if no votes
    
    const qualityScore = voteRatio * 100; // 0-100 based on vote ratio
    const quantityBonus = Math.min(contributionCount * 2, 50); // Up to 50 points for quantity
    
    const score = qualityScore + quantityBonus;
    
    return new UserReputation(score, contributionCount, positiveVotes, negativeVotes);
  }

  /**
   * BUSINESS QUERY: Get Reputation Tier
   * 
   * Classifies user into reputation tiers for UI treatment.
   */
  getTier(): 'newcomer' | 'contributor' | 'established' | 'expert' | 'authority' {
    if (this.score < 20) return 'newcomer';
    if (this.score < 50) return 'contributor';
    if (this.score < 100) return 'established';
    if (this.score < 200) return 'expert';
    return 'authority';
  }

  /**
   * BUSINESS QUERY: Get Trust Level
   * 
   * Returns numeric trust level (0-5) for moderation purposes.
   */
  getTrustLevel(): number {
    const tier = this.getTier();
    const trustLevels = {
      'newcomer': 0,
      'contributor': 1,
      'established': 2,
      'expert': 3,
      'authority': 4,
    };
    return trustLevels[tier];
  }

  /**
   * BUSINESS QUERY: Can Moderate
   * 
   * Determines if user has sufficient reputation for moderation actions.
   */
  canModerate(): boolean {
    return this.getTrustLevel() >= 3 && this.contributionCount >= 25;
  }

  getScore(): number {
    return Math.round(this.score);
  }

  getContributionCount(): number {
    return this.contributionCount;
  }

  getPositiveVoteRatio(): number {
    const total = this.positiveVotes + this.negativeVotes;
    return total > 0 ? this.positiveVotes / total : 0;
  }
}

/**
 * USER ACTIVITY METRICS VALUE OBJECT
 * 
 * Tracks user participation patterns and engagement levels.
 */
export class UserActivityMetrics {
  constructor(
    public readonly hypothesesCreated: number,
    public readonly sourcesContributed: number,
    public readonly commentsPosted: number,
    public readonly votescast: number,
    public readonly lastActivityAt: Date,
    public readonly joinedAt: Date
  ) {
    if (hypothesesCreated < 0 || sourcesContributed < 0 || 
        commentsPosted < 0 || votescast < 0) {
      throw new Error('Activity metrics cannot be negative');
    }
  }

  /**
   * BUSINESS QUERY: Get Total Contributions
   * 
   * Returns total number of content contributions.
   */
  getTotalContributions(): number {
    return this.hypothesesCreated + this.sourcesContributed + this.commentsPosted;
  }

  /**
   * BUSINESS QUERY: Get Activity Level
   * 
   * Classifies user activity level for engagement analysis.
   */
  getActivityLevel(): 'inactive' | 'occasional' | 'regular' | 'active' | 'prolific' {
    const totalContributions = this.getTotalContributions();
    const daysSinceJoined = this.getDaysSinceJoined();
    const contributionRate = totalContributions / Math.max(daysSinceJoined, 1);
    
    if (contributionRate < 0.1) return 'inactive';
    if (contributionRate < 0.5) return 'occasional';
    if (contributionRate < 1) return 'regular';
    if (contributionRate < 3) return 'active';
    return 'prolific';
  }

  /**
   * BUSINESS QUERY: Is Recent User
   * 
   * Determines if user joined recently (within 30 days).
   */
  isRecentUser(): boolean {
    return this.getDaysSinceJoined() <= 30;
  }

  /**
   * BUSINESS QUERY: Is Active Recently
   * 
   * Determines if user has been active within the last 7 days.
   */
  isActiveRecently(): boolean {
    const daysSinceActivity = (Date.now() - this.lastActivityAt.getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceActivity <= 7;
  }

  private getDaysSinceJoined(): number {
    return (Date.now() - this.joinedAt.getTime()) / (1000 * 60 * 60 * 24);
  }
}

/**
 * USER AGGREGATE ROOT
 * 
 * Central entity representing a participant in our academic discourse platform.
 * Manages user identity, reputation, and participation tracking.
 */
export class User {
  private constructor(
    public readonly id: string,
    public readonly publicKey: PublicKey,
    public readonly displayName?: DisplayName,
    public readonly nip05?: string,
    public readonly reputation: UserReputation = UserReputation.calculate(0, 0, 0),
    public readonly activityMetrics: UserActivityMetrics = new UserActivityMetrics(0, 0, 0, 0, new Date(), new Date()),
    public readonly joinedAt: Date = new Date()
  ) {}

  /**
   * FACTORY METHOD: Create New User
   * 
   * Creates a new user with minimal required information.
   */
  static create(
    id: string,
    publicKeyString: string,
    displayName?: string,
    nip05?: string
  ): User {
    let publicKey: PublicKey;
    
    try {
      publicKey = publicKeyString.startsWith('npub') 
        ? PublicKey.fromNpub(publicKeyString)
        : PublicKey.fromHex(publicKeyString);
    } catch (error) {
      throw new Error(`Invalid public key format: ${error}`);
    }
    
    const validatedDisplayName = displayName ? DisplayName.create(displayName) : undefined;
    
    // Validate NIP-05 if provided
    if (nip05 && !/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(nip05)) {
      throw new Error('Invalid NIP-05 identifier format');
    }
    
    return new User(id, publicKey, validatedDisplayName, nip05);
  }

  /**
   * FACTORY METHOD: From Database Record
   * 
   * Reconstructs domain object from persistence layer data.
   */
  static fromRecord(record: any): User {
    const publicKey = record.publicKey.startsWith('npub')
      ? PublicKey.fromNpub(record.publicKey)
      : PublicKey.fromHex(record.publicKey);
    
    const displayName = record.displayName ? DisplayName.create(record.displayName) : undefined;
    
    const reputation = UserReputation.calculate(
      record.contributionCount || 0,
      record.positiveVotes || 0,
      record.negativeVotes || 0
    );
    
    const activityMetrics = new UserActivityMetrics(
      record.hypothesesCreated || 0,
      record.sourcesContributed || 0,
      record.commentsPosted || 0,
      record.votescast || 0,
      new Date(record.lastActivityAt || record.joinedAt),
      new Date(record.joinedAt)
    );
    
    return new User(
      record.id,
      publicKey,
      displayName,
      record.nip05,
      reputation,
      activityMetrics,
      new Date(record.joinedAt)
    );
  }

  /**
   * BUSINESS METHOD: Update Display Name
   * 
   * Updates user's display name with validation.
   */
  updateDisplayName(newDisplayName: string): User {
    const validatedDisplayName = DisplayName.create(newDisplayName);
    
    return new User(
      this.id,
      this.publicKey,
      validatedDisplayName,
      this.nip05,
      this.reputation,
      this.activityMetrics,
      this.joinedAt
    );
  }

  /**
   * BUSINESS METHOD: Record Activity
   * 
   * Updates activity metrics when user performs an action.
   */
  recordActivity(
    activityType: 'hypothesis' | 'source' | 'comment' | 'vote',
    positiveVoteReceived: number = 0,
    negativeVoteReceived: number = 0
  ): User {
    const currentMetrics = this.activityMetrics;
    
    const updatedMetrics = new UserActivityMetrics(
      currentMetrics.hypothesesCreated + (activityType === 'hypothesis' ? 1 : 0),
      currentMetrics.sourcesContributed + (activityType === 'source' ? 1 : 0),
      currentMetrics.commentsPosted + (activityType === 'comment' ? 1 : 0),
      currentMetrics.votescast + (activityType === 'vote' ? 1 : 0),
      new Date(), // Update last activity
      currentMetrics.joinedAt
    );
    
    const updatedReputation = UserReputation.calculate(
      updatedMetrics.getTotalContributions(),
      this.reputation.getScore() + positiveVoteReceived,
      negativeVoteReceived
    );
    
    return new User(
      this.id,
      this.publicKey,
      this.displayName,
      this.nip05,
      updatedReputation,
      updatedMetrics,
      this.joinedAt
    );
  }

  /**
   * BUSINESS QUERY: Get Display Identity
   * 
   * Returns the best available display identity for the user.
   */
  getDisplayIdentity(): string {
    if (this.displayName) {
      return this.displayName.toString();
    }
    
    if (this.nip05) {
      return this.nip05;
    }
    
    return this.publicKey.toShortDisplay();
  }

  /**
   * BUSINESS QUERY: Can Create Hypothesis
   * 
   * Determines if user has sufficient reputation to create hypotheses.
   */
  canCreateHypothesis(): boolean {
    // All users can create hypotheses, but new users may have limits
    return true;
  }

  /**
   * BUSINESS QUERY: Can Vote
   * 
   * Determines if user can vote on sources.
   */
  canVote(): boolean {
    // All verified users can vote
    return true;
  }

  /**
   * BUSINESS QUERY: Can Moderate
   * 
   * Determines if user has moderation privileges.
   */
  canModerate(): boolean {
    return this.reputation.canModerate();
  }

  /**
   * BUSINESS QUERY: Is Established User
   * 
   * Determines if user is established in the community.
   */
  isEstablishedUser(): boolean {
    const tier = this.reputation.getTier();
    return ['established', 'expert', 'authority'].includes(tier);
  }

  /**
   * VALUE OBJECT CONVERSION
   * 
   * Converts domain object to plain object for serialization.
   */
  toPlainObject() {
    return {
      id: this.id,
      publicKey: this.publicKey.toNpub(),
      publicKeyHex: this.publicKey.toHex(),
      shortDisplay: this.publicKey.toShortDisplay(),
      displayName: this.displayName?.toString(),
      displayIdentity: this.getDisplayIdentity(),
      nip05: this.nip05,
      reputation: {
        score: this.reputation.getScore(),
        tier: this.reputation.getTier(),
        trustLevel: this.reputation.getTrustLevel(),
        contributionCount: this.reputation.getContributionCount(),
        positiveVoteRatio: this.reputation.getPositiveVoteRatio(),
      },
      activity: {
        totalContributions: this.activityMetrics.getTotalContributions(),
        activityLevel: this.activityMetrics.getActivityLevel(),
        isRecentUser: this.activityMetrics.isRecentUser(),
        isActiveRecently: this.activityMetrics.isActiveRecently(),
        hypothesesCreated: this.activityMetrics.hypothesesCreated,
        sourcesContributed: this.activityMetrics.sourcesContributed,
        commentsPosted: this.activityMetrics.commentsPosted,
        votescast: this.activityMetrics.votescast,
      },
      permissions: {
        canCreateHypothesis: this.canCreateHypothesis(),
        canVote: this.canVote(),
        canModerate: this.canModerate(),
      },
      joinedAt: this.joinedAt,
      isEstablished: this.isEstablishedUser(),
    };
  }
}
