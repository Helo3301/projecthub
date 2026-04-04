import { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Lock, Eye, EyeOff, ArrowLeft, Check } from 'lucide-react';
import axios from 'axios';
import { auth } from '@/lib/api';

export function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const tokenFromUrl = searchParams.get('token') || '';
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const [token, setToken] = useState(tokenFromUrl);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  // Sync token from URL when navigating with a token param (e.g. back/forward)
  useEffect(() => {
    if (tokenFromUrl) setToken(tokenFromUrl);
  }, [tokenFromUrl]);

  const resetPasswordMutation = useMutation({
    mutationFn: ({ token, password }: { token: string; password: string }) =>
      auth.resetPassword(token, password),
    onSuccess: () => {
      setSuccess(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => navigate('/login'), 3000);
    },
  });

  const [validationError, setValidationError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');

    if (password.length < 6) {
      setValidationError('Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      setValidationError('Passwords do not match');
      return;
    }

    resetPasswordMutation.mutate({ token, password });
  };

  const passwordsMatch = password === confirmPassword;
  const passwordLongEnough = password.length >= 6;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white">
            Project<span className="text-indigo-400">Hub</span>
          </h1>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
          {!success ? (
            <>
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Lock className="w-8 h-8 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Reset Password</h2>
                <p className="text-gray-500 dark:text-gray-400 mt-2">Enter your new password below</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {!tokenFromUrl && (
                  <div>
                    <label htmlFor="reset-token" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Reset Token
                    </label>
                    <input
                      id="reset-token"
                      type="text"
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono text-sm"
                      placeholder="Paste your reset token"
                      required
                    />
                  </div>
                )}

                <div>
                  <label htmlFor="reset-new-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    New Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" aria-hidden="true" />
                    <input
                      id="reset-new-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-12 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="Enter new password"
                      required
                      autoComplete="new-password"
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      {showPassword ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
                    </button>
                  </div>
                  {password && !passwordLongEnough && (
                    <p aria-live="polite" className="text-xs text-red-500 mt-1">
                      Password must be at least 6 characters
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="reset-confirm-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" aria-hidden="true" />
                    <input
                      id="reset-confirm-password"
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100 ${
                        confirmPassword && !passwordsMatch
                          ? 'border-red-300 dark:border-red-600'
                          : 'border-gray-300 dark:border-gray-600'
                      }`}
                      placeholder="Confirm new password"
                      required
                      autoComplete="new-password"
                    />
                  </div>
                  {confirmPassword && !passwordsMatch && (
                    <p aria-live="polite" className="text-xs text-red-500 mt-1">Passwords do not match</p>
                  )}
                </div>

                {validationError && (
                  <div role="alert" className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
                    {validationError}
                  </div>
                )}

                {resetPasswordMutation.isError && (
                  <div role="alert" className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
                    {axios.isAxiosError(resetPasswordMutation.error) && resetPasswordMutation.error.response?.data?.detail
                      ? resetPasswordMutation.error.response.data.detail
                      : 'Failed to reset password'}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={
                    resetPasswordMutation.isPending ||
                    !passwordsMatch ||
                    !passwordLongEnough ||
                    !token
                  }
                  className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {resetPasswordMutation.isPending ? 'Resetting...' : 'Reset Password'}
                </button>
              </form>
            </>
          ) : (
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-green-600 dark:text-green-400" aria-hidden="true" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Password Reset!</h2>
              <p className="text-gray-500 dark:text-gray-400 mt-2">
                Your password has been reset successfully.
              </p>
              <p className="text-gray-500 dark:text-gray-400 mt-1">Redirecting to login...</p>
              <Link
                to="/login"
                className="inline-block mt-4 text-indigo-600 hover:text-indigo-700 font-medium"
              >
                Go to Login Now
              </Link>
            </div>
          )}

          {!success && (
            <div className="mt-6 text-center">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-700 font-medium"
              >
                <ArrowLeft size={16} aria-hidden="true" />
                Back to Login
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
