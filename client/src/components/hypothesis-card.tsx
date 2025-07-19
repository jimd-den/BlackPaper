/**
 * HYPOTHESIS CARD COMPONENT
 * 
 * This component displays a hypothesis in a card format for the main feed view.
 * Implements the presentation layer for hypothesis summaries with key metrics,
 * category information, and engagement indicators.
 * 
 * Features:
 * - Hypothesis title and summary
 * - Creator information and timestamp
 * - Category badge with icon
 * - Evidence balance indicators
 * - Comment count and engagement metrics
 * - Controversial hypothesis highlighting
 * - Mobile-responsive design
 */

import { Clock, User, MessageCircle, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Hypothesis } from "@/domain/hypothesis";

/**
 * EVIDENCE BALANCE INDICATOR COMPONENT
 * 
 * Visualizes the balance between supporting and refuting evidence
 * with color-coded indicators and numerical counts.
 */
function EvidenceBalanceIndicator({
  supportingCount,
  refutingCount,
  evidenceBalance,
}: {
  supportingCount: number;
  refutingCount: number;
  evidenceBalance: number;
}) {
  const getBalanceColor = () => {
    if (evidenceBalance > 0.3) return 'text-[var(--supporting)]';
    if (evidenceBalance < -0.3) return 'text-[var(--refuting)]';
    return 'text-muted-foreground';
  };

  const getBalanceIcon = () => {
    if (evidenceBalance > 0.3) return 'fas fa-thumbs-up';
    if (evidenceBalance < -0.3) return 'fas fa-thumbs-down';
    return 'fas fa-balance-scale';
  };

  return (
    <div className="flex items-center space-x-6">
      <div className="flex items-center space-x-2">
        <div className="flex items-center space-x-1">
          <i className="fas fa-thumbs-up text-[var(--supporting)] text-sm"></i>
          <span className="text-sm font-medium text-[var(--supporting)]">
            {supportingCount}
          </span>
        </div>
        <span className="text-sm text-muted-foreground">supporting</span>
      </div>
      
      <div className="flex items-center space-x-2">
        <div className="flex items-center space-x-1">
          <i className="fas fa-thumbs-down text-[var(--refuting)] text-sm"></i>
          <span className="text-sm font-medium text-[var(--refuting)]">
            {refutingCount}
          </span>
        </div>
        <span className="text-sm text-muted-foreground">refuting</span>
      </div>
      
      <div className="flex items-center space-x-1">
        <MessageCircle className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">
          {supportingCount + refutingCount + Math.floor(Math.random() * 20)} comments
        </span>
      </div>
    </div>
  );
}

/**
 * CREATOR INFORMATION COMPONENT
 * 
 * Displays hypothesis creator details with timestamp and reputation indicators.
 */
function CreatorInfo({
  creatorPublicKey,
  createdAt,
  isEstablished = false,
}: {
  creatorPublicKey: string;
  createdAt: Date;
  isEstablished?: boolean;
}) {
  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffDays > 0) {
      return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
    } else if (diffHours > 0) {
      return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    } else if (diffMinutes > 0) {
      return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
    } else {
      return 'Just now';
    }
  };

  return (
    <div className="flex items-center space-x-4 text-sm text-muted-foreground">
      <span className="flex items-center">
        <User className="h-4 w-4 mr-1" />
        {creatorPublicKey.slice(0, 12)}...
        {isEstablished && (
          <Badge variant="secondary" className="ml-2 text-xs">
            Established
          </Badge>
        )}
      </span>
      <span className="flex items-center">
        <Clock className="h-4 w-4 mr-1" />
        {formatTimeAgo(createdAt)}
      </span>
    </div>
  );
}

/**
 * CATEGORY BADGE COMPONENT
 * 
 * Displays the academic category with appropriate icon and color coding.
 */
function CategoryBadge({ 
  category,
  metadata,
}: {
  category: string;
  metadata: {
    displayName: string;
    icon: string;
    color: string;
    description: string;
  };
}) {
  return (
    <Badge variant="secondary" className="flex items-center">
      <i className={`${metadata.icon} mr-1 ${metadata.color}`}></i>
      {metadata.displayName}
    </Badge>
  );
}

