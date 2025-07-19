/**
 * SOURCE DOMAIN MODEL
 * 
 * This module defines the domain logic for academic sources that provide evidence
 * for or against hypotheses. Sources represent the empirical foundation of our
 * evidence-based evaluation system.
 * 
 * Enterprise Layer: These domain objects encapsulate the business rules for
 * academic citation, evidence evaluation, and quality assessment.
 */

/**
 * SOURCE URL VALUE OBJECT
 * 
 * Represents a validated URL pointing to academic or authoritative content.
 * Encapsulates URL validation and normalization business rules.
 */
export class SourceUrl {
  private constructor(private readonly value: string) {}

  /**
   * FACTORY METHOD: Create URL
   * 
   * Business Rule: Sources must point to accessible, authoritative content
   * from reputable academic or journalistic sources.
   */
  static create(url: string): SourceUrl {
    const trimmed = url.trim();
    
    if (!trimmed) {
      throw new Error('Source URL cannot be empty');
    }
    
    // Basic URL format validation
    try {
      new URL(trimmed);
    } catch {
      throw new Error('Source URL must be a valid web address');
    }
    
    const urlObj = new URL(trimmed);
    
    // Business rule: Only allow HTTPS for security
    if (urlObj.protocol !== 'https:') {
      throw new Error('Source URLs must use HTTPS for security');
    }
    
    // Business rule: Block known unreliable domains
    const blockedDomains = [
      'example.com',
      'test.com',
      'localhost',
    ];
    
    if (blockedDomains.some(domain => urlObj.hostname.includes(domain))) {
      throw new Error('Source URL points to an unreliable domain');
    }
    
    return new SourceUrl(trimmed);
  }

  toString(): string {
    return this.value;
  }

  /**
   * BUSINESS METHOD: Get Domain
   * 
   * Extracts the domain for display and credibility assessment.
   */
  getDomain(): string {
    return new URL(this.value).hostname;
  }

  /**
   * BUSINESS METHOD: Is Academic Source
   * 
   * Determines if the URL points to a recognized academic institution or journal.
   */
  isAcademicSource(): boolean {
    const domain = this.getDomain().toLowerCase();
    
    const academicIndicators = [
      '.edu',
      'arxiv.org',
      'pubmed.ncbi.nlm.nih.gov',
      'doi.org',
      'jstor.org',
      'springer.com',
      'nature.com',
      'science.org',
      'ieee.org',
    ];
    
    return academicIndicators.some(indicator => domain.includes(indicator));
  }

  /**
   * BUSINESS METHOD: Get Credibility Score
   * 
   * Assigns a credibility score based on domain authority and type.
   */
  getCredibilityScore(): number {
    const domain = this.getDomain().toLowerCase();
    
    // Academic sources get highest credibility
    if (this.isAcademicSource()) {
      return 1.0;
    }
    
    // Reputable news and government sources
    const highCredibilitySources = [
      'reuters.com',
      'apnews.com',
      'bbc.com',
      'gov', // government domains
      'who.int',
      'cdc.gov',
      'nasa.gov',
    ];
    
    if (highCredibilitySources.some(source => domain.includes(source))) {
      return 0.8;
    }
    
    // General news and media
    const mediumCredibilitySources = [
      'nytimes.com',
      'washingtonpost.com',
      'economist.com',
      'guardian.com',
    ];
    
    if (mediumCredibilitySources.some(source => domain.includes(source))) {
      return 0.6;
    }
    
    // Default for other sources
    return 0.4;
  }

  equals(other: SourceUrl): boolean {
    return this.value === other.value;
  }
}

/**
 * SOURCE DESCRIPTION VALUE OBJECT
 * 
 * Represents the summary and relevance explanation for an academic source.
 * Enforces quality standards for source descriptions.
 */
export class SourceDescription {
  private constructor(private readonly value: string) {}

  /**
   * FACTORY METHOD: Create Description
   * 
   * Business Rule: Source descriptions must clearly explain relevance
   * and provide sufficient context for evaluation.
   */
  static create(description: string): SourceDescription {
    const trimmed = description.trim();
    
    if (trimmed.length < 20) {
      throw new Error('Source description must be at least 20 characters to provide adequate context');
    }
    
    if (trimmed.length > 512) {
      throw new Error('Source description must not exceed 512 characters for readability');
    }
    
    // Quality check: ensure meaningful content
    const wordCount = trimmed.split(/\s+/).length;
    if (wordCount < 5) {
      throw new Error('Source description must contain at least 5 words');
    }
    
    return new SourceDescription(trimmed);
  }

