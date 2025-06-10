'use client';

import { useState, useEffect } from 'react';
import LayerSidebar from '@/components/LayerSidebar';
import FlowCanvas from '@/components/FlowCanvas';
import AuthModal from '@/components/AuthModal';
import UserMenu from '@/components/UserMenu';
import { useFlowStore } from '@/stores/flowStore';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/lib/api';

export default function Home() {
  const { mode } = useFlowStore();
  const { isAuthenticated, user } = useAuthStore();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [hasSeenAuthModal, setHasSeenAuthModal] = useState(false);

  // Show auth modal on first visit
  useEffect(() => {
    if (!hasSeenAuthModal && !isAuthenticated) {
      setTimeout(() => {
        setShowAuthModal(true);
        setHasSeenAuthModal(true);
      }, 1000); // Show after 1 second
    }
  }, [hasSeenAuthModal, isAuthenticated]);

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

  return (
    <div className="flex h-screen bg-gray-100">
      {mode !== 'code' && <LayerSidebar />}
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
    </div>
  );
}

