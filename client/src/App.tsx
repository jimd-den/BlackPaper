/**
 * APPLICATION ROOT COMPONENT
 * 
 * This component serves as the entry point for our Black Paper application,
 * implementing the top-level routing and state management architecture.
 * 
 * Architecture Pattern: This follows the Presentation Layer pattern from Clean Architecture,
 * orchestrating the various UI components while remaining isolated from business logic.
 */

import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import HypothesisDetail from "@/pages/hypothesis-detail";
import { NostrProvider } from "@/hooks/use-nostr";

/**
 * ROUTE CONFIGURATION
 * 
 * Implements client-side routing for our single-page application.
 * Each route maps to a specific use case in our domain model:
 * - Home: Browse and discover hypotheses
 * - Hypothesis Detail: Detailed evaluation and discussion
 */
function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/hypothesis/:id" component={HypothesisDetail} />
      <Route component={NotFound} />
    </Switch>
  );
}

/**
 * MAIN APPLICATION COMPONENT
 * 
 * Establishes the application context with necessary providers:
 * - QueryClientProvider: Manages server state and caching
 * - NostrProvider: Handles decentralized protocol connections
 * - TooltipProvider: Provides accessible UI interactions
 * 
 * This component embodies the Dependency Inversion Principle by injecting
 * dependencies through React's context system.
 */
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <NostrProvider>
        <TooltipProvider>
          <div className="min-h-screen bg-background">
            <Toaster />
            <Router />
          </div>
        </TooltipProvider>
      </NostrProvider>
    </QueryClientProvider>
  );
}

export default App;
