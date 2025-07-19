/**
 * HYPOTHESIS DETAIL PAGE COMPONENT
 * 
 * This component provides a comprehensive view of a single hypothesis,
 * including its sources, evidence evaluation, and threaded discussions.
 * Implements the detailed academic discourse interface for peer review.
 * 
 * Features:
 * - Full hypothesis display with metadata
 * - Supporting and refuting sources categorization
 * - Community voting on source quality
 * - Threaded comment system
 * - Add source functionality
 * - Mobile-responsive design
 */

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { ArrowLeft, Plus, Flag, ExternalLink, Clock, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useNostr } from "@/hooks/use-nostr";
import NavigationHeader from "@/components/navigation-header";
import SourceCard from "@/components/source-card";
import CommentThread from "@/components/comment-thread";
import AddSourceModal from "@/components/add-source-modal";
import { Hypothesis } from "@/domain/hypothesis";
import { Source, EvidenceStance } from "@/domain/source";
import { Comment } from "@/domain/comment";
import { HypothesisService } from "@/services/hypothesis-service";
import { SourceService } from "@/services/source-service";
import { CommentService } from "@/services/comment-service";

/**
 * HYPOTHESIS HEADER COMPONENT
 * 
 * Displays the main hypothesis information with creator details and metadata.
 */
