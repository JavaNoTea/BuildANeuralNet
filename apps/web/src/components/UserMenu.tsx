'use client';

import { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { User, LogOut, Save, ChevronDown } from 'lucide-react';

export default function UserMenu() {
  const { user, logout } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);

  if (!user) return null;

  const handleLogout = () => {
    logout();
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 bg-white rounded-lg shadow px-4 py-2 text-sm hover:shadow-md transition-shadow"
      >
        <User size={16} className="text-gray-900" />
        <span className="font-semibold text-gray-900">{user.username}</span>
        <ChevronDown size={16} className={`transition-transform text-gray-900 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          {/* Click outside to close */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg py-1 z-20">
            <div className="px-4 py-2 border-b">
              <p className="text-xs text-gray-600">Signed in as</p>
              <p className="text-sm font-medium truncate text-gray-900">{user.email}</p>
            </div>
            
            <button
              onClick={() => {
                // TODO: Implement saved models modal
                setIsOpen(false);
              }}
              className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center gap-2 text-gray-900"
            >
              <Save size={16} />
              Saved Models
            </button>
            
            <hr className="my-1" />
            
            <button
              onClick={handleLogout}
              className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 text-red-700 flex items-center gap-2 font-medium"
            >
              <LogOut size={16} />
              Logout
            </button>
          </div>
        </>
      )}
    </div>
  );
} 