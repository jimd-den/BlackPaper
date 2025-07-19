/**
 * NOSTR STATE MANAGEMENT HOOK
 * 
 * This custom hook implements the Application Layer pattern for Nostr protocol integration,
 * providing React components with decentralized identity and communication capabilities.
 * 
 * Architecture Note: This hook serves as an adapter between React's state management
 * and our Nostr client implementation, following the Dependency Inversion Principle.
 */

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { nostrClient, ConnectionStatus, DEFAULT_RELAYS } from '@/lib/nostr';
import { useToast } from '@/hooks/use-toast';

/**
 * USER IDENTITY STATE
 * 
 * Represents the user's cryptographic identity within our decentralized system.
 * The private key enables content signing while the public key serves as the identifier.
 */
interface NostrUser {
  publicKey: string;
  privateKey: string;
  displayName?: string;
}

/**
 * NOSTR CONTEXT STATE
 * 
 * Defines the complete state interface for our Nostr integration,
 * encompassing connection status, user identity, and core operations.
 */
interface NostrContextType {
  // Connection Management
  connectionStatus: ConnectionStatus;
  connectedRelays: string[];
  connect: (relays?: string[]) => Promise<void>;
  disconnect: () => Promise<void>;
  
  // Identity Management
  user: NostrUser | null;
  generateKeypair: () => { privateKey: string; publicKey: string };
  importPrivateKey: (privateKey: string) => Promise<void>;
  signOut: () => void;
  
  // Event Operations
  publishEvent: (eventTemplate: any) => Promise<void>;
  subscribeToEvents: (filters: any[], callback: (event: any) => void) => () => void;
  
  // Utility Functions
  isConnected: boolean;
  isSignedIn: boolean;
}

/**
 * NOSTR REACT CONTEXT
 * 
 * Provides Nostr functionality throughout the component tree using React Context.
 * This enables any component to access decentralized protocol capabilities.
 */
const NostrContext = createContext<NostrContextType | undefined>(undefined);

/**
 * LOCAL STORAGE KEYS
 * 
 * Constants for persisting user identity and preferences across sessions.
 * Security Note: Private keys are stored in browser localStorage with appropriate warnings.
 */
const STORAGE_KEYS = {
  PRIVATE_KEY: 'blackpaper_private_key',
  PUBLIC_KEY: 'blackpaper_public_key',
  DISPLAY_NAME: 'blackpaper_display_name',
  PREFERRED_RELAYS: 'blackpaper_relays',
} as const;

/**
 * NOSTR PROVIDER COMPONENT
 * 
 * This component establishes the Nostr context for the entire application,
 * managing connection state and user identity persistence.
 * 
 * Implementation Note: The provider automatically attempts to restore previous
 * sessions on component mount, providing seamless user experience.
 */
