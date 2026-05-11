'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';

const mockRestaurants = [
  { id: 1, name: 'The Royal Kitchens', rating: 4.8, price_for_two: 1200, tags: ['Fine Dining', 'North Indian'], image_url: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&q=80', location: 'Connaught Place' },
  { id: 2, name: 'Spice Garden', rating: 4.5, price_for_two: 800, tags: ['Asian', 'Chinese'], image_url: 'https://images.unsplash.com/photo-1552566626-52f8b828add9?w=600&q=80', location: 'Cyber City' },
  { id: 3, name: 'La Milano', rating: 4.7, price_for_two: 1500, tags: ['Italian', 'Pizzeria'], image_url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=600&q=80', location: 'Sector 56' },
  { id: 4, name: 'Bengal Spice', rating: 4.6, price_for_two: 600, tags: ['Bengali', 'Seafood'], image_url: 'https://images.unsplash.com/photo-1567337710282-00832b415979?w=600&q=80', location: 'Park Street' },
  { id: 5, name: 'The Burger Vault', rating: 4.4, price_for_two: 500, tags: ['American', 'Burgers'], image_url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&q=80', location: 'MG Road' },
];

export default function CustomerPage() {
  const [customerName, setCustomerName] = useState('');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [restaurants, setRestaurants] = useState([]);
  const channelRef = useRef(null);

  useEffect(() => {
    // Fetch restaurants from database or use mock
    setRestaurants(mockRestaurants);

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, []);

  const steps = [
    { status: 'pending', label: 'Order Placed' },
    { status: 'accepted', label: 'Rider Assigned' },
    { status: 'out_for_delivery', label: 'On the Way' },
    { status: 'delivered', label: 'Delivered' }
  ];

  const getStepStatus = (orderStatus, stepStatus) => {
    const statusOrder = ['pending', 'accepted', 'out_for_delivery', 'delivered'];
    const currentIndex = statusOrder.indexOf(orderStatus);
    const stepIndex = statusOrder.indexOf(stepStatus);
    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'active';
    return 'pending';
  };

  const getProgressWidth = (status) => {
    const statusOrder = ['pending', 'accepted', 'out_for_delivery', 'delivered'];
    const currentIndex = statusOrder.indexOf(status);
    if (currentIndex === -1) return 0;
    return (currentIndex / (steps.length - 1)) * 100;
  };

  const searchOrders = async () => {
    if (!customerName.trim()) return;
    setLoading(true);
    setSearched(true);
    
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .ilike('customer_name', `%${customerName.trim()}%`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('Error fetching orders:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') searchOrders();
  };

  return (
    <div className="min-h-screen bg-[#FFFDF5]">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b-2 border-[#800000] sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-4xl font-rustico text-[#800000] drop-shadow-md">YUMMYY</h1>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${connectionStatus === 'connected' ? 'bg-green-500' : 'bg-[#4B0082] animate-pulse'}`}></div>
            <span className="text-[#800000]/60 text-sm">Live</span>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Search Bar */}
        <div className="mb-8">
          <div className="flex gap-4 max-w-2xl mx-auto">
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Enter your name to track order"
              className="flex-1 bg-white border-2 border-[#800000]/30 rounded-xl px-5 py-4 text-[#800000] placeholder-[#800000]/40 focus:outline-none focus:border-[#800000] transition-all shadow-sm"
            />
            <button
              onClick={searchOrders}
              disabled={loading || !customerName.trim()}
              className="bg-gradient-to-r from-[#800000] to-[#4B0082] text-white font-semibold px-8 py-4 rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition-all disabled:opacity-50"
            >
              {loading ? 'Searching...' : 'Track Order'}
            </button>
          </div>
        </div>

        {/* Premium Dining - Horizontal Scroll */}
        {!searched && (
          <div className="mb-10">
            <h2 className="text-2xl font-bold text-[#800000] mb-4">Premium Dining</h2>
            <div className="flex gap-6 overflow-x-auto pb-4 scrollbar-hide">
              {restaurants.map((restaurant) => (
                <div
                  key={restaurant.id}
                  onClick={() => setSelectedRestaurant(selectedRestaurant?.id === restaurant.id ? null : restaurant)}
                  className={`flex-shrink-0 w-72 bg-white rounded-2xl border-2 border-[#800000] overflow-hidden cursor-pointer hover:shadow-xl hover:shadow-[#4B0082]/20 transition-all duration-300 hover:scale-105 ${
                    selectedRestaurant?.id === restaurant.id ? 'ring-4 ring-[#4B0082]/30' : ''
                  }`}
                >
                  <div className="relative h-40 overflow-hidden">
                    <img
                      src={restaurant.image_url}
                      alt={restaurant.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-full flex items-center gap-1">
                      <span className="text-yellow-500">⭐</span>
                      <span className="text-[#800000] font-bold text-sm">{restaurant.rating}</span>
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="text-lg font-bold text-[#800000] mb-1">{restaurant.name}</h3>
                    <p className="text-[#800000]/60 text-sm mb-2">{restaurant.location}</p>
                    <div className="flex flex-wrap gap-1">
                      {restaurant.tags?.slice(0, 2).map((tag, i) => (
                        <span key={i} className="px-2 py-0.5 bg-[#4B0082]/10 text-[#4B0082] text-xs rounded-full">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Selected Restaurant Info */}
        {selectedRestaurant && !searched && (
          <div className="bg-white/80 backdrop-blur-sm border-2 border-[#800000] rounded-2xl p-6 mb-8 shadow-lg">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-2xl font-bold text-[#800000]">{selectedRestaurant.name}</h3>
                <p className="text-[#800000]/60">{selectedRestaurant.location}</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-[#800000]">₹{selectedRestaurant.price_for_two}</p>
                <p className="text-[#800000]/50 text-sm">for two</p>
              </div>
            </div>
          </div>
        )}

        {/* Orders Section */}
        {searched && (
          orders.length === 0 ? (
            <div className="bg-white/80 backdrop-blur-sm border-2 border-[#800000]/20 rounded-2xl p-12 text-center">
              <div className="text-6xl mb-4">🍽️</div>
              <h2 className="text-2xl font-bold text-[#800000] mb-2">No orders found</h2>
              <p className="text-[#800000]/60">Try searching with your exact name</p>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((order, index) => (
                <div
                  key={order.id}
                  className={`bg-white/80 backdrop-blur-sm border-2 border-[#800000]/20 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all ${
                    index % 2 === 0 ? 'bg-white' : 'bg-[#FFFDF5]'
                  }`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-[#800000]">{order.customer_name}</h3>
                      <p className="text-[#800000]/60 text-sm">{order.customer_address}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-[#800000]">₹{order.total_price?.toFixed(2)}</p>
                      <span className={`px-4 py-1 text-xs font-semibold rounded-full inline-block mt-1 ${
                        order.status === 'delivered' 
                          ? 'bg-green-500/20 text-green-700'
                          : order.status === 'accepted'
                          ? 'bg-[#4B0082]/20 text-[#4B0082]'
                          : 'bg-yellow-500/20 text-yellow-700'
                      }`}>
                        {order.status === 'pending' ? 'Pending' :
                         order.status === 'accepted' ? 'Confirmed' :
                         order.status === 'out_for_delivery' ? 'On the Way' :
                         order.status === 'delivered' ? 'Delivered' : order.status}
                      </span>
                    </div>
                  </div>

                  {/* Progress Tracker */}
                  <div className="relative py-4">
                    <div className="flex justify-between items-center">
                      {steps.map((step, idx) => {
                        const stepStatus = getStepStatus(order.status, step.status);
                        return (
                          <div key={step.status} className="flex flex-col items-center flex-1 relative z-10">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                              stepStatus === 'completed' 
                                ? 'bg-[#800000] text-white'
                                : stepStatus === 'active'
                                ? 'bg-[#4B0082] text-white ring-2 ring-[#4B0082]/50 animate-pulse'
                                : 'bg-[#FFFDF5] border-2 border-[#800000]/30 text-[#800000]/40'
                            }`}>
                              {stepStatus === 'completed' ? '✓' : idx + 1}
                            </div>
                            <p className={`text-xs mt-2 text-center ${stepStatus !== 'pending' ? 'text-[#800000] font-semibold' : 'text-[#800000]/40'}`}>
                              {step.label}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                    <div className="absolute top-4 left-0 right-0 h-1 bg-[#800000]/20 rounded-full mx-4">
                      <div 
                        className="h-full bg-gradient-to-r from-[#800000] to-[#4B0082] rounded-full transition-all duration-500"
                        style={{ width: `${getProgressWidth(order.status)}%` }}
                      />
                    </div>
                  </div>

                  {order.status === 'delivered' && (
                    <div className="mt-4 p-3 bg-green-500/10 border border-green-500/20 rounded-xl text-center">
                      <p className="text-green-700 font-semibold">🎉 Your YUMMYY meal has arrived. Enjoy!</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}