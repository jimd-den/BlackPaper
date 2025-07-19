/**
 * CREATE HYPOTHESIS MODAL COMPONENT
 * 
 * This component provides a modal interface for creating new hypotheses on the platform.
 * Implements comprehensive form validation, category selection, and integration with
 * the Nostr protocol for decentralized publication.
 * 
 * Features:
 * - Multi-step form with validation
 * - Category selection with descriptions
 * - Character count indicators
 * - Real-time validation feedback
 * - Nostr event creation and signing
 * - Error handling and user feedback
 * - Mobile-responsive design
 */

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Save, BookOpen, AlertCircle } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useNostr } from "@/hooks/use-nostr";
import { AcademicCategory, CATEGORY_METADATA } from "@/domain/hypothesis";
import { HypothesisService } from "@/services/hypothesis-service";

/**
 * FORM VALIDATION SCHEMA
 * 
 * Defines validation rules based on domain business rules for hypothesis creation.
 */
const createHypothesisSchema = z.object({
  title: z
    .string()
    .min(10, "Title must be at least 10 characters for descriptiveness")
    .max(256, "Title must not exceed 256 characters for readability")
    .refine(
      (title) => /^[a-zA-Z]/.test(title.trim()),
      "Title must start with a letter"
    ),
  body: z
    .string()
    .min(50, "Description must be at least 50 characters for adequate detail")
    .max(1024, "Description must not exceed 1024 characters")
    .refine(
      (body) => (body.match(/[.!?]+/g) || []).length >= 2,
      "Description should contain multiple sentences for clarity"
    ),
  category: z.nativeEnum(AcademicCategory, {
    required_error: "Please select an academic category",
  }),
});

type CreateHypothesisForm = z.infer<typeof createHypothesisSchema>;

/**
 * CHARACTER COUNTER COMPONENT
 * 
 * Provides visual feedback on character limits with color-coded indicators.
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
      <div className="flex items-center justify-end space-x-2">
        <Progress
          value={Math.min(percentage, 100)}
          className={`w-16 h-1 ${isOverLimit ? 'text-destructive' : isNearLimit ? 'text-warning' : ''}`}
        />
        <span
          className={`text-xs ${
            isOverLimit
              ? 'text-destructive'
              : isNearLimit
              ? 'text-warning'
              : 'text-muted-foreground'
          }`}
        >
          {current}/{max}
        </span>
      </div>
    </div>
  );
}

/**
 * CATEGORY SELECTOR COMPONENT
 * 
 * Displays academic categories with descriptions and icons for easy selection.
 */
