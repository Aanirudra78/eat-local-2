'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const userRole = user.user_metadata?.role;

        if (userRole === 'restaurant') {
          router.push('/restaurant');
        } else if (userRole === 'rider') {
          router.push('/rider');
        } else {
          router.push('/login');
        }
      }
    };

    checkUser();
  }, [router]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-yellow-400 mb-4">Eat Local</h1>
        <p className="text-gray-400">Loading...</p>
      </div>
    </div>
  );
}