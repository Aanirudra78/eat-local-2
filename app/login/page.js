'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('rider');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (isSignUp) {
      try {
        const response = await fetch('/api/create-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, role })
        });

        const result = await response.json();

        if (!response.ok) {
          if (result.error?.includes('already exists')) {
            throw new Error('User already exists. Please sign in instead.');
          }
          throw new Error(result.error || 'Failed to create user');
        }

        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) throw signInError;

        if (role === 'restaurant') {
          router.push('/restaurant');
        } else {
          router.push('/rider');
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) throw signInError;

      if (signInData?.user) {
        const userRole = signInData.user.user_metadata?.role;
        
        if (userRole === 'restaurant') {
          router.push('/restaurant');
        } else if (userRole === 'rider') {
          router.push('/rider');
        } else {
          router.push('/');
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDF5E6] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-6xl font-rustico text-[#800000] drop-shadow-[0_2px_2px_rgba(75,0,130,0.3)]">
            YUMMYY
          </h1>
          <p className="text-[#800000]/60">Sign in to continue</p>
        </div>

        <div className="backdrop-blur-sm bg-white/80 border border-[#800000]/20 rounded-2xl p-8 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-[#4A0404] font-semibold mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-white/50 border border-[#800000]/10 rounded-lg px-5 py-4 text-[#4A0404] placeholder-[#800000]/30 focus:outline-none focus:border-[#800000] transition-all"
                placeholder="your@email.com"
              />
            </div>

            <div>
              <label className="block text-[#4A0404] font-semibold mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full bg-white/50 border border-[#800000]/10 rounded-lg px-5 py-4 text-[#4A0404] placeholder-[#800000]/30 focus:outline-none focus:border-[#800000] transition-all"
                placeholder="Minimum 6 characters"
              />
            </div>

            {isSignUp && (
              <div>
                <label className="block text-[#4A0404] font-semibold mb-2">Select Role</label>
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => setRole('restaurant')}
                    className={`flex-1 py-3 rounded-lg border ${
                      role === 'restaurant'
                        ? 'bg-[#800000]/20 border-[#800000] text-[#800000]'
                        : 'bg-white/30 border-[#800000]/30 text-[#800000]/50'
                    } transition-all`}
                  >
                    Restaurant
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('rider')}
                    className={`flex-1 py-3 rounded-lg border ${
                      role === 'rider'
                        ? 'bg-[#800000]/20 border-[#800000] text-[#800000]'
                        : 'bg-white/30 border-[#800000]/30 text-[#800000]/50'
                    } transition-all`}
                  >
                    Rider
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div className="p-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-600 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#800000] text-white font-semibold py-4 rounded-xl hover:shadow-[0_0_20px_rgba(75,0,130,0.4)] transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {loading ? 'Please wait...' : isSignUp ? 'Sign Up' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-[#800000] hover:text-[#4A0404] text-sm"
            >
              {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}