function HypothesisHeader({ hypothesis }: { hypothesis: Hypothesis }) {
  const categoryMetadata = hypothesis.getCategoryMetadata();
  
  return (
    <Card className="mobile-card">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-2xl font-bold text-foreground mb-3">
              {hypothesis.title.toString()}
            </CardTitle>
            <div className="flex items-center space-x-4 text-sm text-muted-foreground">
              <span className="flex items-center">
                <User className="h-4 w-4 mr-1" />
                {hypothesis.creatorPublicKey.slice(0, 12)}...
              </span>
              <span className="flex items-center">
                <Clock className="h-4 w-4 mr-1" />
                {new Date(hypothesis.createdAt).toLocaleDateString()}
              </span>
              <Badge variant="secondary" className="flex items-center">
                <i className={`${categoryMetadata.icon} mr-1`}></i>
                {categoryMetadata.displayName}
              </Badge>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-foreground mb-3">Hypothesis</h3>
          <p className="text-foreground leading-relaxed hypothesis-content">
            {hypothesis.body.toString()}
          </p>
        </div>
        
        {/* Evidence Summary */}
        <div className="flex items-center justify-between pt-4 border-t border-border">
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-1">
                <i className="fas fa-thumbs-up text-[var(--supporting)] text-sm"></i>
                <span className="text-sm font-medium text-[var(--supporting)]">
                  {hypothesis.supportingSourcesCount}
                </span>
              </div>
              <span className="text-sm text-muted-foreground">supporting</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-1">
                <i className="fas fa-thumbs-down text-[var(--refuting)] text-sm"></i>
                <span className="text-sm font-medium text-[var(--refuting)]">
                  {hypothesis.refutingSourcesCount}
                </span>
              </div>
              <span className="text-sm text-muted-foreground">refuting</span>
            </div>
            <div className="flex items-center space-x-1">
              <i className="fas fa-comments text-muted-foreground text-sm"></i>
              <span className="text-sm text-muted-foreground">
                {hypothesis.commentsCount} comments
              </span>
            </div>
          </div>
          
          {hypothesis.isControversial() && (
            <Badge variant="outline" className="text-warning border-warning">
              <i className="fas fa-exclamation-triangle mr-1"></i>
              Controversial
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * SOURCES SECTION COMPONENT
 * 
 * Displays categorized sources with voting functionality and add source button.
 */
function SourcesSection({ 
  hypothesisId, 
  onAddSource 
}: { 
  hypothesisId: string;
  onAddSource: () => void;
}) {
  const { user, isSignedIn } = useNostr();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: sources, isLoading } = useQuery({
    queryKey: ['/api/sources', hypothesisId],
    queryFn: () => SourceService.getSourcesForHypothesis(hypothesisId),
  });

  const voteMutation = useMutation({
    mutationFn: ({ sourceId, voteValue }: { sourceId: string; voteValue: number }) => 
      SourceService.voteOnSource(sourceId, voteValue),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sources', hypothesisId] });
      toast({
        title: "Vote Recorded",
        description: "Your vote has been recorded successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Vote Failed",
        description: "Failed to record your vote. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleVote = (sourceId: string, voteValue: number) => {
    if (!isSignedIn) {
      toast({
        title: "Sign In Required",
        description: "Please connect to Nostr to vote on sources.",
        variant: "destructive",
      });
      return;
    }
    
    voteMutation.mutate({ sourceId, voteValue });
  };

  if (isLoading) {
    return (
      <Card className="mobile-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Sources & Evidence</CardTitle>
            <Skeleton className="h-9 w-24" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const supportingSources = sources?.filter(s => s.stance === EvidenceStance.SUPPORTING) || [];
  const refutingSources = sources?.filter(s => s.stance === EvidenceStance.REFUTING) || [];

  return (
    <Card className="mobile-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Sources & Evidence</CardTitle>
          <Button onClick={onAddSource}>
            <Plus className="h-4 w-4 mr-2" />
            Add Source
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="supporting" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="supporting" className="text-[var(--supporting)]">
              <i className="fas fa-thumbs-up mr-2"></i>
              Supporting ({supportingSources.length})
            </TabsTrigger>
            <TabsTrigger value="refuting" className="text-[var(--refuting)]">
              <i className="fas fa-thumbs-down mr-2"></i>
              Refuting ({refutingSources.length})
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="supporting" className="mt-6">
            {supportingSources.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <i className="fas fa-plus-circle text-2xl mb-2"></i>
                <p>No supporting sources yet.</p>
                <p className="text-sm">Be the first to add evidence supporting this hypothesis.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {supportingSources.map((source) => (
                  <SourceCard
                    key={source.id}
                    source={source}
                    userVote={user ? source.getUserVote(user.publicKey) : undefined}
                    onVote={handleVote}
                    isVoting={voteMutation.isPending}
                  />
                ))}
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="refuting" className="mt-6">
            {refutingSources.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <i className="fas fa-plus-circle text-2xl mb-2"></i>
                <p>No refuting sources yet.</p>
                <p className="text-sm">Be the first to add evidence refuting this hypothesis.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {refutingSources.map((source) => (
                  <SourceCard
                    key={source.id}
                    source={source}
                    userVote={user ? source.getUserVote(user.publicKey) : undefined}
                    onVote={handleVote}
                    isVoting={voteMutation.isPending}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

/**
 * COMMENTS SECTION COMPONENT
 * 
 * Displays threaded comments with add comment functionality.
 */
function CommentsSection({ hypothesisId }: { hypothesisId: string }) {
  const [newComment, setNewComment] = useState('');
  const { user, isSignedIn } = useNostr();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: comments, isLoading } = useQuery({
    queryKey: ['/api/comments', hypothesisId],
    queryFn: () => CommentService.getCommentsForHypothesis(hypothesisId),
  });

  const addCommentMutation = useMutation({
    mutationFn: (content: string) => 
      CommentService.addComment(hypothesisId, 'hypothesis', content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/comments', hypothesisId] });
      setNewComment('');
      toast({
        title: "Comment Added",
        description: "Your comment has been added successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Comment Failed",
        description: "Failed to add your comment. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmitComment = () => {
    if (!isSignedIn) {
      toast({
        title: "Sign In Required",
        description: "Please connect to Nostr to add comments.",
        variant: "destructive",
      });
      return;
    }

    if (newComment.trim().length < 3) {
      toast({
        title: "Comment Too Short",
        description: "Comments must be at least 3 characters long.",
        variant: "destructive",
      });
      return;
    }

    addCommentMutation.mutate(newComment.trim());
  };

  return (
    <Card className="mobile-card">
      <CardHeader>
        <CardTitle>Discussion ({comments?.length || 0} comments)</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Add Comment */}
        <div className="bg-muted rounded-lg p-4 mb-6">
          <Textarea
            placeholder="Add your comment to the discussion..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            className="resize-none focus:ring-2 focus:ring-primary focus:border-transparent"
            rows={3}
          />
          <div className="flex justify-end mt-3">
            <Button 
              onClick={handleSubmitComment}
              disabled={addCommentMutation.isPending || newComment.trim().length < 3}
            >
              {addCommentMutation.isPending ? 'Posting...' : 'Post Comment'}
            </Button>
          </div>
        </div>

        {/* Comments Thread */}
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : comments && comments.length > 0 ? (
          <CommentThread 
            comments={comments}
            hypothesisId={hypothesisId}
          />
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <i className="fas fa-comments text-2xl mb-2"></i>
            <p>No comments yet.</p>
            <p className="text-sm">Start the discussion by adding the first comment.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * MAIN HYPOTHESIS DETAIL COMPONENT
 * 
 * Orchestrates the complete hypothesis detail view with navigation and modals.
 */
export default function HypothesisDetail() {
  const [, params] = useRoute('/hypothesis/:id');
  const hypothesisId = params?.id;
  
  const [showAddSourceModal, setShowAddSourceModal] = useState(false);
  const { toast } = useToast();

  const { data: hypothesis, isLoading, error } = useQuery({
    queryKey: ['/api/hypothesis', hypothesisId],
    queryFn: () => HypothesisService.getHypothesis(hypothesisId!),
    enabled: !!hypothesisId,
  });

  useEffect(() => {
    if (!hypothesisId) {
      toast({
        title: "Invalid Hypothesis",
        description: "Hypothesis ID is required.",
        variant: "destructive",
      });
      // Navigate back to home
      window.location.href = '/';
    }
  }, [hypothesisId, toast]);

  const handleAddSource = () => {
    setShowAddSourceModal(true);
  };

  const handleGoBack = () => {
    window.history.back();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <NavigationHeader />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="space-y-6">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-96 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !hypothesis) {
    return (
      <div className="min-h-screen bg-background">
        <NavigationHeader />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Card className="mobile-card">
            <CardContent className="p-6 text-center">
              <div className="text-destructive mb-2">
                <i className="fas fa-exclamation-triangle text-2xl"></i>
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Hypothesis Not Found
              </h3>
              <p className="text-muted-foreground mb-4">
                The hypothesis you're looking for doesn't exist or couldn't be loaded.
              </p>
              <Button onClick={handleGoBack}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Go Back
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <NavigationHeader />
      
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={handleGoBack}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <div className="space-y-6">
          {/* Hypothesis Header */}
          <HypothesisHeader hypothesis={hypothesis} />

          {/* Sources Section */}
          <SourcesSection
            hypothesisId={hypothesisId!}
            onAddSource={handleAddSource}
          />

          {/* Comments Section */}
          <CommentsSection hypothesisId={hypothesisId!} />
        </div>
      </div>

      {/* Modals */}
      <AddSourceModal
        isOpen={showAddSourceModal}
        onClose={() => setShowAddSourceModal(false)}
        hypothesisId={hypothesisId!}
      />
    </div>
  );
}
