/**
 * NAVIGATION HEADER COMPONENT
 * 
 * This component implements the main navigation header for Black Paper,
 * providing brand identity, search functionality, and Nostr connection management.
 * Follows responsive design principles for optimal mobile and desktop experience.
 * 
 * Features:
 * - Brand logo and tagline
 * - Global search functionality
 * - Nostr connection status indicator
 * - User authentication state management
 * - Mobile-responsive navigation
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Key, User, Menu } from "lucide-react";
import { useNostr } from "@/hooks/use-nostr";
import NostrConnectionModal from "./nostr-connection-modal";
import { ConnectionStatus } from "@/lib/nostr";

/**
 * CONNECTION STATUS INDICATOR COMPONENT
 * 
 * Displays current Nostr network connection status with appropriate visual cues.
 * Provides users with clear feedback about their connectivity state.
 */
function ConnectionStatusIndicator({ status }: { status: ConnectionStatus }) {
  const getStatusConfig = () => {
    switch (status) {
      case ConnectionStatus.CONNECTED:
        return {
          color: 'bg-[var(--supporting)]',
          text: 'Connected',
          icon: 'fas fa-check-circle',
          className: 'status-connected',
        };
      case ConnectionStatus.CONNECTING:
        return {
          color: 'bg-[var(--warning)]',
          text: 'Connecting',
          icon: 'fas fa-spinner fa-spin',
          className: 'status-connecting',
        };
      case ConnectionStatus.ERROR:
        return {
          color: 'bg-[var(--refuting)]',
          text: 'Error',
          icon: 'fas fa-exclamation-triangle',
          className: 'status-disconnected',
        };
      default:
        return {
          color: 'bg-muted',
          text: 'Disconnected',
          icon: 'fas fa-circle',
          className: 'status-disconnected',
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div className="flex items-center space-x-2">
      <div className={`w-2 h-2 ${config.color} rounded-full`}></div>
      <span className={`text-sm hidden sm:inline ${config.className}`}>
        {config.text}
      </span>
    </div>
  );
}

/**
 * USER MENU COMPONENT
 * 
 * Displays user authentication state and provides access to user actions.
 * Shows connection button for unauthenticated users and user info for authenticated users.
 */
function UserMenu({ 
  onConnectClick 
}: { 
  onConnectClick: () => void;
}) {
  const { user, isSignedIn, signOut } = useNostr();

  if (!isSignedIn || !user) {
    return (
      <Button 
        onClick={onConnectClick}
        className="bg-primary text-primary-foreground hover:bg-primary/90"
      >
        <Key className="h-4 w-4 mr-2" />
        Connect
      </Button>
    );
  }

  return (
    <div className="flex items-center space-x-3">
      <span className="text-sm text-muted-foreground hidden md:inline">
        {user.publicKey.slice(0, 12)}...
      </span>
      <div className="relative group">
        <Button variant="ghost" size="sm" className="p-2">
          <User className="h-5 w-5" />
        </Button>
        
        {/* Dropdown Menu - Simple implementation */}
        <div className="absolute right-0 top-full mt-2 w-48 bg-popover border border-border rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
          <div className="p-2">
            <div className="px-3 py-2 text-sm text-muted-foreground border-b border-border">
              {user.publicKey.slice(0, 20)}...
            </div>
            <button
              onClick={signOut}
              className="w-full text-left px-3 py-2 text-sm hover:bg-muted rounded-md mt-1"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * SEARCH BAR COMPONENT
 * 
 * Provides global search functionality with responsive design.
 * Hidden on mobile devices to save space, shown in dedicated mobile search area.
 */
function SearchBar({ 
  searchQuery, 
  onSearchChange 
}: {
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}) {
  return (
    <div className="flex-1 max-w-2xl mx-8 hidden lg:block">
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-muted-foreground" />
        </div>
        <Input
          type="text"
          placeholder="Search hypotheses..."
          value={searchQuery || ''}
          onChange={(e) => onSearchChange?.(e.target.value)}
          className="pl-10 focus:ring-2 focus:ring-primary focus:border-transparent"
        />
      </div>
    </div>
  );
}

/**
 * MAIN NAVIGATION HEADER COMPONENT
 * 
 * Orchestrates the complete navigation experience, managing state and
 * coordinating between different navigation elements.
 */
interface NavigationHeaderProps {
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

export default function NavigationHeader({ 
  searchQuery, 
  onSearchChange 
}: NavigationHeaderProps) {
  const [showConnectionModal, setShowConnectionModal] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  
  const { connectionStatus, connectedRelays } = useNostr();

  /**
   * CONNECT BUTTON HANDLER
   * 
   * Opens the Nostr connection modal for user authentication.
   */
  const handleConnectClick = () => {
    setShowConnectionModal(true);
  };

  /**
   * LOGO CLICK HANDLER
   * 
   * Navigates back to home page when logo is clicked.
   */
  const handleLogoClick = () => {
    window.location.href = '/';
  };

  return (
    <>
      <nav className="bg-card border-b border-border sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo and Brand */}
            <div className="flex items-center">
              <button 
                onClick={handleLogoClick}
                className="flex-shrink-0 flex items-center hover:opacity-80 transition-opacity"
              >
                <i className="fas fa-scroll text-primary text-2xl mr-3"></i>
                <h1 className="text-xl font-bold text-foreground">Black Paper</h1>
              </button>
              <div className="hidden md:block ml-8">
                <span className="text-sm text-muted-foreground">
                  Nostr-Powered Hypothesis Platform
                </span>
              </div>
            </div>

            {/* Search Bar - Desktop Only */}
            <SearchBar 
              searchQuery={searchQuery}
              onSearchChange={onSearchChange}
            />

            {/* User Status and Actions */}
            <div className="flex items-center space-x-4">
              {/* Nostr Connection Status */}
              <ConnectionStatusIndicator status={connectionStatus} />

              {/* User Menu */}
              <UserMenu onConnectClick={handleConnectClick} />

              {/* Mobile Menu Toggle */}
              <Button
                variant="ghost"
                size="sm"
                className="lg:hidden"
                onClick={() => setShowMobileMenu(!showMobileMenu)}
              >
                <Menu className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {showMobileMenu && (
          <div className="lg:hidden border-t border-border bg-card">
            <div className="px-4 py-2 space-y-2">
              <div className="flex items-center justify-between py-2">
                <span className="text-sm font-medium">Connection Status</span>
                <ConnectionStatusIndicator status={connectionStatus} />
              </div>
              
              {connectedRelays.length > 0 && (
                <div className="py-2">
                  <span className="text-sm font-medium text-muted-foreground">
                    Connected Relays: {connectedRelays.length}
                  </span>
                </div>
              )}
              
              <div className="pt-2 border-t border-border">
                <Button
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={handleConnectClick}
                >
                  <Key className="h-4 w-4 mr-2" />
                  Manage Connection
                </Button>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Nostr Connection Modal */}
      <NostrConnectionModal
        isOpen={showConnectionModal}
        onClose={() => setShowConnectionModal(false)}
      />
    </>
  );
}
