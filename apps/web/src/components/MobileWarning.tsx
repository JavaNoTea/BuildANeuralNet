'use client';

import { useState, useEffect } from 'react';

export default function MobileWarning() {
  const [isMobile, setIsMobile] = useState(false);
  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      // Check for mobile using multiple methods for better accuracy
      const userAgent = navigator.userAgent.toLowerCase();
      const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile/i;
      const isMobileUserAgent = mobileRegex.test(userAgent);
      
      // Also check screen size (tablets might not be caught by user agent)
      const isSmallScreen = window.innerWidth <= 768;
      
      // Check for touch capability
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      
      // Consider it mobile if it matches user agent OR is small screen with touch
      const mobileDetected = isMobileUserAgent || (isSmallScreen && isTouchDevice);
      
      setIsMobile(mobileDetected);
      
      // Only show warning if mobile and user hasn't dismissed it before
      if (mobileDetected && !localStorage.getItem('mobile-warning-dismissed')) {
        setShowWarning(true);
      }
    };

    // Check on mount
    checkMobile();
    
    // Check on resize
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const dismissWarning = () => {
    setShowWarning(false);
    // Remember that user dismissed the warning
    localStorage.setItem('mobile-warning-dismissed', 'true');
  };

  const clearDismissal = () => {
    localStorage.removeItem('mobile-warning-dismissed');
    setShowWarning(true);
  };

  // Don't render anything if not mobile or warning was dismissed
  if (!isMobile || !showWarning) {
    return null;
  }

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-50 backdrop-blur-sm"
        onClick={dismissWarning}
      />
      
      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-sm w-full mx-4 relative animate-in fade-in zoom-in duration-200">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Mobile Device Detected</h3>
            </div>
            <button
              onClick={dismissWarning}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            <div className="flex items-start space-x-3 mb-4">
              <div className="w-6 h-6 text-blue-600 mt-0.5">
                <svg fill="currentColor" viewBox="0 0 24 24">
                  <path d="M13 9h5.5L13 3.5V9M6 2h8l6 6v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4c0-1.11.89-2 2-2m5 2H6v16h12v-9h-7V4z"/>
                </svg>
              </div>
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Desktop Experience Recommended</h4>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Build A Neural Net is designed for desktop computers with larger screens and mouse/keyboard input. 
                  The visual neural network builder requires:
                </p>
              </div>
            </div>

            <ul className="text-sm text-gray-600 space-y-2 mb-6 ml-9">
              <li className="flex items-center space-x-2">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full flex-shrink-0"></span>
                <span>Drag & drop functionality for nodes</span>
              </li>
              <li className="flex items-center space-x-2">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full flex-shrink-0"></span>
                <span>Precise connection drawing between layers</span>
              </li>
              <li className="flex items-center space-x-2">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full flex-shrink-0"></span>
                <span>Complex property editing interfaces</span>
              </li>
              <li className="flex items-center space-x-2">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full flex-shrink-0"></span>
                <span>Large canvas area for network visualization</span>
              </li>
            </ul>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex items-start space-x-2">
                <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-blue-800">
                  <strong>Tip:</strong> For the best experience, visit BuildANeural.net on a desktop or laptop computer.
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 rounded-b-lg">
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={dismissWarning}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
              >
                I Understand
              </button>
              <button
                onClick={dismissWarning}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded-md transition-colors"
              >
                Continue Anyway
              </button>
            </div>
            <p className="text-xs text-gray-500 text-center mt-3">
              This message won't show again on this device
            </p>
          </div>
        </div>
      </div>
    </>
  );
} 