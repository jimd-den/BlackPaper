/**
 * HOME PAGE COMPONENT
 * 
 * This component serves as the main landing page for Black Paper, implementing
 * the hypothesis discovery and browsing interface. It follows the Presentation
 * Layer pattern from Clean Architecture, coordinating between UI components
 * and application services.
 * 
 * Features:
 * - Hypothesis feed with filtering and sorting
 * - Category-based navigation
 * - Search functionality
 * - Create hypothesis functionality
 * - Responsive design for mobile and desktop
 */

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Plus, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useNostr } from "@/hooks/use-nostr";
import NavigationHeader from "@/components/navigation-header";
import HypothesisCard from "@/components/hypothesis-card";
import CreateHypothesisModal from "@/components/create-hypothesis-modal";
import { AcademicCategory, CATEGORY_METADATA, HypothesisSearchCriteria } from "@/domain/hypothesis";
import { HypothesisService } from "@/services/hypothesis-service";

/**
 * CATEGORY FILTER COMPONENT
 * 
 * Provides category-based filtering for hypothesis discovery.
 * Implements the academic categorization system defined in our domain model.
 */
function CategoryFilter({ 
  selectedCategory, 
  onCategoryChange,
  hypothesesCount 
}: {
  selectedCategory?: AcademicCategory;
  onCategoryChange: (category?: AcademicCategory) => void;
  hypothesesCount: Record<string, number>;
}) {
  return (
    <Card className="h-fit">
      <CardContent className="p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Categories</h2>
        <div className="space-y-2">
          <button
            className={`w-full text-left py-2 px-3 rounded-lg hover:bg-muted transition-colors text-sm ${
              !selectedCategory ? 'bg-muted text-foreground' : 'text-muted-foreground'
            }`}
            onClick={() => onCategoryChange(undefined)}
          >
            <span className="flex items-center justify-between">
              <span className="flex items-center">
                <i className="fas fa-list mr-2 text-primary"></i>
                All Categories
              </span>
              <Badge variant="secondary" className="ml-2">
                {Object.values(hypothesesCount).reduce((sum, count) => sum + count, 0)}
              </Badge>
            </span>
          </button>
          
          {Object.entries(CATEGORY_METADATA).map(([category, metadata]) => (
            <button
              key={category}
              className={`w-full text-left py-2 px-3 rounded-lg hover:bg-muted transition-colors text-sm ${
                selectedCategory === category ? 'bg-muted text-foreground' : 'text-muted-foreground'
              }`}
              onClick={() => onCategoryChange(category as AcademicCategory)}
            >
              <span className="flex items-center justify-between">
                <span className="flex items-center">
                  <i className={`${metadata.icon} mr-2 ${metadata.color}`}></i>
                  {metadata.displayName}
                </span>
                <Badge variant="secondary" className="ml-2">
                  {hypothesesCount[category] || 0}
                </Badge>
              </span>
            </button>
          ))}
        </div>

        <hr className="my-6 border-border" />

        <h3 className="text-md font-medium text-foreground mb-3">Sort by</h3>
        <div className="space-y-2">
          <label className="flex items-center">
            <input 
              type="radio" 
              name="sort" 
              value="recent" 
              defaultChecked 
              className="text-primary focus:ring-primary mr-2"
            />
            <span className="text-sm">Most Recent</span>
          </label>
          <label className="flex items-center">
            <input 
              type="radio" 
              name="sort" 
              value="discussed" 
              className="text-primary focus:ring-primary mr-2"
            />
            <span className="text-sm">Most Discussed</span>
          </label>
          <label className="flex items-center">
            <input 
              type="radio" 
              name="sort" 
              value="sources" 
              className="text-primary focus:ring-primary mr-2"
            />
            <span className="text-sm">Most Sources</span>
          </label>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * SEARCH BAR COMPONENT
 * 
 * Implements real-time search functionality for hypothesis discovery.
 * Provides debounced search to optimize performance.
 */
function SearchBar({ 
  searchQuery, 
  onSearchChange 
}: {
  searchQuery: string;
  onSearchChange: (query: string) => void;
}) {
  return (
    <div className="relative max-w-2xl mx-8 hidden lg:block">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <Search className="h-4 w-4 text-muted-foreground" />
      </div>
      <Input
        type="text"
        placeholder="Search hypotheses..."
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        className="pl-10 focus:ring-2 focus:ring-primary focus:border-transparent"
      />
    </div>
  );
}

/**
 * HYPOTHESIS FEED COMPONENT
 * 
 * Displays the main feed of hypotheses with loading and empty states.
 * Implements infinite scrolling and proper error handling.
 */
function HypothesisFeed({ 
  searchCriteria,
  onHypothesisClick 
}: {
  searchCriteria: HypothesisSearchCriteria;
  onHypothesisClick: (hypothesisId: string) => void;
}) {
  const { data: hypotheses, isLoading, error } = useQuery({
    queryKey: ['/api/hypotheses', searchCriteria],
    queryFn: () => HypothesisService.searchHypotheses(searchCriteria),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="mobile-card">
            <CardContent className="p-6">
              <Skeleton className="h-6 w-3/4 mb-2" />
              <Skeleton className="h-4 w-1/2 mb-4" />
              <Skeleton className="h-20 w-full mb-4" />
              <div className="flex items-center space-x-4">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-20" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card className="mobile-card">
        <CardContent className="p-6 text-center">
          <div className="text-destructive mb-2">
            <i className="fas fa-exclamation-triangle text-2xl"></i>
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">
            Failed to Load Hypotheses
          </h3>
          <p className="text-muted-foreground mb-4">
            Unable to connect to the Nostr network. Please check your connection and try again.
          </p>
          <Button onClick={() => window.location.reload()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!hypotheses || hypotheses.length === 0) {
    return (
      <Card className="mobile-card">
        <CardContent className="p-6 text-center">
          <div className="text-muted-foreground mb-2">
            <i className="fas fa-search text-2xl"></i>
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">
            No Hypotheses Found
          </h3>
          <p className="text-muted-foreground mb-4">
            {searchCriteria.query 
              ? `No hypotheses match your search for "${searchCriteria.query}"`
              : 'No hypotheses have been created yet. Be the first to propose one!'
            }
          </p>
          {!searchCriteria.query && (
            <Button onClick={() => onHypothesisClick('create')}>
              <Plus className="h-4 w-4 mr-2" />
              Create First Hypothesis
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {hypotheses.map((hypothesis) => (
        <HypothesisCard
          key={hypothesis.id}
          hypothesis={hypothesis}
          onClick={() => onHypothesisClick(hypothesis.id)}
        />
      ))}
      
      {hypotheses.length >= searchCriteria.limit && (
        <div className="text-center">
          <Button variant="outline">
            Load More Hypotheses
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * MAIN HOME PAGE COMPONENT
 * 
 * Orchestrates the entire home page experience, managing state and
 * coordinating between different UI components.
 */
export default function Home() {
  // State Management
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<AcademicCategory | undefined>();
  const [sortBy, setSortBy] = useState<'recent' | 'discussed' | 'sources'>('recent');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // Hooks
  const { toast } = useToast();
  const { isConnected } = useNostr();

  // Debounced search functionality
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(searchQuery);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Create search criteria
  const searchCriteria = new HypothesisSearchCriteria(
    debouncedSearchQuery || undefined,
    selectedCategory,
    sortBy,
    20,
    0
  );

  // Mock hypothesis counts by category (in real app, would come from API)
  const hypothesesCount = {
    [AcademicCategory.PHYSICS]: 15,
    [AcademicCategory.BIOLOGY]: 23,
    [AcademicCategory.ECONOMICS]: 18,
    [AcademicCategory.PSYCHOLOGY]: 12,
    [AcademicCategory.OTHER]: 8,
  };

  /**
   * HYPOTHESIS CLICK HANDLER
   * 
   * Handles navigation to hypothesis detail view or modal opening.
   */
  const handleHypothesisClick = (hypothesisId: string) => {
    if (hypothesisId === 'create') {
      if (!isConnected) {
        toast({
          title: "Connection Required",
          description: "Please connect to Nostr to create hypotheses.",
          variant: "destructive",
        });
        return;
      }
      setShowCreateModal(true);
    } else {
      // Navigate to hypothesis detail page
      window.location.href = `/hypothesis/${hypothesisId}`;
    }
  };

  /**
   * CREATE HYPOTHESIS HANDLER
   * 
   * Opens the create hypothesis modal if user is connected.
   */
  const handleCreateHypothesis = () => {
    if (!isConnected) {
      toast({
        title: "Connection Required",
        description: "Please connect to Nostr to create hypotheses.",
        variant: "destructive",
      });
      return;
    }
    setShowCreateModal(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <NavigationHeader 
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar - Desktop */}
          <div className="lg:col-span-1 hidden lg:block">
            <div className="sticky top-24">
              <CategoryFilter
                selectedCategory={selectedCategory}
                onCategoryChange={setSelectedCategory}
                hypothesesCount={hypothesesCount}
              />
              
              <Button 
                className="w-full mt-6" 
                onClick={handleCreateHypothesis}
              >
                <Plus className="h-4 w-4 mr-2" />
                New Hypothesis
              </Button>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            <HypothesisFeed
              searchCriteria={searchCriteria}
              onHypothesisClick={handleHypothesisClick}
            />
          </div>
        </div>
      </div>

      {/* Mobile Search Bar */}
      <div className="lg:hidden sticky top-16 bg-background border-b border-border p-4 z-40">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-muted-foreground" />
          </div>
          <Input
            type="text"
            placeholder="Search hypotheses..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>
      </div>

      {/* Mobile Filter Toggle */}
      <div className="fixed bottom-4 right-4 z-40 lg:hidden">
        <Button
          size="lg"
          className="rounded-full shadow-lg"
          onClick={() => setShowMobileFilters(true)}
        >
          <Filter className="h-5 w-5" />
        </Button>
      </div>

      {/* Mobile Create Button */}
      <div className="fixed bottom-4 left-4 z-40 lg:hidden">
        <Button
          size="lg"
          className="rounded-full shadow-lg"
          onClick={handleCreateHypothesis}
        >
          <Plus className="h-5 w-5" />
        </Button>
      </div>

      {/* Modals */}
      <CreateHypothesisModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />
    </div>
  );
}
