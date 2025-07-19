/**
 * HYPOTHESIS DOMAIN MODEL
 * 
 * This module defines the core business entities and value objects for the Hypothesis aggregate
 * in our academic discourse domain. It implements Domain-Driven Design principles to
 * encapsulate business rules and maintain data integrity.
 * 
 * Enterprise Layer: These domain objects represent the fundamental concepts that exist
 * independently of any particular application or technology.
 */

/**
 * HYPOTHESIS VALUE OBJECT
 * 
 * Represents a testable proposition in academic discourse.
 * Encapsulates business rules for hypothesis validation and categorization.
 */
export class HypothesisTitle {
  private constructor(private readonly value: string) {}

  /**
   * FACTORY METHOD: Create Title
   * 
   * Implements business rule: Hypothesis titles must be descriptive yet concise
   * to facilitate effective academic communication and searchability.
   */
  static create(title: string): HypothesisTitle {
    const trimmed = title.trim();
    
    if (trimmed.length < 10) {
      throw new Error('Hypothesis title must be at least 10 characters to be descriptive');
    }
    
    if (trimmed.length > 256) {
      throw new Error('Hypothesis title must not exceed 256 characters for readability');
    }
    
    if (!/^[a-zA-Z]/.test(trimmed)) {
      throw new Error('Hypothesis title must start with a letter');
    }
    
    return new HypothesisTitle(trimmed);
  }

  toString(): string {
    return this.value;
  }

  equals(other: HypothesisTitle): boolean {
    return this.value === other.value;
  }
}

/**
 * HYPOTHESIS BODY VALUE OBJECT
 * 
 * Represents the detailed description of a hypothesis.
 * Enforces academic writing standards and content quality.
 */
export class HypothesisBody {
  private constructor(private readonly value: string) {}

  /**
   * FACTORY METHOD: Create Body
   * 
   * Business Rule: Hypothesis descriptions must provide sufficient detail
   * for peer evaluation while remaining concise enough for effective review.
   */
  static create(body: string): HypothesisBody {
    const trimmed = body.trim();
    
    if (trimmed.length < 50) {
      throw new Error('Hypothesis description must be at least 50 characters for adequate detail');
    }
    
    if (trimmed.length > 1024) {
      throw new Error('Hypothesis description must not exceed 1024 characters');
    }
    
    // Basic quality check: ensure it contains multiple sentences
    const sentenceCount = (trimmed.match(/[.!?]+/g) || []).length;
    if (sentenceCount < 2) {
      throw new Error('Hypothesis description should contain multiple sentences for clarity');
    }
    
    return new HypothesisBody(trimmed);
  }

  toString(): string {
    return this.value;
  }

  /**
   * BUSINESS METHOD: Extract Summary
   * 
   * Creates a truncated version for display in lists while preserving meaning.
   */
  getSummary(maxLength: number = 200): string {
    if (this.value.length <= maxLength) {
      return this.value;
    }
    
    // Find last complete sentence within limit
    const truncated = this.value.substring(0, maxLength);
    const lastSentenceEnd = Math.max(
      truncated.lastIndexOf('.'),
      truncated.lastIndexOf('!'),
      truncated.lastIndexOf('?')
    );
    
    if (lastSentenceEnd > maxLength * 0.6) {
      return truncated.substring(0, lastSentenceEnd + 1);
    }
    
    return truncated + '...';
  }
}

/**
 * ACADEMIC CATEGORY ENUMERATION
 * 
 * Defines the academic disciplines supported by our platform.
 * This controlled vocabulary ensures consistent categorization.
 */
export enum AcademicCategory {
  PHYSICS = 'physics',
  BIOLOGY = 'biology',
  ECONOMICS = 'economics',
  PSYCHOLOGY = 'psychology',
  MATHEMATICS = 'mathematics',
  COMPUTER_SCIENCE = 'computer_science',
  PHILOSOPHY = 'philosophy',
  OTHER = 'other',
}

/**
 * CATEGORY METADATA
 * 
 * Provides display information and validation rules for academic categories.
 */