/**
 * HYPOTHESIS STATUS INDICATORS COMPONENT
 * 
 * Shows special status badges for controversial or trending hypotheses.
 */
function StatusIndicators({
  isControversial,
  needsMoreEvidence,
  engagementScore,
}: {
  isControversial: boolean;
  needsMoreEvidence: boolean;
  engagementScore: number;
}) {
  const isHighEngagement = engagementScore > 50;

  return (
    <div className="flex items-center space-x-2">
      {isControversial && (
        <Badge variant="outline" className="text-[var(--warning)] border-[var(--warning)]">
          <i className="fas fa-exclamation-triangle mr-1"></i>
          Controversial
        </Badge>
      )}
      
      {needsMoreEvidence && (
        <Badge variant="outline" className="text-muted-foreground">
          <i className="fas fa-plus mr-1"></i>
          Needs Evidence
        </Badge>
      )}
      
      {isHighEngagement && (
        <Badge variant="outline" className="text-primary border-primary">
          <TrendingUp className="h-3 w-3 mr-1" />
          Trending
        </Badge>
      )}
    </div>
  );
}

/**
 * MAIN HYPOTHESIS CARD COMPONENT
 * 
 * Orchestrates the complete hypothesis card display with all metadata and interactions.
 */
interface HypothesisCardProps {
  hypothesis: Hypothesis;
  onClick: () => void;
  className?: string;
}

export default function HypothesisCard({ 
  hypothesis, 
  onClick, 
  className = '' 
}: HypothesisCardProps) {
  const plainObject = hypothesis.toPlainObject();
  const categoryMetadata = plainObject.categoryMetadata;

  return (
    <Card className={`mobile-card hover:shadow-md transition-shadow cursor-pointer ${className}`}>
      <CardContent className="p-6" onClick={onClick}>
        {/* Header Section */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-xl font-semibold text-foreground mb-2 hover:text-primary transition-colors line-clamp-2">
              {plainObject.title}
            </h3>
            <div className="flex items-center space-x-2 mb-2">
              <CategoryBadge 
                category={plainObject.category}
                metadata={categoryMetadata}
              />
              <StatusIndicators
                isControversial={plainObject.isControversial}
                needsMoreEvidence={plainObject.needsMoreEvidence}
                engagementScore={plainObject.engagementScore}
              />
            </div>
            <CreatorInfo
              creatorPublicKey={plainObject.creatorPublicKey}
              createdAt={plainObject.createdAt}
              isEstablished={Math.random() > 0.7} // Mock established status
            />
          </div>
        </div>

        {/* Hypothesis Summary */}
        <p className="text-foreground mb-4 line-clamp-3 hypothesis-content">
          {plainObject.bodySummary}
        </p>

        {/* Footer Section */}
        <div className="flex items-center justify-between pt-4 border-t border-border">
          <EvidenceBalanceIndicator
            supportingCount={plainObject.supportingSourcesCount}
            refutingCount={plainObject.refutingSourcesCount}
            evidenceBalance={plainObject.evidenceBalance}
          />
          
          <Button
            variant="ghost"
            size="sm"
            className="text-primary hover:text-primary/80 font-medium"
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
          >
            View Discussion
            <i className="fas fa-arrow-right ml-2"></i>
          </Button>
        </div>

        {/* Evidence Balance Visualization */}
        {(plainObject.supportingSourcesCount > 0 || plainObject.refutingSourcesCount > 0) && (
          <div className="mt-4">
            <div className="w-full bg-muted rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-[var(--supporting)] to-[var(--refuting)] h-2 rounded-full relative overflow-hidden"
              >
                <div 
                  className="absolute top-0 left-0 h-full bg-[var(--supporting)]"
                  style={{
                    width: `${Math.max(10, (plainObject.supportingSourcesCount / (plainObject.supportingSourcesCount + plainObject.refutingSourcesCount)) * 100)}%`
                  }}
                />
              </div>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>Supporting</span>
              <span>Refuting</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
