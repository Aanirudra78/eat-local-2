'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

export default function RiderPage() {
  const [pendingOrders, setPendingOrders] = useState([]);
  const [activeOrders, setActiveOrders] = useState([]);
  const [deliveredOrders, setDeliveredOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [acceptingId, setAcceptingId] = useState(null);
  const [deliveringId, setDeliveringId] = useState(null);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [activeTab, setActiveTab] = useState('orders');
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
          .eq('rider_id', user.id)
          .order('created_at', { ascending: false });

        if (activeError) throw activeError;
        setActiveOrders(activeData || []);

        const { data: deliveredData, error: deliveredError } = await supabase
          .from('orders')
          .select('*')
          .eq('status', 'delivered')
          .eq('rider_id', user.id)
          .order('created_at', { ascending: false });

        if (deliveredError) throw deliveredError;
        setDeliveredOrders(deliveredData || []);

        const { data: earningsData, error: earningsError } = await supabase
          .from('orders')
          .select('total_price')
          .eq('status', 'delivered')
          .eq('rider_id', user.id);

        console.log('Earnings raw data:', earningsData);
        if (earningsError) throw earningsError;
        
        const rawSum = earningsData?.reduce((sum, order) => sum + (Number(order.total_price) || 0), 0) || 0;
        const allTotal = Math.round(rawSum * 10) / 100;
        const finalEarning = Math.round(allTotal * 100) / 100;
        console.log('Total earnings calculated:', finalEarning);
        setTotalEarnings(finalEarning);
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
          if (payload.eventType === 'INSERT' && payload.new.status === 'pending') {
            console.log('New order received:', payload.new);
            setPendingOrders(prev => {
              const exists = prev.some(o => o.id === payload.new.id);
              if (exists) return prev;
              return [payload.new, ...prev];
            });
          } else if (payload.eventType === 'UPDATE') {
            if (payload.new.status === 'accepted' && payload.new.rider_id === user.id) {
              setActiveOrders(prev => {
                const exists = prev.some(o => o.id === payload.new.id);
                if (exists) return prev;
                return [{ ...payload.new }, ...prev];
              });
              setPendingOrders(prev => prev.filter(o => o.id !== payload.new.id));
            } else if (payload.new.status === 'delivered' && payload.new.rider_id === user.id) {
              setActiveOrders(prev => prev.filter(o => o.id !== payload.new.id));
              setDeliveredOrders(prev => {
                const exists = prev.some(o => o.id === payload.new.id);
                if (exists) return prev;
                return [{ ...payload.new }, ...prev];
              });
              setTotalEarnings(prev => prev + (Number(payload.new.total_price) || 0) * 0.1);
            }
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
      
      const { data: orderData } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();
      
      if (orderData) {
        console.log('Order delivered, amount:', orderData.total_price);
        const orderAmount = Number(orderData.total_price) || 0;
        const earning = Math.round(orderAmount * 10) / 100;
        console.log('Earning added:', earning);
        setTotalEarnings(prev => Math.round((prev + earning) * 100) / 100);
        setDeliveredOrders(prev => [{ ...orderData, status: 'delivered' }, ...prev]);
      }
    } catch (error) {
      console.error('Error delivering order:', error.message);
    } finally {
      setDeliveringId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FDF5E6] flex items-center justify-center">
        <div className="text-[#800000] text-xl font-semibold animate-pulse">
          Loading Orders...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDF5E6] text-[#4A0404] p-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-6xl font-rustico text-[#800000] drop-shadow-[0_2px_2px_rgba(75,0,130,0.3)]">
            YUMMYY
          </h1>
          <p className="text-[#800000]/60 mt-2">Accept deliveries and earn</p>
        </div>

        <div className="mb-8 flex flex-col items-center">
          <div className="backdrop-blur-sm bg-white/80 border border-[#800000]/20 rounded-2xl px-8 py-4 shadow-sm">
              <div className="text-center">
                <p className="text-[#800000]/80 text-sm font-medium mb-1">Your Total Earnings</p>
                <p className="text-3xl font-bold text-[#800000]">
                  ₹{totalEarnings.toFixed(2)}
                </p>
              </div>
            </div>
          <div className="mt-2 flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${connectionStatus === 'connected' ? 'bg-green-500' : connectionStatus === 'connecting' ? 'bg-[#800000] animate-pulse' : 'bg-red-500'}`}></div>
            <span className="text-[#800000]/50 text-xs">Realtime: {connectionStatus}</span>
          </div>
          <button
            onClick={async () => { await signOut(); router.push('/login'); }}
            className="mt-4 text-[#800000]/50 hover:text-[#800000] text-sm"
          >
            Sign Out
          </button>
        </div>

        <div className="mb-8">
          <div className="flex justify-center gap-4">
            <button
              onClick={() => setActiveTab('orders')}
              className={`px-6 py-3 rounded-xl font-semibold transition-all ${
                activeTab === 'orders'
                  ? 'bg-[#800000] text-white shadow-lg'
                  : 'bg-white/80 text-[#800000] border border-[#800000]/20'
              }`}
            >
              Orders Around You
            </button>
            <button
              onClick={() => setActiveTab('deliveries')}
              className={`px-6 py-3 rounded-xl font-semibold transition-all ${
                activeTab === 'deliveries'
                  ? 'bg-[#800000] text-white shadow-lg'
                  : 'bg-white/80 text-[#800000] border border-[#800000]/20'
              }`}
            >
              My Deliveries {activeOrders.length > 0 && `(${activeOrders.length})`}
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-6 py-3 rounded-xl font-semibold transition-all ${
                activeTab === 'history'
                  ? 'bg-[#800000] text-white shadow-lg'
                  : 'bg-white/80 text-[#800000] border border-[#800000]/20'
              }`}
            >
              History {deliveredOrders.length > 0 && `(${deliveredOrders.length})`}
            </button>
          </div>
        </div>

        {activeTab === 'deliveries' && (
          <div className="mb-10">
            {activeOrders.length === 0 ? (
              <div className="backdrop-blur-sm bg-white/80 border border-[#800000]/20 rounded-2xl p-12 text-center">
                <div className="text-6xl mb-4">📦</div>
                <h2 className="text-2xl font-semibold text-[#4A0404] mb-2">No active deliveries</h2>
                <p className="text-[#800000]/50">Go to "Orders Around You" to start earning!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {activeOrders.map((order) => (
                  <div
                    key={order.id}
                    className="backdrop-blur-sm bg-white/80 border-2 border-[#800000] rounded-2xl p-6 shadow-sm"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-xl font-bold text-[#4A0404]">{order.customer_name}</h3>
                        <p className="text-[#800000]/50 text-sm">{order.restaurant_name}</p>
                      </div>
                      <span className="px-3 py-1 bg-[#800000] text-white text-sm font-semibold rounded-full animate-pulse">
                        Delivering
                      </span>
                    </div>

                    <div className="space-y-3 mb-6">
                      <div className="flex items-start gap-3">
                        <span className="text-[#800000]/50">📍</span>
                        <p className="text-[#4A0404] text-sm">{order.customer_address}</p>
                      </div>
                      <div className="flex justify-between text-sm border-t border-[#800000]/20 pt-2">
                        <span className="text-[#800000]/50">Total:</span>
                        <span className="text-[#800000] font-bold">₹{order.total_price?.toFixed(2) || '0.00'}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeliver(order.id)}
                      disabled={deliveringId === order.id}
                      className="w-full bg-[#800000] text-white font-rustico uppercase tracking-wider py-4 rounded-xl hover:shadow-[0_0_20px_rgba(75,0,130,0.4)] transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                    >
                      {deliveringId === order.id ? 'Delivering...' : 'Mark as Delivered'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'orders' && (
          <>
            {pendingOrders.length === 0 ? (
              <div className="backdrop-blur-sm bg-white/80 border border-[#800000]/20 rounded-2xl p-12 text-center">
                <div className="text-6xl mb-4">🚴</div>
                <h2 className="text-2xl font-semibold text-[#4A0404] mb-2">No Pending Orders</h2>
                <p className="text-[#800000]/50">New orders will appear here in real-time</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {pendingOrders.map((order) => (
                  <div
                    key={order.id}
                    className="backdrop-blur-sm bg-white/80 border border-[#800000]/20 rounded-2xl p-6 hover:border-[#800000]/40 transition-all shadow-sm"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-xl font-bold text-[#4A0404]">{order.customer_name}</h3>
                        <p className="text-[#800000]/50 text-sm">{order.restaurant_name}</p>
                      </div>
                      <span className="px-3 py-1 bg-[#800000]/20 text-[#800000] text-sm font-semibold rounded-full">
                        Pending
                      </span>
                    </div>

                    <div className="space-y-3 mb-6">
                      <div className="flex items-start gap-3">
                        <span className="text-[#800000]/50">📍</span>
                        <p className="text-[#4A0404] text-sm">{order.customer_address}</p>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-[#800000]/50">Total:</span>
                        <span className="text-[#800000] font-semibold">₹{order.total_price?.toFixed(2) || '0.00'}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleAccept(order.id)}
                      disabled={acceptingId === order.id}
                      className="w-full bg-[#800000] text-white font-semibold py-3 rounded-xl hover:shadow-[0_0_20px_rgba(75,0,130,0.4)] transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                    >
                      {acceptingId === order.id ? 'Accepting...' : 'Accept Delivery'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
)}

        {activeTab === 'history' && (
          <div className="mb-10">
            {deliveredOrders.length === 0 ? (
              <div className="backdrop-blur-sm bg-white/80 border border-[#800000]/20 rounded-2xl p-12 text-center">
                <div className="text-6xl mb-4">📋</div>
                <h2 className="text-2xl font-semibold text-[#4A0404] mb-2">No delivery history</h2>
                <p className="text-[#800000]/50">Complete deliveries to see your history here</p>
              </div>
            ) : (
              <div className="space-y-4">
                <h2 className="text-2xl font-bold text-center mb-6 text-[#800000]">Delivery History</h2>
                {deliveredOrders.map((order) => (
                  <div
                    key={order.id}
                    className="backdrop-blur-sm bg-white/80 border border-[#800000]/10 rounded-xl p-4 shadow-sm"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="font-semibold text-[#800000]">{order.customer_name}</h3>
                        <p className="text-[#800000]/60 text-sm">{order.customer_address}</p>
                        <p className="text-[#800000]/40 text-xs mt-1">
                          {new Date(order.created_at).toLocaleDateString('en-IN', { 
                            day: 'numeric', 
                            month: 'short', 
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[#800000] font-bold">₹{(order.total_price * 0.1).toFixed(2)}</p>
                        <span className="px-2 py-1 bg-green-500/20 text-green-700 text-xs font-semibold rounded-full">
                          Delivered
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="mt-8 text-center text-[#800000]/50 text-sm">
          <p>Real-time updates enabled • Status changes reflect instantly</p>
        </div>
      </div>
    </div>
  );
}