export const CATEGORY_METADATA = {
  [AcademicCategory.PHYSICS]: {
    displayName: 'Physics',
    icon: 'fas fa-atom',
    color: 'text-blue-600',
    description: 'Physical sciences and natural phenomena',
  },
  [AcademicCategory.BIOLOGY]: {
    displayName: 'Biology',
    icon: 'fas fa-dna',
    color: 'text-green-600',
    description: 'Life sciences and biological systems',
  },
  [AcademicCategory.ECONOMICS]: {
    displayName: 'Economics',
    icon: 'fas fa-chart-line',
    color: 'text-orange-600',
    description: 'Economic theory and market behavior',
  },
  [AcademicCategory.PSYCHOLOGY]: {
    displayName: 'Psychology',
    icon: 'fas fa-brain',
    color: 'text-purple-600',
    description: 'Human behavior and mental processes',
  },
  [AcademicCategory.MATHEMATICS]: {
    displayName: 'Mathematics',
    icon: 'fas fa-calculator',
    color: 'text-red-600',
    description: 'Mathematical theory and proofs',
  },
  [AcademicCategory.COMPUTER_SCIENCE]: {
    displayName: 'Computer Science',
    icon: 'fas fa-laptop-code',
    color: 'text-indigo-600',
    description: 'Computational theory and software systems',
  },
  [AcademicCategory.PHILOSOPHY]: {
    displayName: 'Philosophy',
    icon: 'fas fa-lightbulb',
    color: 'text-yellow-600',
    description: 'Philosophical inquiry and reasoning',
  },
  [AcademicCategory.OTHER]: {
    displayName: 'Other',
    icon: 'fas fa-question',
    color: 'text-gray-600',
    description: 'Interdisciplinary or emerging fields',
  },
} as const;

/**
 * HYPOTHESIS AGGREGATE ROOT
 * 
 * The central entity in our hypothesis evaluation domain.
 * Encapsulates all business logic related to hypothesis creation and validation.
 */
export class Hypothesis {
  private constructor(
    public readonly id: string,
    public readonly nostrEventId: string,
    public readonly title: HypothesisTitle,
    public readonly body: HypothesisBody,
    public readonly category: AcademicCategory,
    public readonly creatorPublicKey: string,
    public readonly createdAt: Date,
    private sourceStats: { supporting: number; refuting: number } = { supporting: 0, refuting: 0 },
    private commentCount: number = 0
  ) {}

  /**
   * FACTORY METHOD: Create New Hypothesis
   * 
   * Creates a new hypothesis with validation of all business rules.
   * This method ensures domain invariants are maintained from creation.
   */
  static create(
    id: string,
    nostrEventId: string,
    title: string,
    body: string,
    category: AcademicCategory,
    creatorPublicKey: string,
    createdAt: Date = new Date()
  ): Hypothesis {
    const validatedTitle = HypothesisTitle.create(title);
    const validatedBody = HypothesisBody.create(body);
    
    if (!creatorPublicKey || creatorPublicKey.length < 10) {
      throw new Error('Valid creator public key required');
    }
    
    if (!Object.values(AcademicCategory).includes(category)) {
      throw new Error('Invalid academic category');
    }
    
    return new Hypothesis(
      id,
      nostrEventId,
      validatedTitle,
      validatedBody,
      category,
      creatorPublicKey,
      createdAt
    );
  }

  /**
   * FACTORY METHOD: From Database Record
   * 
   * Reconstructs domain object from persistence layer data.
   */
  static fromRecord(record: any): Hypothesis {
    return new Hypothesis(
      record.id,
      record.nostrEventId,
      HypothesisTitle.create(record.title),
      HypothesisBody.create(record.body),
      record.category as AcademicCategory,
      record.creatorPublicKey,
      new Date(record.createdAt),
      {
        supporting: record.supportingSourcesCount || 0,
        refuting: record.refutingSourcesCount || 0,
      },
      record.commentsCount || 0
    );
  }

  /**
   * BUSINESS METHOD: Update Source Statistics
   * 
   * Updates the cached counts of supporting and refuting sources.
   * This denormalized data improves query performance for list views.
   */
  updateSourceStats(supporting: number, refuting: number): void {
    if (supporting < 0 || refuting < 0) {
      throw new Error('Source counts cannot be negative');
    }
    
    this.sourceStats = { supporting, refuting };
  }

  /**
   * BUSINESS METHOD: Update Comment Count
   * 
   * Updates the cached count of comments for performance optimization.
   */
  updateCommentCount(count: number): void {
    if (count < 0) {
      throw new Error('Comment count cannot be negative');
    }
    
    this.commentCount = count;
  }

