/**
 * ADD SOURCE MODAL COMPONENT
 * 
 * This component provides a modal interface for adding academic sources to hypotheses.
 * Implements comprehensive validation, URL verification, and stance selection with
 * proper integration to the Nostr protocol for decentralized publication.
 * 
 * Features:
 * - URL validation and domain credibility assessment
 * - Stance selection (supporting/refuting) with guidance
 * - Description quality validation
 * - Real-time preview of source appearance
 * - Academic source detection and highlighting
 * - Error handling and user feedback
 * - Mobile-responsive design
 */

import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, ExternalLink, Plus, AlertCircle, Award, Link as LinkIcon } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { useNostr } from "@/hooks/use-nostr";
import { EvidenceStance } from "@/domain/source";
import { SourceService } from "@/services/source-service";

/**
 * FORM VALIDATION SCHEMA
 * 
 * Defines validation rules based on domain business rules for source addition.
 */
const addSourceSchema = z.object({
  url: z
    .string()
    .url("Please enter a valid URL")
    .refine(
      (url) => url.startsWith("https://"),
      "URLs must use HTTPS for security"
    ),
  description: z
    .string()
    .min(20, "Description must be at least 20 characters for adequate context")
    .max(512, "Description must not exceed 512 characters")
    .refine(
      (desc) => desc.trim().split(/\s+/).length >= 5,
      "Description must contain at least 5 words"
    ),
  stance: z.nativeEnum(EvidenceStance, {
    required_error: "Please select whether this source supports or refutes the hypothesis",
  }),
});

type AddSourceForm = z.infer<typeof addSourceSchema>;

/**
 * URL ANALYZER COMPONENT
 * 
 * Analyzes provided URLs for credibility, domain authority, and academic indicators.
 */