function CategorySelector({
  value,
  onChange,
  error,
}: {
  value?: AcademicCategory;
  onChange: (value: AcademicCategory) => void;
  error?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor="category">Academic Category</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className={error ? 'border-destructive' : ''}>
          <SelectValue placeholder="Select a category for your hypothesis" />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(CATEGORY_METADATA).map(([category, metadata]) => (
            <SelectItem key={category} value={category}>
              <div className="flex items-center space-x-2">
                <i className={`${metadata.icon} ${metadata.color}`}></i>
                <div>
                  <div className="font-medium">{metadata.displayName}</div>
                  <div className="text-xs text-muted-foreground">
                    {metadata.description}
                  </div>
                </div>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
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
 * FORM PREVIEW COMPONENT
 * 
 * Shows a preview of how the hypothesis will appear when published.
 */
function HypothesisPreview({
  title,
  body,
  category,
}: {
  title: string;
  body: string;
  category?: AcademicCategory;
}) {
  const categoryMetadata = category ? CATEGORY_METADATA[category] : null;

  return (
    <Card className="mobile-card">
      <CardContent className="p-4">
        <div className="flex items-center space-x-2 mb-3">
          <BookOpen className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-muted-foreground">Preview</span>
        </div>
        
        <div className="space-y-3">
          <div>
            <h3 className="text-lg font-semibold text-foreground">
              {title || "Your hypothesis title will appear here..."}
            </h3>
            {categoryMetadata && (
              <Badge variant="secondary" className="mt-2">
                <i className={`${categoryMetadata.icon} mr-1 ${categoryMetadata.color}`}></i>
                {categoryMetadata.displayName}
              </Badge>
            )}
          </div>
          
          <div className="pt-2 border-t border-border">
            <p className="text-foreground leading-relaxed">
              {body || "Your detailed hypothesis description will appear here..."}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * GUIDELINES COMPONENT
 * 
 * Displays helpful guidelines for creating high-quality hypotheses.
 */
function HypothesisGuidelines() {
  return (
    <Card className="bg-muted">
      <CardContent className="p-4">
        <h4 className="font-medium text-foreground mb-3 flex items-center">
          <AlertCircle className="h-4 w-4 mr-2 text-primary" />
          Guidelines for Academic Hypotheses
        </h4>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-start">
            <span className="text-primary mr-2">•</span>
            <span>Make your hypothesis testable and falsifiable</span>
          </li>
          <li className="flex items-start">
            <span className="text-primary mr-2">•</span>
            <span>Use clear, precise language without jargon</span>
          </li>
          <li className="flex items-start">
            <span className="text-primary mr-2">•</span>
            <span>Provide sufficient context for evaluation</span>
          </li>
          <li className="flex items-start">
            <span className="text-primary mr-2">•</span>
            <span>Cite relevant prior work when possible</span>
          </li>
          <li className="flex items-start">
            <span className="text-primary mr-2">•</span>
            <span>Be prepared to engage with evidence and critique</span>
          </li>
        </ul>
      </CardContent>
    </Card>
  );
}

/**
 * MAIN CREATE HYPOTHESIS MODAL COMPONENT
 * 
 * Orchestrates the complete hypothesis creation workflow with validation and submission.
 */
interface CreateHypothesisModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CreateHypothesisModal({
  isOpen,
  onClose,
}: CreateHypothesisModalProps) {
  const [showPreview, setShowPreview] = useState(false);
  const { toast } = useToast();
  const { user, isSignedIn, publishEvent } = useNostr();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isValid },
  } = useForm<CreateHypothesisForm>({
    resolver: zodResolver(createHypothesisSchema),
    mode: "onChange",
    defaultValues: {
      title: "",
      body: "",
    },
  });

  // Watch form values for real-time updates
  const watchedTitle = watch("title");
  const watchedBody = watch("body");
  const watchedCategory = watch("category");

  const createHypothesisMutation = useMutation({
    mutationFn: async (data: CreateHypothesisForm) => {
      console.log('Creating hypothesis:', data);
      console.log('User context:', { isSignedIn, user: user?.publicKey });
      if (!user?.privateKey) {
        throw new Error('User private key is required to publish hypotheses');
      }
      return HypothesisService.createHypothesis(
        data.title,
        data.body,
        data.category,
        user.privateKey
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/hypotheses'] });
      toast({
        title: "Hypothesis Published",
        description: "Your hypothesis has been published to the network successfully.",
      });
      handleClose();
    },
    onError: (error: any) => {
      console.error("Hypothesis creation error:", error);
      toast({
        title: "Failed to Create Hypothesis",
        description: error.message || "Failed to publish hypothesis. Please try again.",
        variant: "destructive",
      });
    },
  });

  /**
   * FORM SUBMISSION HANDLER
   * 
   * Validates form data and publishes hypothesis to Nostr network.
   */
  const onSubmit = async (data: CreateHypothesisForm) => {
    if (!isSignedIn || !user) {
      toast({
        title: "Authentication Required",
        description: "Please connect to Nostr to create hypotheses.",
        variant: "destructive",
      });
      return;
    }

    try {
      await createHypothesisMutation.mutateAsync(data);
    } catch (error) {
      console.error("Failed to create hypothesis:", error);
    }
  };

  /**
   * MODAL CLOSE HANDLER
   * 
   * Resets form state and closes modal with confirmation if needed.
   */
  const handleClose = () => {
    if (watchedTitle || watchedBody) {
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

  const isFormEmpty = !watchedTitle && !watchedBody;
  const canPreview = watchedTitle && watchedBody && watchedCategory;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <span>Create New Hypothesis</span>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-y-auto max-h-[calc(90vh-100px)]">
          {/* Form Section */}
          <div className="space-y-6">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Title Field */}
              <div className="space-y-2">
                <Label htmlFor="title">Hypothesis Title</Label>
                <Input
                  id="title"
                  placeholder="Enter a clear, descriptive title for your hypothesis"
                  {...register("title")}
                  className={errors.title ? 'border-destructive' : ''}
                />
                <div className="flex items-center justify-between">
                  {errors.title && (
                    <p className="text-sm text-destructive flex items-center">
                      <AlertCircle className="h-4 w-4 mr-1" />
                      {errors.title.message}
                    </p>
                  )}
                  <CharacterCounter
                    current={watchedTitle?.length || 0}
                    max={256}
                    className="ml-auto"
                  />
                </div>
              </div>

              {/* Body Field */}
              <div className="space-y-2">
                <Label htmlFor="body">Detailed Description</Label>
                <Textarea
                  id="body"
                  placeholder="Provide a detailed explanation of your hypothesis, including context, rationale, and expected implications..."
                  rows={8}
                  {...register("body")}
                  className={`resize-none ${errors.body ? 'border-destructive' : ''}`}
                />
                <div className="flex items-center justify-between">
                  {errors.body && (
                    <p className="text-sm text-destructive flex items-center">
                      <AlertCircle className="h-4 w-4 mr-1" />
                      {errors.body.message}
                    </p>
                  )}
                  <CharacterCounter
                    current={watchedBody?.length || 0}
                    max={1024}
                    className="ml-auto"
                  />
                </div>
              </div>

              {/* Category Field */}
              <CategorySelector
                value={watchedCategory}
                onChange={(value) => setValue("category", value)}
                error={errors.category?.message}
              />

              {/* Action Buttons */}
              <div className="flex justify-between pt-4">
                <div className="flex space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowPreview(!showPreview)}
                    disabled={!canPreview}
                  >
                    {showPreview ? 'Hide Preview' : 'Show Preview'}
                  </Button>
                </div>
                
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
                    disabled={!isValid || createHypothesisMutation.isPending}
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    {createHypothesisMutation.isPending ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Publishing...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Publish Hypothesis
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </form>
          </div>

          {/* Preview and Guidelines Section */}
          <div className="space-y-6">
            {showPreview && canPreview ? (
              <HypothesisPreview
                title={watchedTitle}
                body={watchedBody}
                category={watchedCategory}
              />
            ) : (
              <HypothesisGuidelines />
            )}

            {/* Connection Status */}
            {!isSignedIn && (
              <Card className="bg-[var(--warning)]/10 border-[var(--warning)]">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2 text-[var(--warning)]">
                    <AlertCircle className="h-4 w-4" />
                    <span className="font-medium">Connection Required</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    You need to connect to Nostr to publish hypotheses. Please connect your account first.
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
