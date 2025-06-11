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
      setLoading(true);
      
      // Check if we have stored tokens
      if (accessToken) {
        try {
          // Validate token by getting current user
          const user = await api.getCurrentUser();
          // Token is valid, update auth state with user data
          setAuth(user, accessToken, useAuthStore.getState().refreshToken || '');
        } catch (error) {
          console.log('Stored token invalid, clearing auth');
          // Token is invalid, clear stored auth
          logout();
        }
      }
      
      setLoading(false);
      setAuthInitialized(true);
    };

    initializeAuth();
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

  // Show loading screen while checking authentication
  if (isLoading || !authInitialized) {
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

