'use client';

import { useState, useEffect } from 'react';
import LayerSidebar from '@/components/LayerSidebar';
import TrainingSidebar from '@/components/TrainingSidebar';
import FlowCanvas from '@/components/FlowCanvas';
import AuthModal from '@/components/AuthModal';
import UserMenu from '@/components/UserMenu';
import { useFlowStore } from '@/stores/flowStore';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/lib/api';

export default function Home() {
  const { mode } = useFlowStore();
  const { isAuthenticated, user, accessToken, setAuth, logout, setLoading, isLoading } = useAuthStore();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [hasSeenAuthModal, setHasSeenAuthModal] = useState(false);
  const [authInitialized, setAuthInitialized] = useState(false);

  // Initialize authentication on app load
  useEffect(() => {
    const initializeAuth = async () => {
      // Ensure we're in the browser before proceeding
      if (typeof window === 'undefined') {
        setAuthInitialized(true);
        return;
      }
      
      setLoading(true);
      
      try {
        // Check if we have stored tokens
        const isDevelopment = process.env.NODE_ENV === 'development';
        const apiUrl = process.env.NEXT_PUBLIC_API_URL;
        
        // Skip auth check in development if no API URL is configured
        if (isDevelopment && !apiUrl) {
          console.log('Development mode without API URL - skipping auth check');
          setLoading(false);
          setAuthInitialized(true);
          return;
        }
        
        if (accessToken) {
          // Add shorter timeout for faster development experience
          const timeoutMs = isDevelopment ? 2000 : 5000;
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Auth check timeout')), timeoutMs)
          );
          
          const authPromise = api.getCurrentUser();
          
          try {
            // Race between API call and timeout
            const user = await Promise.race([authPromise, timeoutPromise]);
            // Token is valid, update auth state with user data
            setAuth(user, accessToken, useAuthStore.getState().refreshToken || '');
          } catch (authError) {
            console.log('Stored token invalid or timeout, clearing auth:', authError);
            // Token is invalid or timed out, clear stored auth
            logout();
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        // On any error, just continue without auth
      } finally {
        // Always complete initialization
        setLoading(false);
        setAuthInitialized(true);
      }
    };

    // Start initialization immediately
    initializeAuth();
    
    // Shorter fallback timeout for development
    const isDevelopment = process.env.NODE_ENV === 'development';
    const fallbackTimeout = setTimeout(() => {
      console.warn('Auth initialization taking too long, forcing completion');
      setLoading(false);
      setAuthInitialized(true);
    }, isDevelopment ? 3000 : 10000); // 3 seconds in dev, 10 seconds in production
    
    return () => {
      clearTimeout(fallbackTimeout);
    };
  }, []); // Run once on mount

  // Show auth modal on first visit (only after auth is initialized)
  useEffect(() => {
    if (authInitialized && !hasSeenAuthModal && !isAuthenticated) {
      setTimeout(() => {
        setShowAuthModal(true);
        setHasSeenAuthModal(true);
      }, 1000); // Show after 1 second
    }
  }, [authInitialized, hasSeenAuthModal, isAuthenticated]);

  // Autosave functionality
  useEffect(() => {
    if (!isAuthenticated) return;

    const autosave = async () => {
      const { nodes, edges } = useFlowStore.getState();
      
      try {
        await api.autosaveModel({
          nodes,
          edges,
        });
      } catch (error) {
        console.error('Autosave failed:', error);
      }
    };

    // Autosave every 30 seconds
    const interval = setInterval(autosave, 30000);

    // Also save on significant changes
    const unsubscribe = useFlowStore.subscribe((state: any) => {
      // Debounce autosave
      clearTimeout((window as any).autosaveTimeout);
      (window as any).autosaveTimeout = setTimeout(autosave, 2000);
    });

    return () => {
      clearInterval(interval);
      unsubscribe();
      clearTimeout((window as any).autosaveTimeout);
    };
  }, [isAuthenticated]);

  // Show loading screen while checking authentication (with timeout protection)
  if (!authInitialized) {
    return (
      <div className="flex h-screen bg-gray-100 items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100 relative">
      {mode === 'model' && <LayerSidebar />}
      {mode === 'training' && <TrainingSidebar />}
      <FlowCanvas />
      
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onContinueWithoutLogin={() => setShowAuthModal(false)}
      />

      {/* User menu */}
      {user && (
        <div className="absolute top-4 right-4 z-50">
          <UserMenu />
        </div>
      )}

      {/* Watermark */}
      <div className="fixed bottom-2 right-2 z-40 pointer-events-none">
        <div className="text-xs text-gray-400 opacity-70 hover:opacity-100 transition-opacity pointer-events-auto">
          <span>made by </span>
          <a 
            href="https://github.com/JavaNoTea/BuildANeuralNet" 
            target="_blank" 
            rel="noopener noreferrer"
            className="hover:text-gray-600 underline underline-offset-2"
          >
            christian king
          </a>
        </div>
      </div>
    </div>
  );
}

