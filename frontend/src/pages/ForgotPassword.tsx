import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Mail, ArrowLeft, Key, Copy, Check } from 'lucide-react';
import { auth } from '@/lib/api';

export function ForgotPassword() {
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const forgotPasswordMutation = useMutation({
    mutationFn: (value: string) => auth.forgotPassword(value),
    onSuccess: (data) => {
      setResetToken(data.reset_token);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    forgotPasswordMutation.mutate(emailOrUsername);
  };

  const copyToken = () => {
    if (resetToken) {
      navigator.clipboard.writeText(resetToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const resetLink = resetToken ? `/reset-password?token=${resetToken}` : '';

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white">
            Project<span className="text-indigo-400">Hub</span>
          </h1>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          {!resetToken ? (
            <>
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Key className="w-8 h-8 text-indigo-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Forgot Password?</h2>
                <p className="text-gray-500 mt-2">
                  Enter your email or username to reset your password
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email or Username
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={emailOrUsername}
                      onChange={(e) => setEmailOrUsername(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="Enter your email or username"
                      required
                    />
                  </div>
                </div>

                {forgotPasswordMutation.isError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                    {(forgotPasswordMutation.error as any)?.response?.data?.detail ||
                      'Failed to process request'}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={forgotPasswordMutation.isPending}
                  className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  {forgotPasswordMutation.isPending ? 'Processing...' : 'Reset Password'}
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Token Generated!</h2>
                <p className="text-gray-500 mt-2">
                  Use this token to reset your password
                </p>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Reset Token</span>
                    <button
                      onClick={copyToken}
                      className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700"
                    >
                      {copied ? <Check size={16} /> : <Copy size={16} />}
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <code className="block text-xs text-gray-600 break-all bg-white p-2 rounded border">
                    {resetToken}
                  </code>
                </div>

                <Link
                  to={resetLink}
                  className="block w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg text-center transition-colors"
                >
                  Continue to Reset Password
                </Link>

                <p className="text-xs text-gray-500 text-center">
                  This token expires in 1 hour
                </p>
              </div>
            </>
          )}

          <div className="mt-6 text-center">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-700 font-medium"
            >
              <ArrowLeft size={16} />
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
