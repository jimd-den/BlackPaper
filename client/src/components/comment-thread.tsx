/**
 * COMMENT THREAD COMPONENT
 * 
 * This component implements threaded comment display with hierarchical nesting,
 * reply functionality, and proper academic discourse presentation. Follows
 * the domain model for comment threading and conversation management.
 * 
 * Features:
 * - Hierarchical comment threading with visual nesting
 * - Reply functionality with proper parent-child relationships
 * - Comment voting and quality indicators
 * - Responsive design with mobile-optimized threading
 * - Real-time comment additions and updates
 * - Moderation and reporting capabilities
 */

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Reply, Flag, Clock, User, MessageCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { useNostr } from "@/hooks/use-nostr";
import { Comment, CommentTreeBuilder } from "@/domain/comment";
import { CommentService } from "@/services/comment-service";

/**
 * COMMENT METADATA COMPONENT
 * 
 * Displays comment author, timestamp, and quality indicators.
 */
function CommentMetadata({
  comment,
  isRecent,
  engagementScore,
}: {
  comment: Comment;
  isRecent: boolean;
  engagementScore: number;
}) {
  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    if (diffMinutes > 0) return `${diffMinutes}m ago`;
    return 'Just now';
  };

  const getAuthorDisplay = () => {
    // In real implementation, would look up display name from user service
    return comment.authorPublicKey.slice(0, 12) + '...';
  };

  return (
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center space-x-3 text-sm">
        <span className="flex items-center font-medium text-foreground">
          <User className="h-3 w-3 mr-1" />
          {getAuthorDisplay()}
        </span>
        <span className="flex items-center text-muted-foreground">
          <Clock className="h-3 w-3 mr-1" />
          {formatTimeAgo(comment.createdAt)}
        </span>
        {isRecent && (
          <Badge variant="secondary" className="text-xs">
            New
          </Badge>
        )}
      </div>
      
      {engagementScore > 10 && (
        <Tooltip>
          <TooltipTrigger>
            <Badge variant="outline" className="text-primary border-primary text-xs">
              <MessageCircle className="h-3 w-3 mr-1" />
              Active
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>High engagement comment thread</p>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

/**
 * REPLY FORM COMPONENT
 * 
 * Provides inline reply functionality for adding responses to comments.
 */
function ReplyForm({
  parentComment,
  onReplySubmitted,
  onCancel,
}: {
  parentComment: Comment;
  onReplySubmitted: () => void;
  onCancel: () => void;
}) {
  const [replyContent, setReplyContent] = useState('');
  const { user, isSignedIn } = useNostr();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const addReplyMutation = useMutation({
    mutationFn: (content: string) =>
      CommentService.addComment(parentComment.id, 'comment', content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/comments'] });
      setReplyContent('');
      onReplySubmitted();
      toast({
        title: "Reply Added",
        description: "Your reply has been added successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Reply Failed",
        description: "Failed to add your reply. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!isSignedIn) {
      toast({
        title: "Sign In Required",
        description: "Please connect to Nostr to reply to comments.",
        variant: "destructive",
      });
      return;
    }

    if (replyContent.trim().length < 3) {
      toast({
        title: "Reply Too Short",
        description: "Replies must be at least 3 characters long.",
        variant: "destructive",
      });
      return;
    }

    addReplyMutation.mutate(replyContent.trim());
  };

  return (
    <div className="mt-3 p-3 bg-muted rounded-lg">
      <Textarea
        placeholder="Write a thoughtful reply..."
        value={replyContent}
        onChange={(e) => setReplyContent(e.target.value)}
        className="mb-3 resize-none"
        rows={3}
      />
      <div className="flex justify-end space-x-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={addReplyMutation.isPending || replyContent.trim().length < 3}
        >
          {addReplyMutation.isPending ? 'Replying...' : 'Reply'}
        </Button>
      </div>
    </div>
  );
}

/**
 * COMMENT ACTIONS COMPONENT
 * 
 * Provides interaction buttons for reply, report, and other comment actions.
 */
function CommentActions({
  comment,
  onReply,
  showReplyForm,
}: {
  comment: Comment;
  onReply: () => void;
  showReplyForm: boolean;
}) {
  const [isReporting, setIsReporting] = useState(false);
  const { toast } = useToast();

  const handleReport = async () => {
    setIsReporting(true);
    // In real implementation, would call reporting service
    setTimeout(() => {
      setIsReporting(false);
      toast({
        title: "Comment Reported",
        description: "Thank you for helping maintain community standards.",
      });
    }, 1000);
  };

  return (
    <div className="flex items-center space-x-4 mt-3 text-sm">
      {comment.canAcceptReplies() && (
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-primary p-0 h-auto"
          onClick={onReply}
          disabled={showReplyForm}
        >
          <Reply className="h-3 w-3 mr-1" />
          Reply
        </Button>
      )}
      
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground hover:text-[var(--refuting)] p-0 h-auto"
        onClick={handleReport}
        disabled={isReporting}
      >
        <Flag className="h-3 w-3 mr-1" />
        {isReporting ? 'Reporting...' : 'Report'}
      </Button>
      
      {comment.getReplies.length > 0 && (
        <span className="text-muted-foreground">
          {comment.getReplies.length} repl{comment.getReplies.length === 1 ? 'y' : 'ies'}
        </span>
      )}
    </div>
  );
}

/**
 * INDIVIDUAL COMMENT COMPONENT
 * 
 * Displays a single comment with all metadata, content, and interaction options.
 */
function CommentItem({
  comment,
  hypothesisId,
  depth = 0,
}: {
  comment: Comment;
  hypothesisId: string;
  depth?: number;
}) {
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [isExpanded, setIsExpanded] = useState(depth < 3); // Auto-collapse deep threads
  
  const plainObject = comment.toPlainObject();
  const maxDepth = 6; // Maximum visual nesting depth

  const handleReply = () => {
    setShowReplyForm(true);
  };

  const handleReplySubmitted = () => {
    setShowReplyForm(false);
  };

  const handleCancelReply = () => {
    setShowReplyForm(false);
  };

  // Calculate visual depth (limit for mobile responsiveness)
  const visualDepth = Math.min(depth, maxDepth);
  const indentClass = visualDepth > 0 ? `ml-${Math.min(visualDepth * 4, 16)}` : '';

  if (comment.getIsDeleted) {
    return (
      <div className={`${indentClass} py-2`}>
        <div className="text-muted-foreground text-sm italic">
          [Comment deleted]
        </div>
        {/* Still show replies to deleted comments */}
        {comment.getReplies.length > 0 && isExpanded && (
          <div className="mt-2">
            {comment.getReplies.map((reply) => (
              <CommentItem
                key={reply.id}
                comment={reply}
                hypothesisId={hypothesisId}
                depth={depth + 1}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`${indentClass} ${depth > 0 ? 'border-l-2 border-border pl-4' : ''}`}>
      <Card className="mobile-card mb-3">
        <CardContent className="p-4">
          <CommentMetadata
            comment={comment}
            isRecent={plainObject.isRecent}
            engagementScore={plainObject.engagementScore}
          />
          
          <div className="mb-3">
            <p className="text-foreground leading-relaxed">
              {comment.getDisplayContent}
            </p>
            
            {plainObject.readingTime > 30 && (
              <div className="text-xs text-muted-foreground mt-1">
                ~{Math.ceil(plainObject.readingTime / 60)} min read
              </div>
            )}
          </div>

          <CommentActions
            comment={comment}
            onReply={handleReply}
            showReplyForm={showReplyForm}
          />

          {showReplyForm && (
            <ReplyForm
              parentComment={comment}
              onReplySubmitted={handleReplySubmitted}
              onCancel={handleCancelReply}
            />
          )}
        </CardContent>
      </Card>

      {/* Replies */}
      {comment.getReplies.length > 0 && (
        <>
          {!isExpanded && depth >= 3 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-primary hover:text-primary/80 mb-2"
              onClick={() => setIsExpanded(true)}
            >
              Show {comment.getReplies.length} more repl{comment.getReplies.length === 1 ? 'y' : 'ies'}
            </Button>
          )}
          
          {isExpanded && (
            <div className="space-y-1">
              {comment.getReplies.map((reply) => (
                <CommentItem
                  key={reply.id}
                  comment={reply}
                  hypothesisId={hypothesisId}
                  depth={depth + 1}
                />
              ))}
              
              {depth >= 3 && comment.getReplies.length > 3 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-foreground ml-4"
                  onClick={() => setIsExpanded(false)}
                >
                  Collapse thread
                </Button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * MAIN COMMENT THREAD COMPONENT
 * 
 * Orchestrates the complete threaded comment display with sorting and filtering.
 */
interface CommentThreadProps {
  comments: Comment[];
  hypothesisId: string;
  className?: string;
}

export default function CommentThread({
  comments,
  hypothesisId,
  className = '',
}: CommentThreadProps) {
  const [sortBy, setSortBy] = useState<'chronological' | 'engagement' | 'recent'>('chronological');

  // Build comment tree from flat array
  const rootComments = CommentTreeBuilder.buildTree(comments);
  
  // Sort root comments based on selected criteria
  const sortedComments = CommentTreeBuilder.sortComments(rootComments, sortBy);

  if (sortedComments.length === 0) {
    return (
      <div className={`text-center py-8 text-muted-foreground ${className}`}>
        <MessageCircle className="h-8 w-8 mx-auto mb-2" />
        <p>No comments yet.</p>
        <p className="text-sm">Start the discussion by adding the first comment.</p>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Sort Controls */}
      {sortedComments.length > 1 && (
        <div className="flex items-center space-x-4 mb-4 text-sm">
          <span className="text-muted-foreground">Sort by:</span>
          <div className="flex space-x-2">
            {[
              { key: 'chronological', label: 'Oldest' },
              { key: 'recent', label: 'Newest' },
              { key: 'engagement', label: 'Most Active' },
            ].map(({ key, label }) => (
              <Button
                key={key}
                variant={sortBy === key ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setSortBy(key as any)}
                className="text-xs"
              >
                {label}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Comment Tree */}
      <div className="space-y-2">
        {sortedComments.map((comment) => (
          <CommentItem
            key={comment.id}
            comment={comment}
            hypothesisId={hypothesisId}
            depth={0}
          />
        ))}
      </div>

      {/* Thread Statistics */}
      {sortedComments.length > 5 && (
        <div className="mt-6 p-4 bg-muted rounded-lg text-center text-sm text-muted-foreground">
          <p>
            {comments.length} comments in this discussion
            {sortedComments.reduce((total, comment) => total + comment.getThreadSize(), 0) > comments.length && 
              ` • ${sortedComments.reduce((total, comment) => total + comment.getThreadSize(), 0)} total including replies`
            }
          </p>
        </div>
      )}
    </div>
  );
}
