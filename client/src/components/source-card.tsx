/**
 * SOURCE CARD COMPONENT
 * 
 * This component displays an academic source with voting functionality,
 * credibility indicators, and quality assessment features. Implements
 * the presentation layer for source evidence evaluation.
 * 
 * Features:
 * - Source URL with domain extraction
 * - Description and relevance summary
 * - Voting system with upvote/downvote
 * - Credibility scoring and academic source indicators
 * - Contributor information and timestamp
 * - Quality metrics and controversy indicators
 * - Mobile-responsive design
 */

import { useState } from "react";
import { ExternalLink, Clock, User, Flag, Award, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Source, EvidenceStance } from "@/domain/source";

/**
 * CREDIBILITY INDICATOR COMPONENT
 * 
 * Displays source credibility score with visual indicators and academic badges.
 */
function CredibilityIndicator({ 
  credibilityScore, 
  isAcademicSource,
  domain 
}: { 
  credibilityScore: number;
  isAcademicSource: boolean;
  domain: string;
}) {
  const getCredibilityLevel = () => {
    if (credibilityScore >= 0.8) return { level: 'High', color: 'text-[var(--supporting)]', icon: 'fas fa-shield-check' };
    if (credibilityScore >= 0.6) return { level: 'Medium', color: 'text-[var(--warning)]', icon: 'fas fa-shield-alt' };
    return { level: 'Low', color: 'text-[var(--refuting)]', icon: 'fas fa-shield-exclamation' };
  };

  const credibility = getCredibilityLevel();

  return (
    <div className="flex items-center space-x-2">
      {isAcademicSource && (
        <Tooltip>
          <TooltipTrigger>
            <Badge variant="secondary" className="text-[var(--supporting)]">
              <Award className="h-3 w-3 mr-1" />
              Academic
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>This source is from a recognized academic institution or journal</p>
          </TooltipContent>
        </Tooltip>
      )}
      
      <Tooltip>
        <TooltipTrigger>
          <div className="flex items-center space-x-1">
            <i className={`${credibility.icon} ${credibility.color} text-sm`}></i>
            <span className={`text-sm ${credibility.color}`}>
              {credibility.level}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>Source credibility: {Math.round(credibilityScore * 100)}%</p>
          <p className="text-xs text-muted-foreground">Based on domain authority and type</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

/**
 * VOTING COMPONENT
 * 
 * Implements the voting interface with upvote/downvote buttons and score display.
 */
function VotingControls({
  voteScore,
  userVote,
  onVote,
  isVoting,
  stance,
}: {
  voteScore: number;
  userVote?: number;
  onVote: (voteValue: number) => void;
  isVoting: boolean;
  stance: EvidenceStance;
}) {
  const handleUpvote = () => {
    onVote(userVote === 1 ? 0 : 1); // Toggle upvote
  };

  const handleDownvote = () => {
    onVote(userVote === -1 ? 0 : -1); // Toggle downvote
  };

  const getVoteScoreColor = () => {
    if (voteScore > 0) return 'text-[var(--supporting)]';
    if (voteScore < 0) return 'text-[var(--refuting)]';
    return 'text-muted-foreground';
  };

  return (
    <div className="flex items-center space-x-2">
      <Button
        variant="ghost"
        size="sm"
        className={`p-1 hover:bg-[var(--supporting-light)] ${
          userVote === 1 ? 'text-[var(--supporting)] bg-[var(--supporting-light)]' : 'text-muted-foreground'
        }`}
        onClick={handleUpvote}
        disabled={isVoting}
      >
        <i className="fas fa-arrow-up"></i>
      </Button>
      
      <span className={`text-sm font-medium min-w-[2rem] text-center ${getVoteScoreColor()}`}>
        {voteScore > 0 ? '+' : ''}{voteScore}
      </span>
      
      <Button
        variant="ghost"
        size="sm"
        className={`p-1 hover:bg-[var(--refuting-light)] ${
          userVote === -1 ? 'text-[var(--refuting)] bg-[var(--refuting-light)]' : 'text-muted-foreground'
        }`}
        onClick={handleDownvote}
        disabled={isVoting}
      >
        <i className="fas fa-arrow-down"></i>
      </Button>
    </div>
  );
}

/**
 * SOURCE METADATA COMPONENT
 * 
 * Displays contributor information, timestamp, and quality indicators.
 */
function SourceMetadata({
  contributorPublicKey,
  createdAt,
  qualityScore,
  isHighQuality,
  isControversial,
}: {
  contributorPublicKey: string;
  createdAt: Date;
  qualityScore: number;
  isHighQuality: boolean;
  isControversial: boolean;
}) {
  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return '1 day ago';
    return `${diffDays} days ago`;
  };

  return (
    <div className="flex items-center justify-between text-xs text-muted-foreground">
      <div className="flex items-center space-x-4">
        <span className="flex items-center">
          <User className="h-3 w-3 mr-1" />
          {contributorPublicKey.slice(0, 10)}...
        </span>
        <span className="flex items-center">
          <Clock className="h-3 w-3 mr-1" />
          {formatTimeAgo(createdAt)}
        </span>
      </div>
      
      <div className="flex items-center space-x-2">
        {isHighQuality && (
          <Tooltip>
            <TooltipTrigger>
              <Badge variant="outline" className="text-[var(--supporting)] border-[var(--supporting)]">
                <Award className="h-3 w-3 mr-1" />
                Quality
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>High quality source (score: {qualityScore.toFixed(1)})</p>
            </TooltipContent>
          </Tooltip>
        )}
        
        {isControversial && (
          <Tooltip>
            <TooltipTrigger>
              <Badge variant="outline" className="text-[var(--warning)] border-[var(--warning)]">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Disputed
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>This source has mixed community feedback</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}

/**
 * REPORT BUTTON COMPONENT
 * 
 * Provides functionality to report inappropriate or low-quality sources.
 */
function ReportButton({ sourceId }: { sourceId: string }) {
  const [isReporting, setIsReporting] = useState(false);

  const handleReport = async () => {
    setIsReporting(true);
    // In real implementation, would call reporting service
    setTimeout(() => {
      setIsReporting(false);
      // Show success toast
    }, 1000);
  };

  return (
    <Tooltip>
      <TooltipTrigger>
        <Button
          variant="ghost"
          size="sm"
          className="p-1 text-muted-foreground hover:text-[var(--refuting)]"
          onClick={handleReport}
          disabled={isReporting}
        >
          <Flag className="h-3 w-3" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>Report inappropriate content</p>
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * MAIN SOURCE CARD COMPONENT
 * 
 * Orchestrates the complete source display with all functionality and interactions.
 */
interface SourceCardProps {
  source: Source;
  userVote?: number;
  onVote: (sourceId: string, voteValue: number) => void;
  isVoting?: boolean;
  className?: string;
}

export default function SourceCard({
  source,
  userVote,
  onVote,
  isVoting = false,
  className = '',
}: SourceCardProps) {
  const plainObject = source.toPlainObject();
  
  const stanceConfig = {
    [EvidenceStance.SUPPORTING]: {
      bgClass: 'source-supporting',
      borderClass: 'border-[var(--supporting-border)]',
      iconClass: 'fas fa-thumbs-up text-[var(--supporting)]',
      label: 'Supporting Evidence',
    },
    [EvidenceStance.REFUTING]: {
      bgClass: 'source-refuting',
      borderClass: 'border-[var(--refuting-border)]',
      iconClass: 'fas fa-thumbs-down text-[var(--refuting)]',
      label: 'Refuting Evidence',
    },
  };

  const config = stanceConfig[source.stance];

  const handleVote = (voteValue: number) => {
    onVote(source.id, voteValue);
  };

  const handleUrlClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(source.url.toString(), '_blank', 'noopener,noreferrer');
  };

  return (
    <Card className={`${config.bgClass} ${config.borderClass} ${className}`}>
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-2">
              <i className={config.iconClass}></i>
              <span className="text-sm font-medium text-muted-foreground">
                {config.label}
              </span>
              <CredibilityIndicator
                credibilityScore={plainObject.credibilityScore}
                isAcademicSource={plainObject.isAcademicSource}
                domain={plainObject.domain}
              />
            </div>
            
            <h5 className="font-medium text-foreground mb-2">
              {source.description.toString()}
            </h5>
            
            <button
              onClick={handleUrlClick}
              className="citation-link flex items-center space-x-1 group"
            >
              <span className="break-all">{source.url.toString()}</span>
              <ExternalLink className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
          
          <div className="flex items-center space-x-2 ml-4">
            <VotingControls
              voteScore={plainObject.voteScore}
              userVote={userVote}
              onVote={handleVote}
              isVoting={isVoting}
              stance={source.stance}
            />
            <ReportButton sourceId={source.id} />
          </div>
        </div>

        {/* Footer */}
        <SourceMetadata
          contributorPublicKey={plainObject.contributorPublicKey}
          createdAt={plainObject.createdAt}
          qualityScore={plainObject.qualityScore}
          isHighQuality={plainObject.isHighQuality}
          isControversial={plainObject.isControversial}
        />
      </CardContent>
    </Card>
  );
}
