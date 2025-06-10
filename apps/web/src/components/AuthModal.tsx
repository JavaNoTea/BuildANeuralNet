'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/lib/api';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onContinueWithoutLogin: () => void;
}

export default function AuthModal({ isOpen, onClose, onContinueWithoutLogin }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);

  const { setAuth, setTokens } = useAuthStore();

  // Password strength checker
  const getPasswordStrength = (password: string) => {
    const checks = [
      { test: password.length >= 8, text: 'At least 8 characters' },
      { test: /[A-Z]/.test(password), text: 'One uppercase letter' },
      { test: /[a-z]/.test(password), text: 'One lowercase letter' },
      { test: /\d/.test(password), text: 'One number' },
      { test: /[!@#$%^&*(),.?":{}|<>]/.test(password), text: 'One special character' },
      { test: !/(.)\1{2,}/.test(password), text: 'No repeating characters (aaa)' },
      { test: !/(012|123|234|345|456|567|678|789|890|abc|bcd|cde|def)/i.test(password), text: 'No sequential patterns (123, abc)' },
    ];
    
    const passedChecks = checks.filter(check => check.test).length;
    const strength = passedChecks / checks.length;
    
    return { 
      checks, 
      strength,
      color: strength < 0.5 ? 'text-red-500' : strength < 0.8 ? 'text-yellow-500' : 'text-green-500',
      bgColor: strength < 0.5 ? 'bg-red-200' : strength < 0.8 ? 'bg-yellow-200' : 'bg-green-200'
    };
  };

  useEffect(() => {
    if (!isOpen) {
      // Reset form when modal closes
      setEmail('');
      setUsername('');
      setPassword('');
      setConfirmPassword('');
      setError('');
      setVerificationSent(false);
    }
  }, [isOpen]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.login(email, password);
      
      // Store tokens first
      setTokens(response.access_token, response.refresh_token);
      
      // Get user info (now with token available)
      const user = await api.getCurrentUser();
      
      // Update with user data
      setAuth(user, response.access_token, response.refresh_token);
      
      onClose();
    } catch (err: any) {
      setError(err.detail || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    // Enhanced password validation to match backend
    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    if (!/[A-Z]/.test(password)) {
      setError('Password must contain at least one uppercase letter');
      return;
    }

    if (!/[a-z]/.test(password)) {
      setError('Password must contain at least one lowercase letter');
      return;
    }

    if (!/\d/.test(password)) {
      setError('Password must contain at least one number');
      return;
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      setError('Password must contain at least one special character (!@#$%^&* etc.)');
      return;
    }

    // Check for common patterns that backend will reject
    if (/(.)\1{2,}/.test(password)) {
      setError('Password cannot contain three consecutive identical characters');
      return;
    }

    if (/(012|123|234|345|456|567|678|789|890|abc|bcd|cde|def)/i.test(password)) {
      setError('Password cannot contain common sequential patterns (like 123 or abc)');
      return;
    }

    const commonPasswords = ['password', '123456', 'password123', 'admin', 'qwerty', 'letmein', 'welcome', 'monkey'];
    if (commonPasswords.includes(password.toLowerCase())) {
      setError('This password is too common. Please choose a more unique password.');
      return;
    }

    setLoading(true);

    try {
      await api.register(email, username, password);
      setVerificationSent(true);
    } catch (err: any) {
      console.error('Registration error:', err);
      setError(err.message || err.detail || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0, 0, 0, 0.35)' }}>
      <div className="bg-white rounded-lg max-w-md w-full p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <X size={24} />
        </button>

        {verificationSent ? (
          <div className="text-center py-8">
            <h2 className="text-2xl font-bold mb-4">Check Your Email</h2>
            <p className="text-gray-600 mb-6">
              We've sent a verification email to <strong>{email}</strong>.
              Please check your inbox and click the link to verify your account.
            </p>
            <button
              onClick={onClose}
              className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
            >
              OK
            </button>
          </div>
        ) : (
          <>
            <h2 className="text-2xl font-bold mb-6 text-gray-900">
              {mode === 'login' ? 'Welcome Back' : 'Create Account'}
            </h2>

            <form onSubmit={mode === 'login' ? handleLogin : handleSignup}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-900">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    required
                  />
                </div>

                {mode === 'signup' && (
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-900">Username</label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                      required
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-900">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    required
                  />
                  {mode === 'signup' && password && (
                    <div className="mt-2">
                      <div className="text-xs text-gray-600 mb-1">Password strength:</div>
                      <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                        <div 
                          className={`h-2 rounded-full transition-all duration-300 ${getPasswordStrength(password).bgColor}`}
                          style={{ width: `${getPasswordStrength(password).strength * 100}%` }}
                        />
                      </div>
                      <div className="text-xs space-y-1">
                        {getPasswordStrength(password).checks.map((check, index) => (
                          <div key={index} className={`flex items-center ${check.test ? 'text-green-600' : 'text-gray-400'}`}>
                            <span className="mr-1">{check.test ? '✓' : '○'}</span>
                            {check.text}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {mode === 'signup' && (
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-900">Confirm Password</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                      required
                    />
                  </div>
                )}

                {error && (
                  <div className="text-red-600 text-sm">{String(error)}</div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Loading...' : mode === 'login' ? 'Login' : 'Sign Up'}
                </button>
              </div>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-800">
                {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
                <button
                  onClick={() => {
                    setMode(mode === 'login' ? 'signup' : 'login');
                    setError('');
                  }}
                  className="text-blue-600 hover:underline"
                >
                  {mode === 'login' ? 'Sign up' : 'Log in'}
                </button>
              </p>
            </div>

            <div className="mt-6 pt-6 border-t">
              <button
                onClick={onContinueWithoutLogin}
                className="w-full text-gray-800 py-2 border rounded hover:bg-gray-50"
              >
                Continue Without Account
              </button>
              <p className="text-xs text-gray-500 text-center mt-2">
                You won't be able to save your models online
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
} 