function UrlAnalyzer({ url }: { url: string }) {
  const [analysis, setAnalysis] = useState<{
    domain: string;
    isAcademic: boolean;
    credibilityScore: number;
    isValid: boolean;
  } | null>(null);

  useEffect(() => {
    if (!url || !url.startsWith('https://')) {
      setAnalysis(null);
      return;
    }

    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname.toLowerCase();
      
      // Academic source detection
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
      
      const isAcademic = academicIndicators.some(indicator => domain.includes(indicator));
      
      // Credibility scoring
      let credibilityScore = 0.4; // Base score
      
      if (isAcademic) {
        credibilityScore = 1.0;
      } else {
        const highCredibility = [
          'reuters.com',
          'apnews.com',
          'bbc.com',
          '.gov',
          'who.int',
          'cdc.gov',
          'nasa.gov',
        ];
        
        const mediumCredibility = [
          'nytimes.com',
          'washingtonpost.com',
          'economist.com',
          'guardian.com',
        ];
        
        if (highCredibility.some(source => domain.includes(source))) {
          credibilityScore = 0.8;
        } else if (mediumCredibility.some(source => domain.includes(source))) {
          credibilityScore = 0.6;
        }
      }
      
      setAnalysis({
        domain,
        isAcademic,
        credibilityScore,
        isValid: true,
      });
    } catch {
      setAnalysis({
        domain: 'Invalid URL',
        isAcademic: false,
        credibilityScore: 0,
        isValid: false,
      });
    }
  }, [url]);

  if (!analysis) return null;

  const getCredibilityLevel = () => {
    if (analysis.credibilityScore >= 0.8) return { level: 'High', color: 'text-[var(--supporting)]' };
    if (analysis.credibilityScore >= 0.6) return { level: 'Medium', color: 'text-[var(--warning)]' };
    return { level: 'Low', color: 'text-[var(--refuting)]' };
  };

  const credibility = getCredibilityLevel();

  return (
    <Card className="bg-muted/50">
      <CardContent className="p-3">
        <div className="flex items-start space-x-3">
          <LinkIcon className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">
                {analysis.domain}
              </span>
              <div className="flex items-center space-x-2">
                {analysis.isAcademic && (
                  <Badge variant="secondary" className="text-[var(--supporting)]">
                    <Award className="h-3 w-3 mr-1" />
                    Academic
                  </Badge>
                )}
                <Badge variant="outline" className={credibility.color}>
                  {credibility.level}
                </Badge>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <span className="text-xs text-muted-foreground">Credibility:</span>
              <Progress 
                value={analysis.credibilityScore * 100} 
                className="flex-1 h-1"
              />
              <span className="text-xs text-muted-foreground">
                {Math.round(analysis.credibilityScore * 100)}%
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * STANCE SELECTOR COMPONENT
 * 
 * Provides guidance and interface for selecting evidence stance.
 */
function StanceSelector({
  value,
  onChange,
  error,
}: {
  value?: EvidenceStance;
  onChange: (value: EvidenceStance) => void;
  error?: string;
}) {
  return (
    <div className="space-y-3">
      <Label className="text-base font-medium">Evidence Stance</Label>
      <p className="text-sm text-muted-foreground">
        Does this source provide evidence that supports or refutes the hypothesis?
      </p>
      
      <RadioGroup
        value={value}
        onValueChange={(value) => onChange(value as EvidenceStance)}
        className="grid grid-cols-1 gap-4"
      >
        <div className="flex items-start space-x-3">
          <RadioGroupItem 
            value={EvidenceStance.SUPPORTING} 
            id="supporting"
            className="mt-1"
          />
          <div className="flex-1">
            <Label htmlFor="supporting" className="flex items-center space-x-2 cursor-pointer">
              <i className="fas fa-thumbs-up text-[var(--supporting)]"></i>
              <span className="font-medium">Supporting Evidence</span>
            </Label>
            <p className="text-sm text-muted-foreground mt-1">
              This source provides data, research, or reasoning that supports the hypothesis
            </p>
          </div>
        </div>
        
        <div className="flex items-start space-x-3">
          <RadioGroupItem 
            value={EvidenceStance.REFUTING} 
            id="refuting"
            className="mt-1"
          />
          <div className="flex-1">
            <Label htmlFor="refuting" className="flex items-center space-x-2 cursor-pointer">
              <i className="fas fa-thumbs-down text-[var(--refuting)]"></i>
              <span className="font-medium">Refuting Evidence</span>
            </Label>
            <p className="text-sm text-muted-foreground mt-1">
              This source provides data, research, or reasoning that contradicts the hypothesis
            </p>
          </div>
        </div>
      </RadioGroup>
      
      {error && (
        <p className="text-sm text-destructive flex items-center">
          <AlertCircle className="h-4 w-4 mr-1" />
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * SOURCE PREVIEW COMPONENT
 * 
 * Shows how the source will appear when added to the hypothesis.
 */
function SourcePreview({
  url,
  description,
  stance,
  analysis,
}: {
  url: string;
  description: string;
  stance?: EvidenceStance;
  analysis: any;
}) {
  if (!url || !description || !stance) {
    return (
      <Card className="bg-muted/50">
        <CardContent className="p-4">
          <p className="text-muted-foreground text-center">
            Fill in the form to see a preview of your source
          </p>
        </CardContent>
      </Card>
    );
  }

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

  const config = stanceConfig[stance];

  return (
    <Card className={`${config.bgClass} ${config.borderClass}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-2">
              <i className={config.iconClass}></i>
              <span className="text-sm font-medium text-muted-foreground">
                {config.label}
              </span>
              {analysis?.isAcademic && (
                <Badge variant="secondary" className="text-[var(--supporting)]">
                  <Award className="h-3 w-3 mr-1" />
                  Academic
                </Badge>
              )}
            </div>
            
            <h5 className="font-medium text-foreground mb-2">
              {description}
            </h5>
            
            <div className="citation-link flex items-center space-x-1">
              <span className="break-all text-sm">{url}</span>
              <ExternalLink className="h-3 w-3" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * CHARACTER COUNTER COMPONENT
 * 
 * Provides visual feedback on character limits.
 */
function CharacterCounter({
  current,
  max,
  className = "",
}: {
  current: number;
  max: number;
  className?: string;
}) {
  const percentage = (current / max) * 100;
  const isNearLimit = percentage > 80;
  const isOverLimit = percentage > 100;

  return (
    <div className={`text-right ${className}`}>
      <span
        className={`text-xs ${
          isOverLimit
            ? 'text-destructive'
            : isNearLimit
            ? 'text-[var(--warning)]'
            : 'text-muted-foreground'
        }`}
      >
        {current}/{max}
      </span>
    </div>
  );
}

/**
 * MAIN ADD SOURCE MODAL COMPONENT
 * 
 * Orchestrates the complete source addition workflow.
 */
interface AddSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  hypothesisId: string;
}

export default function AddSourceModal({
  isOpen,
  onClose,
  hypothesisId,
}: AddSourceModalProps) {
  const [showPreview, setShowPreview] = useState(false);
  const { toast } = useToast();
  const { user, isSignedIn } = useNostr();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isValid },
  } = useForm<AddSourceForm>({
    resolver: zodResolver(addSourceSchema),
    mode: "onChange",
    defaultValues: {
      url: "",
      description: "",
    },
  });

  // Watch form values for real-time updates
  const watchedUrl = watch("url");
  const watchedDescription = watch("description");
  const watchedStance = watch("stance");

  const addSourceMutation = useMutation({
    mutationFn: async (data: AddSourceForm) => {
      return SourceService.addSource(
        hypothesisId,
        data.url,
        data.description,
        data.stance
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sources', hypothesisId] });
      toast({
        title: "Source Added",
        description: "Your source has been added to the hypothesis successfully.",
      });
      handleClose();
    },
    onError: (error) => {
      toast({
        title: "Failed to Add Source",
        description: error.message || "Failed to add source. Please try again.",
        variant: "destructive",
      });
    },
  });

  /**
   * FORM SUBMISSION HANDLER
   */
  const onSubmit = async (data: AddSourceForm) => {
    if (!isSignedIn || !user) {
      toast({
        title: "Authentication Required",
        description: "Please connect to Nostr to add sources.",
        variant: "destructive",
      });
      return;
    }

    try {
      await addSourceMutation.mutateAsync(data);
    } catch (error) {
      console.error("Failed to add source:", error);
    }
  };

  /**
   * MODAL CLOSE HANDLER
   */
  const handleClose = () => {
    if (watchedUrl || watchedDescription) {
      if (confirm("Are you sure you want to close? Your progress will be lost.")) {
        reset();
        setShowPreview(false);
        onClose();
      }
    } else {
      reset();
      setShowPreview(false);
      onClose();
    }
  };

  // URL analysis for credibility assessment
  const [urlAnalysis, setUrlAnalysis] = useState<any>(null);
  
  useEffect(() => {
    if (watchedUrl && watchedUrl.startsWith('https://')) {
      try {
        const urlObj = new URL(watchedUrl);
        const domain = urlObj.hostname.toLowerCase();
        
        const academicIndicators = ['.edu', 'arxiv.org', 'pubmed.ncbi.nlm.nih.gov', 'doi.org'];
        const isAcademic = academicIndicators.some(indicator => domain.includes(indicator));
        
        setUrlAnalysis({ domain, isAcademic });
      } catch {
        setUrlAnalysis(null);
      }
    } else {
      setUrlAnalysis(null);
    }
  }, [watchedUrl]);

  const canPreview = watchedUrl && watchedDescription && watchedStance;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Plus className="h-5 w-5 text-primary" />
            <span>Add Supporting Evidence</span>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-y-auto max-h-[calc(90vh-100px)]">
          {/* Form Section */}
          <div className="space-y-6">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* URL Field */}
              <div className="space-y-2">
                <Label htmlFor="url">Source URL</Label>
                <Input
                  id="url"
                  type="url"
                  placeholder="https://example.com/research-paper"
                  {...register("url")}
                  className={errors.url ? 'border-destructive' : ''}
                />
                {errors.url && (
                  <p className="text-sm text-destructive flex items-center">
                    <AlertCircle className="h-4 w-4 mr-1" />
                    {errors.url.message}
                  </p>
                )}
                {watchedUrl && <UrlAnalyzer url={watchedUrl} />}
              </div>

              {/* Description Field */}
              <div className="space-y-2">
                <Label htmlFor="description">Description & Relevance</Label>
                <Textarea
                  id="description"
                  placeholder="Explain how this source relates to the hypothesis and what evidence it provides..."
                  rows={6}
                  {...register("description")}
                  className={`resize-none ${errors.description ? 'border-destructive' : ''}`}
                />
                <div className="flex items-center justify-between">
                  {errors.description && (
                    <p className="text-sm text-destructive flex items-center">
                      <AlertCircle className="h-4 w-4 mr-1" />
                      {errors.description.message}
                    </p>
                  )}
                  <CharacterCounter
                    current={watchedDescription?.length || 0}
                    max={512}
                    className="ml-auto"
                  />
                </div>
              </div>

              {/* Stance Selection */}
              <StanceSelector
                value={watchedStance}
                onChange={(value) => setValue("stance", value)}
                error={errors.stance?.message}
              />

              {/* Action Buttons */}
              <div className="flex justify-between pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowPreview(!showPreview)}
                  disabled={!canPreview}
                >
                  {showPreview ? 'Hide Preview' : 'Show Preview'}
                </Button>
                
                <div className="flex space-x-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleClose}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={!isValid || addSourceMutation.isPending}
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    {addSourceMutation.isPending ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Adding...
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Source
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </form>
          </div>

          {/* Preview Section */}
          <div className="space-y-6">
            {showPreview && canPreview ? (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-foreground">Preview</h3>
                <SourcePreview
                  url={watchedUrl}
                  description={watchedDescription}
                  stance={watchedStance}
                  analysis={urlAnalysis}
                />
              </div>
            ) : (
              <Card className="bg-muted/50">
                <CardContent className="p-6">
                  <div className="text-center space-y-4">
                    <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto" />
                    <div>
                      <h3 className="font-semibold text-foreground mb-2">Source Guidelines</h3>
                      <ul className="text-sm text-muted-foreground space-y-2 text-left">
                        <li className="flex items-start">
                          <span className="text-primary mr-2">•</span>
                          <span>Use reputable, authoritative sources</span>
                        </li>
                        <li className="flex items-start">
                          <span className="text-primary mr-2">•</span>
                          <span>Academic papers and peer-reviewed research are preferred</span>
                        </li>
                        <li className="flex items-start">
                          <span className="text-primary mr-2">•</span>
                          <span>Clearly explain the source's relevance</span>
                        </li>
                        <li className="flex items-start">
                          <span className="text-primary mr-2">•</span>
                          <span>Be honest about whether it supports or refutes</span>
                        </li>
                        <li className="flex items-start">
                          <span className="text-primary mr-2">•</span>
                          <span>Avoid biased or low-quality sources</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Authentication Warning */}
            {!isSignedIn && (
              <Card className="bg-[var(--warning)]/10 border-[var(--warning)]">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2 text-[var(--warning)]">
                    <AlertCircle className="h-4 w-4" />
                    <span className="font-medium">Connection Required</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    You need to connect to Nostr to add sources to hypotheses.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
