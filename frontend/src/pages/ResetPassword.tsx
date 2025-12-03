import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Lock, Eye, EyeOff, ArrowLeft, Check } from 'lucide-react';
import { auth } from '@/lib/api';

export function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const tokenFromUrl = searchParams.get('token') || '';

  const [token, setToken] = useState(tokenFromUrl);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [success, setSuccess] = useState(false);

  const resetPasswordMutation = useMutation({
    mutationFn: ({ token, password }: { token: string; password: string }) =>
      auth.resetPassword(token, password),
    onSuccess: () => {
      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      return;
    }

    if (password.length < 6) {
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

        <div className="bg-white rounded-2xl shadow-xl p-8">
          {!success ? (
            <>
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Lock className="w-8 h-8 text-indigo-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Reset Password</h2>
                <p className="text-gray-500 mt-2">Enter your new password below</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {!tokenFromUrl && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Reset Token
                    </label>
                    <input
                      type="text"
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono text-sm"
                      placeholder="Paste your reset token"
                      required
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    New Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="Enter new password"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                  {password && !passwordLongEnough && (
                    <p className="text-xs text-red-500 mt-1">
                      Password must be at least 6 characters
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                        confirmPassword && !passwordsMatch
                          ? 'border-red-300'
                          : 'border-gray-300'
                      }`}
                      placeholder="Confirm new password"
                      required
                    />
                  </div>
                  {confirmPassword && !passwordsMatch && (
                    <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
                  )}
                </div>

                {resetPasswordMutation.isError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                    {(resetPasswordMutation.error as any)?.response?.data?.detail ||
                      'Failed to reset password'}
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
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Password Reset!</h2>
              <p className="text-gray-500 mt-2">
                Your password has been reset successfully.
              </p>
              <p className="text-gray-500 mt-1">Redirecting to login...</p>
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
                <ArrowLeft size={16} />
                Back to Login
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