  /**
   * BUSINESS QUERY: Get Evidence Balance
   * 
   * Calculates the balance of evidence supporting vs refuting the hypothesis.
   * Returns a value between -1 (strongly refuted) and 1 (strongly supported).
   */
  getEvidenceBalance(): number {
    const total = this.sourceStats.supporting + this.sourceStats.refuting;
    
    if (total === 0) {
      return 0; // No evidence yet
    }
    
    const supportingRatio = this.sourceStats.supporting / total;
    return (supportingRatio - 0.5) * 2; // Scale to -1 to 1 range
  }

  /**
   * BUSINESS QUERY: Get Engagement Score
   * 
   * Calculates overall engagement based on sources and comments.
   * Useful for ranking and recommendation algorithms.
   */
  getEngagementScore(): number {
    const sourceWeight = 3; // Sources are more valuable than comments
    const commentWeight = 1;
    
    return (
      (this.sourceStats.supporting + this.sourceStats.refuting) * sourceWeight +
      this.commentCount * commentWeight
    );
  }

  /**
   * BUSINESS QUERY: Get Category Metadata
   * 
   * Returns display information for the hypothesis category.
   */
  getCategoryMetadata() {
    return CATEGORY_METADATA[this.category];
  }

  /**
   * BUSINESS QUERY: Is Controversial
   * 
   * Determines if a hypothesis is controversial based on evidence balance.
   * Controversial hypotheses have evidence roughly split between support and refutation.
   */
  isControversial(): boolean {
    const balance = Math.abs(this.getEvidenceBalance());
    const totalSources = this.sourceStats.supporting + this.sourceStats.refuting;
    
    // Controversial if evidence is split and there's sufficient data
    return balance < 0.3 && totalSources >= 10;
  }

  /**
   * BUSINESS QUERY: Needs More Evidence
   * 
   * Determines if a hypothesis would benefit from additional sources.
   */
  needsMoreEvidence(): boolean {
    const totalSources = this.sourceStats.supporting + this.sourceStats.refuting;
    return totalSources < 5;
  }

  // Getters for accessing private state
  get supportingSourcesCount(): number {
    return this.sourceStats.supporting;
  }

  get refutingSourcesCount(): number {
    return this.sourceStats.refuting;
  }

  get commentsCount(): number {
    return this.commentCount;
  }

  /**
   * VALUE OBJECT CONVERSION
   * 
   * Converts domain object to plain object for serialization.
   * Used by the interface adapters layer for API responses.
   */
  toPlainObject() {
    return {
      id: this.id,
      nostrEventId: this.nostrEventId,
      title: this.title.toString(),
      body: this.body.toString(),
      bodySummary: this.body.getSummary(),
      category: this.category,
      categoryMetadata: this.getCategoryMetadata(),
      creatorPublicKey: this.creatorPublicKey,
      createdAt: this.createdAt,
      supportingSourcesCount: this.supportingSourcesCount,
      refutingSourcesCount: this.refutingSourcesCount,
      commentsCount: this.commentsCount,
      evidenceBalance: this.getEvidenceBalance(),
      engagementScore: this.getEngagementScore(),
      isControversial: this.isControversial(),
      needsMoreEvidence: this.needsMoreEvidence(),
    };
  }
}

/**
 * HYPOTHESIS SEARCH CRITERIA VALUE OBJECT
 * 
 * Encapsulates search and filtering logic for hypothesis discovery.
 */
export class HypothesisSearchCriteria {
  constructor(
    public readonly query?: string,
    public readonly category?: AcademicCategory,
    public readonly sortBy: 'recent' | 'discussed' | 'sources' | 'controversial' = 'recent',
    public readonly limit: number = 20,
    public readonly offset: number = 0
  ) {
    if (limit < 1 || limit > 100) {
      throw new Error('Limit must be between 1 and 100');
    }
    
    if (offset < 0) {
      throw new Error('Offset cannot be negative');
    }
  }

  /**
   * BUSINESS METHOD: To Nostr Filters
   * 
   * Converts search criteria to Nostr protocol filters for decentralized querying.
   */
  toNostrFilters() {
    const baseFilter = {
      kinds: [1],
      '#t': ['hypothesis', 'blackpaper'], // Must have both tags to identify our app's events
      limit: this.limit,
      since: Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60), // Last 30 days
    };

    // Add category filter if specified
    if (this.category) {
      return {
        ...baseFilter,
        '#category': [this.category],
      };
    }

    return baseFilter;
  }
}