  toString(): string {
    return this.value;
  }

  /**
   * BUSINESS METHOD: Get Word Count
   * 
   * Returns word count for quality assessment.
   */
  getWordCount(): number {
    return this.value.split(/\s+/).length;
  }
}

/**
 * EVIDENCE STANCE ENUMERATION
 * 
 * Defines whether a source supports or refutes the hypothesis.
 * This binary classification simplifies evidence evaluation.
 */
export enum EvidenceStance {
  SUPPORTING = 'supporting',
  REFUTING = 'refuting',
}

/**
 * VOTE VALUE OBJECT
 * 
 * Represents a community vote on source quality and relevance.
 * Encapsulates voting business rules and validation.
 */
export class Vote {
  private constructor(
    public readonly value: number,
    public readonly voterPublicKey: string,
    public readonly createdAt: Date
  ) {}

  /**
   * FACTORY METHOD: Create Vote
   * 
   * Business Rule: Votes must be either +1 (upvote) or -1 (downvote).
   */
  static create(
    value: number,
    voterPublicKey: string,
    createdAt: Date = new Date()
  ): Vote {
    if (value !== 1 && value !== -1) {
      throw new Error('Vote value must be +1 (upvote) or -1 (downvote)');
    }
    
    if (!voterPublicKey || voterPublicKey.length < 10) {
      throw new Error('Valid voter public key required');
    }
    
    return new Vote(value, voterPublicKey, createdAt);
  }

  isUpvote(): boolean {
    return this.value === 1;
  }

  isDownvote(): boolean {
    return this.value === -1;
  }
}

/**
 * SOURCE AGGREGATE ROOT
 * 
 * Represents an academic source with its associated evidence and community assessment.
 * Central entity for the source evaluation subdomain.
 */
export class Source {
  private votes: Map<string, Vote> = new Map();

  private constructor(
    public readonly id: string,
    public readonly nostrEventId: string,
    public readonly hypothesisId: string,
    public readonly url: SourceUrl,
    public readonly description: SourceDescription,
    public readonly stance: EvidenceStance,
    public readonly contributorPublicKey: string,
    public readonly createdAt: Date
  ) {}

  /**
   * FACTORY METHOD: Create New Source
   * 
   * Creates a new source with validation of all business rules.
   */
  static create(
    id: string,
    nostrEventId: string,
    hypothesisId: string,
    url: string,
    description: string,
    stance: EvidenceStance,
    contributorPublicKey: string,
    createdAt: Date = new Date()
  ): Source {
    const validatedUrl = SourceUrl.create(url);
    const validatedDescription = SourceDescription.create(description);
    
    if (!hypothesisId) {
      throw new Error('Hypothesis ID is required');
    }
    
    if (!contributorPublicKey || contributorPublicKey.length < 10) {
      throw new Error('Valid contributor public key required');
    }
    
    if (!Object.values(EvidenceStance).includes(stance)) {
      throw new Error('Invalid evidence stance');
    }
    
    return new Source(
      id,
      nostrEventId,
      hypothesisId,
      validatedUrl,
      validatedDescription,
      stance,
      contributorPublicKey,
      createdAt
    );
  }

  /**
   * FACTORY METHOD: From Database Record
   * 
   * Reconstructs domain object from persistence layer data.
   */
  static fromRecord(record: any): Source {
    const source = new Source(
      record.id,
      record.nostrEventId,
      record.hypothesisId,
      SourceUrl.create(record.url),
      SourceDescription.create(record.description),
      record.stance as EvidenceStance,
      record.contributorPublicKey,
      new Date(record.createdAt)
    );

    // Restore votes if provided
    if (record.votes) {
      record.votes.forEach((voteData: any) => {
        const vote = Vote.create(
          voteData.value,
          voteData.voterPublicKey,
          new Date(voteData.createdAt)
        );
        source.votes.set(voteData.voterPublicKey, vote);
      });
    }

    return source;
  }

  /**
   * BUSINESS METHOD: Add Vote
   * 
   * Adds or updates a vote from a community member.
   * Business Rule: One vote per user, latest vote overwrites previous.
   */
  addVote(voterPublicKey: string, value: number): void {
    const vote = Vote.create(value, voterPublicKey);
    this.votes.set(voterPublicKey, vote);
  }

  /**
   * BUSINESS METHOD: Remove Vote
   * 
   * Removes a user's vote (equivalent to abstaining).
   */
  removeVote(voterPublicKey: string): void {
    this.votes.delete(voterPublicKey);
  }