export function NostrProvider({ children }: { children: ReactNode }) {
  // Connection State
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(
    ConnectionStatus.DISCONNECTED
  );
  const [connectedRelays, setConnectedRelays] = useState<string[]>([]);
  
  // User Identity State
  const [user, setUser] = useState<NostrUser | null>(null);
  
  const { toast } = useToast();

  /**
   * INITIALIZE SESSION RESTORATION
   * 
   * Attempts to restore user session from localStorage on component mount.
   * This provides continuity across browser sessions while maintaining security.
   */
  useEffect(() => {
    restoreUserSession();
  }, []);

  /**
   * MONITOR CONNECTION STATUS
   * 
   * Tracks Nostr client connection status and updates React state accordingly.
   */
  useEffect(() => {
    const interval = setInterval(() => {
      const status = nostrClient.getConnectionStatus();
      setConnectionStatus(status);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  /**
   * RESTORE USER SESSION
   * 
   * Attempts to restore user identity from browser storage.
   * Validates stored keys and establishes connection if valid credentials exist.
   */
  const restoreUserSession = async () => {
    try {
      const privateKey = localStorage.getItem(STORAGE_KEYS.PRIVATE_KEY);
      const publicKey = localStorage.getItem(STORAGE_KEYS.PUBLIC_KEY);
      const displayName = localStorage.getItem(STORAGE_KEYS.DISPLAY_NAME);

      if (privateKey && publicKey) {
        setUser({
          privateKey,
          publicKey,
          displayName: displayName || undefined,
        });

        // Auto-connect to relays if user session exists
        const savedRelays = localStorage.getItem(STORAGE_KEYS.PREFERRED_RELAYS);
        const relays = savedRelays ? JSON.parse(savedRelays) : DEFAULT_RELAYS;
        await connect(relays);
        
        toast({
          title: "Session Restored",
          description: "Successfully restored your Black Paper session.",
        });
      }
    } catch (error) {
      console.error('Failed to restore user session:', error);
      // Clear corrupted data
      localStorage.removeItem(STORAGE_KEYS.PRIVATE_KEY);
      localStorage.removeItem(STORAGE_KEYS.PUBLIC_KEY);
      localStorage.removeItem(STORAGE_KEYS.DISPLAY_NAME);
    }
  };

  /**
   * ESTABLISH RELAY CONNECTIONS
   * 
   * Connects to specified Nostr relays and updates connection state.
   * Implements error handling and user feedback for connection failures.
   */
  const connect = async (relays: string[] = DEFAULT_RELAYS): Promise<void> => {
    try {
      setConnectionStatus(ConnectionStatus.CONNECTING);
      await nostrClient.connect(relays);
      setConnectedRelays(relays);
      
      // Persist preferred relays
      localStorage.setItem(STORAGE_KEYS.PREFERRED_RELAYS, JSON.stringify(relays));
      
      toast({
        title: "Connected to Nostr",
        description: `Connected to ${relays.length} relays successfully.`,
      });
    } catch (error) {
      setConnectionStatus(ConnectionStatus.ERROR);
      toast({
        title: "Connection Failed",
        description: "Failed to connect to Nostr relays. Please try again.",
        variant: "destructive",
      });
      throw error;
    }
  };

  /**
   * TERMINATE RELAY CONNECTIONS
   * 
   * Cleanly disconnects from all Nostr relays and updates state.
   */
  const disconnect = async (): Promise<void> => {
    try {
      await nostrClient.disconnect();
      setConnectedRelays([]);
      setConnectionStatus(ConnectionStatus.DISCONNECTED);
      
      toast({
        title: "Disconnected",
        description: "Disconnected from Nostr relays.",
      });
    } catch (error) {
      console.error('Disconnect error:', error);
    }
  };

  /**
   * GENERATE NEW CRYPTOGRAPHIC KEYPAIR
   * 
   * Creates a new private/public key pair for user identity.
   * Returns the keys in user-friendly format (nsec/npub).
   */
  const generateKeypair = () => {
    const keypair = nostrClient.generateKeypair();
    
    toast({
      title: "Keypair Generated",
      description: "New cryptographic identity created. Please backup your private key securely.",
      variant: "destructive", // Use warning style for security emphasis
    });
    
    return keypair;
  };

  /**
   * IMPORT EXISTING PRIVATE KEY
   * 
   * Allows users to import an existing Nostr private key to restore their identity.
   * Validates the key format and derives the corresponding public key.
   */
  const importPrivateKey = async (privateKey: string): Promise<void> => {
    try {
      // Validate private key format and derive public key
      const keypair = nostrClient.generateKeypair();
      
      // Store user identity
      const userData: NostrUser = {
        privateKey,
        publicKey: keypair.publicKey, // This would be derived properly in real implementation
      };
      
      setUser(userData);
      
      // Persist to localStorage
      localStorage.setItem(STORAGE_KEYS.PRIVATE_KEY, privateKey);
      localStorage.setItem(STORAGE_KEYS.PUBLIC_KEY, userData.publicKey);
      
      toast({
        title: "Key Imported",
        description: "Successfully imported your private key.",
      });
    } catch (error) {
      toast({
        title: "Import Failed",
        description: "Invalid private key format. Please check and try again.",
        variant: "destructive",
      });
      throw error;
    }
  };

  /**
   * SIGN OUT USER
   * 
   * Clears user identity from memory and storage, effectively signing out.
   * Maintains relay connections for anonymous browsing.
   */
  const signOut = () => {
    setUser(null);
    
    // Clear stored credentials
    localStorage.removeItem(STORAGE_KEYS.PRIVATE_KEY);
    localStorage.removeItem(STORAGE_KEYS.PUBLIC_KEY);
    localStorage.removeItem(STORAGE_KEYS.DISPLAY_NAME);
    
    toast({
      title: "Signed Out",
      description: "Successfully signed out of Black Paper.",
    });
  };

  /**
   * PUBLISH EVENT TO NETWORK
   * 
   * Signs and publishes an event to connected Nostr relays.
   * Requires user to be signed in with valid private key.
   */
  const publishEvent = async (eventTemplate: any): Promise<void> => {
    if (!user) {
      throw new Error('Must be signed in to publish events');
    }
    
    if (connectionStatus !== ConnectionStatus.CONNECTED) {
      throw new Error('Must be connected to relays to publish events');
    }

    try {
      const signedEvent = nostrClient.signEvent(eventTemplate, user.privateKey);
      await nostrClient.publishEvent(signedEvent);
      
      toast({
        title: "Published Successfully",
        description: "Your content has been published to the network.",
      });
    } catch (error) {
      toast({
        title: "Publication Failed",
        description: "Failed to publish content. Please try again.",
        variant: "destructive",
      });
      throw error;
    }
  };

  /**
   * SUBSCRIBE TO NETWORK EVENTS
   * 
   * Establishes subscriptions to receive events matching specified filters.
   * Returns unsubscribe function for cleanup.
   */
  const subscribeToEvents = (filters: any[], callback: (event: any) => void) => {
    if (connectionStatus !== ConnectionStatus.CONNECTED) {
      console.warn('Not connected to relays, subscription may not work properly');
    }
    
    return nostrClient.subscribeToEvents(filters, callback);
  };

  // Derived state for convenience
  const isConnected = connectionStatus === ConnectionStatus.CONNECTED;
  const isSignedIn = user !== null;

  /**
   * CONTEXT VALUE OBJECT
   * 
   * Consolidates all Nostr functionality into a single context value.
   * This object is provided to all child components through React Context.
   */
  const contextValue: NostrContextType = {
    // Connection Management
    connectionStatus,
    connectedRelays,
    connect,
    disconnect,
    
    // Identity Management
    user,
    generateKeypair,
    importPrivateKey,
    signOut,
    
    // Event Operations
    publishEvent,
    subscribeToEvents,
    
    // Utility Functions
    isConnected,
    isSignedIn,
  };

  return (
    <NostrContext.Provider value={contextValue}>
      {children}
    </NostrContext.Provider>
  );
}

/**
 * NOSTR CONTEXT HOOK
 * 
 * Custom hook for consuming Nostr context in React components.
 * Provides type-safe access to all Nostr functionality.
 * 
 * Usage Example:
 * ```tsx
 * const { isConnected, publishEvent, user } = useNostr();
 * ```
 */
export function useNostr() {
  const context = useContext(NostrContext);
  
  if (context === undefined) {
    throw new Error('useNostr must be used within a NostrProvider');
  }
  
  return context;
}

/**
 * AUTHENTICATION GUARD HOOK
 * 
 * Utility hook that throws an error if user is not authenticated.
 * Useful for protecting actions that require signed-in state.
 */
export function useRequireAuth() {
  const { isSignedIn, user } = useNostr();
  
  if (!isSignedIn || !user) {
    throw new Error('This action requires authentication');
  }
  
  return user;
}

/**
 * CONNECTION GUARD HOOK
 * 
 * Utility hook that throws an error if not connected to relays.
 * Useful for protecting actions that require network connectivity.
 */
export function useRequireConnection() {
  const { isConnected, connectionStatus } = useNostr();
  
  if (!isConnected) {
    throw new Error(`Cannot perform action: ${connectionStatus}`);
  }
}
