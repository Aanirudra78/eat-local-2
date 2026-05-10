'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

export default function RiderPage() {
  const [pendingOrders, setPendingOrders] = useState([]);
  const [activeOrders, setActiveOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [acceptingId, setAcceptingId] = useState(null);
  const [deliveringId, setDeliveringId] = useState(null);
  const [todayEarnings, setTodayEarnings] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const { user, role, loading: authLoading } = useAuth();
  const router = useRouter();
  const { signOut } = useAuth();
  const channelRef = useRef(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }

    if (!role || role !== 'rider') {
      router.push('/login');
      return;
    }

    const fetchOrders = async () => {
      try {
        const { data: pendingData, error: pendingError } = await supabase
          .from('orders')
          .select('*')
          .eq('status', 'pending')
          .order('created_at', { ascending: false });

        if (pendingError) throw pendingError;
        setPendingOrders(pendingData || []);

        const { data: activeData, error: activeError } = await supabase
          .from('orders')
          .select('*')
          .eq('status', 'accepted')
          .order('created_at', { ascending: false });

        if (activeError) throw activeError;
        setActiveOrders(activeData || []);

        const today = new Date();
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();

        const { data: earningsData, error: earningsError } = await supabase
          .from('orders')
          .select('total_price')
          .eq('status', 'delivered')
          .gte('created_at', startOfDay);

        if (earningsError) throw earningsError;
        const total = earningsData?.reduce((sum, order) => sum + ((order.total_price || 0) * 0.1), 0) || 0;
        setTodayEarnings(total);
      } catch (error) {
        console.error('Error fetching data:', error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();

    const channel = supabase
      .channel('orders-realtime-' + user.id)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders'
        },
        (payload) => {
          console.log('Realtime payload:', payload);
          if (payload.eventType === 'INSERT') {
            console.log('New order received:', payload.new);
            setPendingOrders(prev => {
              const exists = prev.some(o => o.id === payload.new.id);
              if (exists) return prev;
              return [payload.new, ...prev];
            });
          }
        }
      )
      .subscribe((status) => {
        console.log('REALTIME_STATUS:', status);
        setConnectionStatus(status === 'SUBSCRIBED' ? 'connected' : status.toLowerCase());
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user, authLoading, role]);

  const handleAccept = async (orderId) => {
    setAcceptingId(orderId);
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          status: 'accepted',
          rider_id: user.id
        })
        .eq('id', orderId);

      if (error) throw error;
      setPendingOrders(prev => prev.filter(order => order.id !== orderId));
      setActiveOrders(prev => {
        const acceptedOrder = pendingOrders.find(o => o.id === orderId);
        if (acceptedOrder) {
          return [{ ...acceptedOrder, status: 'accepted', rider_id: user.id }, ...prev];
        }
        return prev;
      });
    } catch (error) {
      console.error('Error accepting order:', error.message);
    } finally {
      setAcceptingId(null);
    }
  };

  const handleDeliver = async (orderId) => {
    setDeliveringId(orderId);
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: 'delivered', rider_id: user.id })
        .eq('id', orderId);

      if (error) throw error;

      setActiveOrders(prev => prev.filter(order => order.id !== orderId));
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
      const { data } = await supabase
        .from('orders')
        .select('total_price')
        .eq('status', 'delivered')
        .gte('created_at', startOfDay);
      const total = data?.reduce((sum, order) => sum + ((order.total_price || 0) * 0.1), 0) || 0;
      setTodayEarnings(total);
    } catch (error) {
      console.error('Error delivering order:', error.message);
    } finally {
      setDeliveringId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-yellow-500 text-xl font-semibold animate-pulse">
          Loading Orders...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-600 mb-2">
            Rider Dashboard
          </h1>
          <p className="text-gray-400">Accept deliveries and earn</p>
        </div>

        <div className="mb-8 flex flex-col items-center">
          <div className="inline-flex backdrop-blur-lg bg-gradient-to-r from-yellow-500/20 to-yellow-600/20 border border-yellow-500/30 rounded-2xl px-8 py-4 shadow-xl shadow-yellow-500/10">
            <div className="text-center">
              <p className="text-yellow-400/80 text-sm font-medium mb-1">Today&apos;s Earnings</p>
              <p className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-500">
                ₹{todayEarnings.toFixed(2)}
              </p>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${connectionStatus === 'connected' ? 'bg-green-500' : connectionStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'}`}></div>
            <span className="text-gray-500 text-xs">Realtime: {connectionStatus}</span>
          </div>
          <button
            onClick={signOut}
            className="mt-4 text-gray-500 hover:text-gray-400 text-sm"
          >
            Sign Out
          </button>
        </div>

        {activeOrders.length > 0 && (
          <div className="mb-10">
            <h2 className="text-2xl font-bold text-center mb-6 text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-600">
              Active Delivery
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {activeOrders.map((order) => (
                <div
                  key={order.id}
                  className="backdrop-blur-lg bg-gradient-to-br from-yellow-500/10 to-yellow-600/10 border border-yellow-500/40 rounded-2xl p-6 shadow-xl shadow-yellow-500/10"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-yellow-400">{order.customer_name}</h3>
                      <p className="text-gray-500 text-sm">New Order</p>
                    </div>
                    <span className="px-3 py-1 bg-yellow-500/30 text-yellow-300 text-sm font-semibold rounded-full animate-pulse">
                      Delivering
                    </span>
                  </div>

                  <div className="space-y-3 mb-6">
                    <div className="flex items-start gap-3">
                      <span className="text-gray-500">📍</span>
                      <p className="text-gray-300 text-sm">{order.customer_address}</p>
                    </div>
                    <div className="flex justify-between text-sm border-t border-yellow-500/20 pt-2">
                      <span className="text-gray-500">Total:</span>
                      <span className="text-yellow-400 font-bold">₹{order.total_price?.toFixed(2) || '0.00'}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDeliver(order.id)}
                    disabled={deliveringId === order.id}
                    className="w-full bg-gradient-to-r from-yellow-500 to-yellow-600 text-black font-bold py-4 rounded-lg hover:from-yellow-400 hover:to-yellow-500 transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-lg shadow-yellow-500/30 text-lg"
                  >
                    {deliveringId === order.id ? 'Delivering...' : 'Mark as Delivered'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {pendingOrders.length === 0 && activeOrders.length === 0 ? (
          <div className="backdrop-blur-lg bg-white/5 border border-yellow-500/20 rounded-2xl p-12 text-center">
            <div className="text-6xl mb-4">🚴</div>
            <h2 className="text-2xl font-semibold text-gray-300 mb-2">No Pending Orders</h2>
            <p className="text-gray-500">New orders will appear here in real-time</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pendingOrders.map((order) => (
              <div
                key={order.id}
                className="backdrop-blur-lg bg-white/5 border border-yellow-500/20 rounded-2xl p-6 hover:border-yellow-500/50 transition-all shadow-xl shadow-yellow-500/5"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-yellow-400">{order.customer_name}</h3>
                    <p className="text-gray-500 text-sm">{order.restaurant_name}</p>
                  </div>
                  <span className="px-3 py-1 bg-yellow-500/20 text-yellow-400 text-sm font-semibold rounded-full">
                    Pending
                  </span>
                </div>

                <div className="space-y-3 mb-6">
                  <div className="flex items-start gap-3">
                    <span className="text-gray-500">📍</span>
                    <p className="text-gray-300 text-sm">{order.customer_address}</p>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Total:</span>
                    <span className="text-yellow-400 font-semibold">₹{order.total_price?.toFixed(2) || '0.00'}</span>
                  </div>
                </div>

                <button
                  onClick={() => handleAccept(order.id)}
                  disabled={acceptingId === order.id}
                  className="w-full bg-gradient-to-r from-yellow-500 to-yellow-600 text-black font-bold py-3 rounded-lg hover:from-yellow-400 hover:to-yellow-500 transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-lg shadow-yellow-500/20"
                >
                  {acceptingId === order.id ? 'Accepting...' : 'Accept Delivery'}
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 text-center text-gray-500 text-sm">
          <p>Real-time updates enabled • Status changes reflect instantly</p>
        </div>
      </div>
    </div>
  );
}