  /**
   * BUSINESS QUERY: Get Vote Score
   * 
   * Calculates the net vote score (upvotes - downvotes).
   */
  getVoteScore(): number {
    let score = 0;
    for (const vote of this.votes.values()) {
      score += vote.value;
    }
    return score;
  }

  /**
   * BUSINESS QUERY: Get User Vote
   * 
   * Returns the current user's vote value, or undefined if not voted.
   */
  getUserVote(userPublicKey: string): number | undefined {
    const vote = this.votes.get(userPublicKey);
    return vote?.value;
  }

  /**
   * BUSINESS QUERY: Get Vote Count
   * 
   * Returns total number of votes (both up and down).
   */
  getTotalVotes(): number {
    return this.votes.size;
  }

  /**
   * BUSINESS QUERY: Get Quality Score
   * 
   * Calculates overall quality score based on votes and source credibility.
   */
  getQualityScore(): number {
    const voteScore = this.getVoteScore();
    const credibilityScore = this.url.getCredibilityScore();
    const descriptionQuality = Math.min(this.description.getWordCount() / 20, 1); // Max 1.0
    
    // Weighted combination: 50% votes, 30% credibility, 20% description
    return (
      voteScore * 0.5 +
      credibilityScore * 3 * 0.3 + // Scale credibility to similar range as votes
      descriptionQuality * 2 * 0.2
    );
  }

  /**
   * BUSINESS QUERY: Is High Quality
   * 
   * Determines if source meets quality thresholds for prominence.
   */
  isHighQuality(): boolean {
    return this.getQualityScore() > 2 && this.getTotalVotes() >= 3;
  }

  /**
   * BUSINESS QUERY: Is Controversial
   * 
   * Determines if source has significant disagreement in voting.
   */
  isControversial(): boolean {
    if (this.getTotalVotes() < 5) {
      return false; // Need sufficient votes to determine controversy
    }
    
    let upvotes = 0;
    let downvotes = 0;
    
    for (const vote of this.votes.values()) {
      if (vote.isUpvote()) {
        upvotes++;
      } else {
        downvotes++;
      }
    }
    
    const ratio = Math.min(upvotes, downvotes) / Math.max(upvotes, downvotes);
    return ratio > 0.6; // Votes are roughly split
  }

  /**
   * BUSINESS QUERY: Is Supporting
   * 
   * Convenience method to check if source supports the hypothesis.
   */
  isSupporting(): boolean {
    return this.stance === EvidenceStance.SUPPORTING;
  }

  /**
   * BUSINESS QUERY: Is Refuting
   * 
   * Convenience method to check if source refutes the hypothesis.
   */
  isRefuting(): boolean {
    return this.stance === EvidenceStance.REFUTING;
  }

  /**
   * VALUE OBJECT CONVERSION
   * 
   * Converts domain object to plain object for serialization.
   */
  toPlainObject() {
    return {
      id: this.id,
      nostrEventId: this.nostrEventId,
      hypothesisId: this.hypothesisId,
      url: this.url.toString(),
      domain: this.url.getDomain(),
      isAcademicSource: this.url.isAcademicSource(),
      credibilityScore: this.url.getCredibilityScore(),
      description: this.description.toString(),
      descriptionWordCount: this.description.getWordCount(),
      stance: this.stance,
      contributorPublicKey: this.contributorPublicKey,
      createdAt: this.createdAt,
      voteScore: this.getVoteScore(),
      totalVotes: this.getTotalVotes(),
      qualityScore: this.getQualityScore(),
      isHighQuality: this.isHighQuality(),
      isControversial: this.isControversial(),
      isSupporting: this.isSupporting(),
      isRefuting: this.isRefuting(),
    };
  }
}

/**
 * SOURCE FILTER CRITERIA VALUE OBJECT
 * 
 * Encapsulates filtering and sorting logic for source discovery.
 */
export class SourceFilterCriteria {
  constructor(
    public readonly hypothesisId: string,
    public readonly stance?: EvidenceStance,
    public readonly sortBy: 'quality' | 'recent' | 'votes' = 'quality',
    public readonly minQualityScore?: number,
    public readonly limit: number = 50
  ) {
    if (!hypothesisId) {
      throw new Error('Hypothesis ID is required for source filtering');
    }
    
    if (limit < 1 || limit > 100) {
      throw new Error('Limit must be between 1 and 100');
    }
  }
}
