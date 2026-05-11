'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { calculateDeliveryFee } from '@/lib/pricing';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

export default function RestaurantPage() {
  const { user, role, loading: authLoading, signOut } = useAuth();
  const router = useRouter();
  const [formData, setFormData] = useState({
    restaurant_name: '',
    customer_name: '',
    customer_address: '',
    subtotal: '',
    distance: ''
  });
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recentOrders, setRecentOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [dailySales, setDailySales] = useState(0);
  const [totalBusiness, setTotalBusiness] = useState(0);

const fetchDailySales = async () => {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
    
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('subtotal')
        .eq('status', 'delivered')
        .gte('created_at', startOfDay);

      if (error) throw error;
      const total = data?.reduce((sum, order) => sum + (order.subtotal || 0), 0) || 0;
      setDailySales(total);
    } catch (error) {
      console.error('Error fetching daily sales:', error.message);
    }
  };

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }

    if (!role || role !== 'restaurant') {
      router.push('/login');
      return;
    }

    (async () => {
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(20);

        if (error) throw error;
        console.log('Recent orders fetched:', data);
        setRecentOrders(data || []);

        const today = new Date();
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
        
        const { data: salesData, error: salesError } = await supabase
          .from('orders')
          .select('total_price')
          .eq('status', 'delivered');

        console.log('Restaurant sales data:', salesData);
        if (salesError) throw salesError;
        const rawTotal = salesData?.reduce((sum, order) => sum + (Number(order.total_price) || 0), 0) || 0;
        const total = Math.round(rawTotal * 100) / 100;
        console.log('Total sell calculated:', total);
        setDailySales(total);

        const { count, error: businessError } = await supabase
          .from('orders')
          .select('id', { count: 'exact' });

        console.log('Total business count:', count);
        if (businessError) throw businessError;
        setTotalBusiness(count || 0);
      } catch (error) {
        console.error('Error fetching data:', error.message);
      } finally {
        setOrdersLoading(false);
      }
    })();

    const channel = supabase
      .channel('restaurant-orders')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders'
        },
        async (payload) => {
          console.log('Realtime event:', payload.eventType, payload.new);
          if (payload.eventType === 'INSERT') {
            setRecentOrders(prev => [payload.new, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setRecentOrders(prev =>
              prev.map(order =>
                order.id === payload.new.id ? { ...order, ...payload.new } : order
              )
            );
            if (payload.new.status === 'delivered') {
              const { data: salesData } = await supabase
                .from('orders')
                .select('total_price')
                .eq('status', 'delivered');
              const total = salesData?.reduce((sum, order) => sum + (Number(order.total_price) || 0), 0) || 0;
              setDailySales(total);

              const { count } = await supabase
                .from('orders')
                .select('id', { count: 'exact' });
              setTotalBusiness(count || 0);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    const deliveredOrders = recentOrders.filter(o => o.status === 'delivered');
    if (deliveredOrders.length > 0) {
      const timers = deliveredOrders.map(order => {
        return setTimeout(() => {
          setRecentOrders(prev => prev.filter(o => o.id !== order.id));
        }, 60000);
      });
      return () => timers.forEach(clearTimeout);
    }
  }, [recentOrders]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    if (name === 'distance' && value !== '') {
      const distance = parseFloat(value);
      const fee = calculateDeliveryFee(distance);
      setDeliveryFee(fee);
    } else if (name === 'distance' && value === '') {
      setDeliveryFee(0);
    }
  };

  const handleAcceptOrder = async (orderId) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: 'accepted' })
        .eq('id', orderId);

      if (error) throw error;
      setRecentOrders(prev => 
        prev.map(o => o.id === orderId ? { ...o, status: 'accepted' } : o)
      );
    } catch (error) {
      console.error('Error accepting order:', error.message);
    }
  };

  const handleRejectOrder = async (orderId) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: 'rejected' })
        .eq('id', orderId);

      if (error) throw error;
      setRecentOrders(prev => 
        prev.map(o => o.id === orderId ? { ...o, status: 'rejected' } : o)
      );
    } catch (error) {
      console.error('Error rejecting order:', error.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSuccessMessage('');

    if (!user) {
      setError('Please login first');
      setIsSubmitting(false);
      return;
    }

    const orderItems = [
      {
        name: formData.customer_name,
        price: parseFloat(formData.subtotal)
      }
    ];

    try {
      const { error } = await supabase
        .from('orders')
        .insert([
          {
            customer_name: formData.customer_name,
            items: orderItems,
            total_price: parseFloat(formData.subtotal) + deliveryFee,
            status: 'pending',
            restaurant_id: user.id,
            customer_address: formData.customer_address,
            delivery_fee: deliveryFee
          }
        ]);

      if (error) throw error;

      setSuccessMessage('Order created successfully!');
      setFormData({
        restaurant_name: '',
        customer_name: '',
        customer_address: '',
        subtotal: '',
        distance: ''
      });
      setDeliveryFee(0);
    } catch (error) {
      console.error('Error details:', error.message, error.details, error.hint);
      setSuccessMessage('Error creating order. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'bg-[#800000]/10 text-[#800000]/70 border border-[#800000]/10',
      accepted: 'bg-[#800000]/20 text-[#800000] border border-[#800000]/20',
      preparing: 'bg-purple-500/20 text-purple-700 border border-purple-500/20',
      out_for_delivery: 'bg-blue-500/20 text-blue-700 border border-blue-500/20',
      delivered: 'bg-green-500/20 text-green-700 border border-green-500/20'
    };
    const labels = {
      pending: 'Pending',
      accepted: 'Accepted',
      preparing: 'Preparing',
      out_for_delivery: 'Out for Delivery',
      delivered: 'Delivered'
    };
    return (
      <span className={`px-3 py-1 text-xs font-semibold rounded-full ${styles[status] || styles.pending}`}>
        {labels[status] || 'Pending'}
      </span>
    );
  };

  const total = formData.subtotal ? parseFloat(formData.subtotal) + deliveryFee : 0;

  return (
    <div className="min-h-screen bg-[#FDF5E6] text-[#4A0404] p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-6xl font-rustico text-center text-[#800000] drop-shadow-[0_2px_2px_rgba(75,0,130,0.3)]">
          YUMMYY
        </h1>
        <p className="text-center text-[#800000]/60 mb-8">Create Order</p>

        <div className="mb-8">
          <div className="flex flex-wrap justify-center gap-4">
            <div className="backdrop-blur-sm bg-white/80 border border-[#800000]/20 rounded-2xl px-8 py-4 shadow-sm">
              <div className="text-center">
                <p className="text-[#800000]/80 text-sm font-medium mb-1">Total Sell</p>
                <p className="text-3xl font-bold text-[#800000]">
                  ₹{dailySales.toFixed(2)}
                </p>
              </div>
            </div>
            <div className="backdrop-blur-sm bg-white/80 border border-[#800000]/20 rounded-2xl px-8 py-4 shadow-sm">
              <div className="text-center">
                <p className="text-[#800000]/80 text-sm font-medium mb-1">Total Orders</p>
                <p className="text-3xl font-bold text-[#800000]">
                  {totalBusiness}
                </p>
              </div>
            </div>
          </div>
          <div className="text-center mt-4">
            <button
              onClick={async () => { await signOut(); router.push('/login'); }}
              className="text-[#800000]/50 hover:text-[#800000] text-sm"
            >
              Sign Out
            </button>
          </div>
        </div>

        <div className="backdrop-blur-sm bg-white/80 border border-[#800000]/20 rounded-2xl p-8 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-[#4A0404] font-semibold mb-2">Restaurant Name</label>
              <input
                type="text"
                name="restaurant_name"
                value={formData.restaurant_name}
                onChange={handleChange}
                required
                className="w-full bg-white/50 border border-[#800000]/10 rounded-lg px-5 py-4 text-[#4A0404] placeholder-[#800000]/30 focus:outline-none focus:border-[#800000] transition-all"
                placeholder="Enter restaurant name"
              />
            </div>

            <div>
              <label className="block text-[#4A0404] font-semibold mb-2">Customer Name</label>
              <input
                type="text"
                name="customer_name"
                value={formData.customer_name}
                onChange={handleChange}
                required
                className="w-full bg-white/50 border border-[#800000]/10 rounded-lg px-5 py-4 text-[#4A0404] placeholder-[#800000]/30 focus:outline-none focus:border-[#800000] transition-all"
                placeholder="Enter customer name"
              />
            </div>

            <div>
              <label className="block text-[#4A0404] font-semibold mb-2">Customer Address</label>
              <textarea
                name="customer_address"
                value={formData.customer_address}
                onChange={handleChange}
                required
                rows={3}
                className="w-full bg-white/50 border border-[#800000]/10 rounded-lg px-5 py-4 text-[#4A0404] placeholder-[#800000]/30 focus:outline-none focus:border-[#800000] transition-all resize-none"
                placeholder="Enter delivery address"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-[#4A0404] font-semibold mb-2">Subtotal (₹)</label>
                <input
                  type="number"
                  name="subtotal"
                  value={formData.subtotal}
                  onChange={handleChange}
                  required
                  min="0"
                  step="0.01"
                  className="w-full bg-white/50 border border-[#800000]/10 rounded-lg px-5 py-4 text-[#4A0404] placeholder-[#800000]/30 focus:outline-none focus:border-[#800000] transition-all"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-[#4A0404] font-semibold mb-2">Distance (km)</label>
                <input
                  type="number"
                  name="distance"
                  value={formData.distance}
                  onChange={handleChange}
                  required
                  min="0"
                  step="0.1"
                  className="w-full bg-white/50 border border-[#800000]/10 rounded-lg px-5 py-4 text-[#4A0404] placeholder-[#800000]/30 focus:outline-none focus:border-[#800000] transition-all"
                  placeholder="0.0"
                />
              </div>
            </div>

            {deliveryFee > 0 && (
              <div className="backdrop-blur-sm bg-[#800000]/10 border border-[#800000]/30 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-[#4A0404]">
                  <span>Subtotal:</span>
                  <span>₹{parseFloat(formData.subtotal).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[#4A0404]">
                  <span>Delivery Fee:</span>
                  <span>₹{deliveryFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[#800000] font-bold text-lg pt-2 border-t border-[#800000]/30">
                  <span>Total:</span>
                  <span>₹{total.toFixed(2)}</span>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-[#800000] text-white font-semibold py-4 rounded-xl hover:shadow-[0_0_20px_rgba(75,0,130,0.4)] transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {isSubmitting ? 'Creating Order...' : 'Create Order'}
            </button>
          </form>

          {successMessage && (
            <div className={`mt-6 p-4 rounded-xl text-center font-semibold flex items-center justify-center gap-2 ${
              successMessage.includes('successfully')
                ? 'bg-green-500/20 border border-green-500/30 text-green-700'
                : 'bg-red-500/20 border border-red-500/30 text-red-600'
            }`}>
              {successMessage.includes('successfully') && <span className="text-lg">✓</span>}
              {successMessage}
            </div>
          )}
        </div>

        <div className="mt-10">
          <h2 className="text-2xl font-bold text-center mb-6 text-[#4A0404]">
            Recent Orders
          </h2>

          {ordersLoading ? (
            <div className="text-center text-[#800000]/50 py-8">Loading orders...</div>
          ) : recentOrders.length === 0 ? (
            <div className="text-center text-[#800000]/50 py-8">No orders yet</div>
          ) : (
            <div className="space-y-3">
              {recentOrders.map((order, index) => (
                <div
                  key={order.id}
                  className={`backdrop-blur-sm border rounded-xl p-4 transition-all shadow-sm ${
                    index % 2 === 0 ? 'bg-white' : 'bg-[#FFFDD0]/50'
                  } ${
                    order.status === 'delivered'
                      ? 'border-green-500/30'
                      : 'border-[#800000]/20 hover:border-[#800000]/40'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-[#800000]">{order.customer_name}</h3>
                        {getStatusBadge(order.status)}
                      </div>
                      <p className="text-[#800000]/60 text-sm">{order.customer_address}</p>
                      <div className="flex gap-4 mt-2 text-sm text-[#800000]/50">
                        <span>₹{order.total_price?.toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="text-right flex flex-col gap-2">
                      <p className="text-[#800000] font-semibold">₹{order.delivery_fee?.toFixed(2)}</p>
                      {order.status === 'pending' && (
                        <div className="flex gap-2 mt-2">
                          <button 
                            onClick={() => handleAcceptOrder(order.id)}
                            className="bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-green-600 transition"
                          >
                            Accept
                          </button>
                          <button 
                            onClick={() => handleRejectOrder(order.id)}
                            className="bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-red-600 transition"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-8 text-center text-[#800000]/50 text-sm">
          <p>Delivery Fee: ₹50 for &lt;=4km, ₹10/km extra for &gt;4km</p>
          <p className="mt-2">Real-time updates enabled</p>
        </div>
      </div>
    </div>
  );
}