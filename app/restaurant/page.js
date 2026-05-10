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
        setRecentOrders(data || []);

        const today = new Date();
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
        
        const { data: salesData, error: salesError } = await supabase
          .from('orders')
          .select('total_price')
          .eq('status', 'delivered')
          .gte('created_at', startOfDay);

        if (salesError) throw salesError;
        const total = salesData?.reduce((sum, order) => sum + (order.total_price || 0), 0) || 0;
        setDailySales(total);

        const { data: businessData, error: businessError } = await supabase
          .from('orders')
          .select('total_price')
          .eq('status', 'delivered')
          .gte('created_at', startOfDay);

        if (businessError) throw businessError;
        const business = businessData?.reduce((sum, order) => sum + (order.total_price || 0), 0) || 0;
        setTotalBusiness(business);
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
          if (payload.eventType === 'INSERT') {
            setRecentOrders(prev => [payload.new, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setRecentOrders(prev =>
              prev.map(order =>
                order.id === payload.new.id ? { ...order, ...payload.new } : order
              )
            );
            if (payload.new.status === 'delivered') {
              const today = new Date();
              const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
              
              const { data } = await supabase
                .from('orders')
                .select('subtotal')
                .eq('status', 'delivered')
                .gte('created_at', startOfDay);
              const total = data?.reduce((sum, order) => sum + (order.subtotal || 0), 0) || 0;
              setDailySales(total);

              const { data: businessData } = await supabase
                .from('orders')
                .select('total_amount')
                .eq('status', 'delivered')
                .gte('created_at', startOfDay);
              const business = businessData?.reduce((sum, order) => sum + (order.total_amount || 0), 0) || 0;
              setTotalBusiness(business);
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
      pending: 'bg-gray-500/20 text-gray-300',
      preparing: 'bg-yellow-500/20 text-yellow-400',
      out_for_delivery: 'bg-blue-500/20 text-blue-400',
      delivered: 'bg-green-500/20 text-green-400'
    };
    const labels = {
      pending: 'Pending',
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
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-5xl font-bold text-center mb-2 text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-600">
          Create Order
        </h1>
        <p className="text-center text-gray-400 mb-8">Restaurant Management System</p>

        <div className="mb-8">
          <div className="flex flex-wrap justify-center gap-4">
            <div className="backdrop-blur-lg bg-gradient-to-r from-yellow-500/20 to-yellow-600/20 border border-yellow-500/30 rounded-2xl px-8 py-4 shadow-xl shadow-yellow-500/10">
              <div className="text-center">
                <p className="text-yellow-400/80 text-sm font-medium mb-1">Daily Sales</p>
                <p className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-500">
                  ₹{dailySales.toFixed(2)}
                </p>
              </div>
            </div>
            <div className="backdrop-blur-lg bg-gradient-to-r from-green-500/20 to-green-600/20 border border-green-500/30 rounded-2xl px-8 py-4 shadow-xl shadow-green-500/10">
              <div className="text-center">
                <p className="text-green-400/80 text-sm font-medium mb-1">Total Business</p>
                <p className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-300 to-green-500">
                  ₹{totalBusiness.toFixed(2)}
                </p>
              </div>
            </div>
          </div>
          <div className="text-center mt-4">
            <button
              onClick={signOut}
              className="text-gray-500 hover:text-gray-400 text-sm"
            >
              Sign Out
            </button>
          </div>
        </div>

        <div className="backdrop-blur-lg bg-white/5 border border-yellow-500/20 rounded-2xl p-8 shadow-2xl shadow-yellow-500/10">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-yellow-400 font-semibold mb-2">Restaurant Name</label>
              <input
                type="text"
                name="restaurant_name"
                value={formData.restaurant_name}
                onChange={handleChange}
                required
                className="w-full bg-black/50 border border-yellow-500/30 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500 transition-all"
                placeholder="Enter restaurant name"
              />
            </div>

            <div>
              <label className="block text-yellow-400 font-semibold mb-2">Customer Name</label>
              <input
                type="text"
                name="customer_name"
                value={formData.customer_name}
                onChange={handleChange}
                required
                className="w-full bg-black/50 border border-yellow-500/30 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500 transition-all"
                placeholder="Enter customer name"
              />
            </div>

            <div>
              <label className="block text-yellow-400 font-semibold mb-2">Customer Address</label>
              <textarea
                name="customer_address"
                value={formData.customer_address}
                onChange={handleChange}
                required
                rows={3}
                className="w-full bg-black/50 border border-yellow-500/30 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500 transition-all resize-none"
                placeholder="Enter delivery address"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-yellow-400 font-semibold mb-2">Subtotal (₹)</label>
                <input
                  type="number"
                  name="subtotal"
                  value={formData.subtotal}
                  onChange={handleChange}
                  required
                  min="0"
                  step="0.01"
                  className="w-full bg-black/50 border border-yellow-500/30 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500 transition-all"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-yellow-400 font-semibold mb-2">Distance (km)</label>
                <input
                  type="number"
                  name="distance"
                  value={formData.distance}
                  onChange={handleChange}
                  required
                  min="0"
                  step="0.1"
                  className="w-full bg-black/50 border border-yellow-500/30 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500 transition-all"
                  placeholder="0.0"
                />
              </div>
            </div>

            {deliveryFee > 0 && (
              <div className="backdrop-blur-sm bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-gray-300">
                  <span>Subtotal:</span>
                  <span>₹{parseFloat(formData.subtotal).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-300">
                  <span>Delivery Fee:</span>
                  <span>₹{deliveryFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-yellow-400 font-bold text-lg pt-2 border-t border-yellow-500/30">
                  <span>Total:</span>
                  <span>₹{total.toFixed(2)}</span>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-gradient-to-r from-yellow-500 to-yellow-600 text-black font-bold py-4 rounded-lg hover:from-yellow-400 hover:to-yellow-500 transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-lg shadow-yellow-500/20"
            >
              {isSubmitting ? 'Creating Order...' : 'Create Order'}
            </button>
          </form>

          {successMessage && (
            <div className={`mt-6 p-4 rounded-lg text-center font-semibold ${
              successMessage.includes('successfully')
                ? 'bg-green-500/20 border border-green-500/30 text-green-400'
                : 'bg-red-500/20 border border-red-500/30 text-red-400'
            }`}>
              {successMessage}
            </div>
          )}
        </div>

        <div className="mt-10">
          <h2 className="text-2xl font-bold text-center mb-6 text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-600">
            Recent Orders
          </h2>

          {ordersLoading ? (
            <div className="text-center text-gray-500 py-8">Loading orders...</div>
          ) : recentOrders.length === 0 ? (
            <div className="text-center text-gray-500 py-8">No orders yet</div>
          ) : (
            <div className="space-y-3">
              {recentOrders.map((order) => (
                <div
                  key={order.id}
                  className={`backdrop-blur-lg bg-white/5 border rounded-xl p-4 transition-all ${
                    order.status === 'delivered'
                      ? 'border-green-500/30 bg-green-500/5'
                      : 'border-yellow-500/20 hover:border-yellow-500/40'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-white">{order.customer_name}</h3>
                        {getStatusBadge(order.status)}
                      </div>
                      <p className="text-gray-400 text-sm">{order.customer_address}</p>
                      <div className="flex gap-4 mt-2 text-sm text-gray-500">
                        <span>₹{order.total_price?.toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-yellow-400 font-semibold">₹{order.delivery_fee?.toFixed(2)}</p>
                      <p className="text-gray-500 text-xs">delivery</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-8 text-center text-gray-500 text-sm">
          <p>Delivery Fee: ₹50 for &lt;=4km, ₹10/km extra for &gt;4km</p>
          <p className="mt-2">Real-time updates enabled</p>
        </div>
      </div>
    </div>
  );
}