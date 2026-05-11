'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

const categories = [
  { id: 1, name: 'Pizza', emoji: '🍕' },
  { id: 2, name: 'Burgers', emoji: '🍔' },
  { id: 3, name: 'Biryani', emoji: '🍚' },
  { id: 4, name: 'Chinese', emoji: '🥡' },
  { id: 5, name: 'Italian', emoji: '🍝' },
  { id: 6, name: 'Desserts', emoji: '🍰' },
];

const mockRestaurants = [
  { id: 1, name: 'The Royal Kitchens', location: 'Connaught Place, Delhi', rating: 4.8, price_for_two: 1200, tags: ['Fine Dining', 'North Indian'], image_url: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80' },
  { id: 2, name: 'Spice Garden', location: 'Cyber City, Gurgaon', rating: 4.5, price_for_two: 800, tags: ['Asian', 'Chinese'], image_url: 'https://images.unsplash.com/photo-1552566626-52f8b828add9?w=800&q=80' },
  { id: 3, name: 'La Milano', location: 'Sector 56, Gurgaon', rating: 4.7, price_for_two: 1500, tags: ['Italian', 'Pizzeria'], image_url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&q=80' },
  { id: 4, name: 'Bengal Spice', location: 'Park Street, Kolkata', rating: 4.6, price_for_two: 600, tags: ['Bengali', 'Seafood'], image_url: 'https://images.unsplash.com/photo-1567337710282-00832b415979?w=800&q=80' },
  { id: 5, name: 'The Burger Vault', location: 'MG Road, Bangalore', rating: 4.4, price_for_two: 500, tags: ['American', 'Burgers'], image_url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80' },
  { id: 6, name: 'Spice Route', location: 'Bandra, Mumbai', rating: 4.3, price_for_two: 900, tags: ['Multi-cuisine', 'Fine Dining'], image_url: 'https://images.unsplash.com/photo-1552566626-52f8b828add9?w=800&q=80' },
];

export default function Home() {
  const router = useRouter();
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    checkUser();

    // Use mock data instead of database
    setTimeout(() => {
      setRestaurants(mockRestaurants);
      setLoading(false);
    }, 500);
  }, []);

  const filteredRestaurants = selectedCategory
    ? restaurants.filter(r => r.tags?.some(t => t.toLowerCase().includes(selectedCategory.toLowerCase())))
    : restaurants;

  return (
    <div className="min-h-screen bg-[#FFFDD0]">
      {/* Navigation */}
      <nav className="bg-white/90 backdrop-blur-md border-b border-[#800000]/10 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-3xl font-rustico text-[#800000] drop-shadow-md">YUMMYY</h1>
          <div className="flex gap-4 items-center">
            <button 
              onClick={() => router.push('/customer')}
              className="text-[#800000] font-semibold hover:text-[#4B0082] transition"
            >
              Track Order
            </button>
            <button 
              onClick={() => router.push('/login')}
              className="bg-[#800000] text-white px-6 py-2 rounded-xl font-semibold hover:shadow-lg hover:shadow-[#800000]/30 transition"
            >
              Login
            </button>
            {user && (
              <div className="flex gap-2 ml-4">
                <button 
                  onClick={() => router.push('/restaurant')}
                  className="text-[#4B0082] text-sm font-semibold hover:underline"
                >
                  Restaurant
                </button>
                <button 
                  onClick={() => router.push('/rider')}
                  className="text-[#4B0082] text-sm font-semibold hover:underline"
                >
                  Rider
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative bg-gradient-to-r from-[#800000] to-[#4B0082] py-16">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <h2 className="text-4xl md:text-5xl font-rustico text-white mb-4">
            Discover Premium Dining
          </h2>
          <p className="text-white/80 text-lg mb-8">
            Experience luxury food at your fingertips
          </p>
          <div className="flex justify-center gap-4">
            <button className="bg-white text-[#800000] px-8 py-3 rounded-xl font-semibold shadow-lg">
              Order Now
            </button>
            <button className="border-2 border-white text-white px-8 py-3 rounded-xl font-semibold hover:bg-white/10 transition">
              Explore Menu
            </button>
          </div>
        </div>
      </div>

      {/* Categories */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h3 className="text-2xl font-bold text-[#800000] mb-4">Explore Categories</h3>
        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(selectedCategory === cat.name ? null : cat.name)}
              className={`flex-shrink-0 px-6 py-3 rounded-2xl font-semibold transition-all duration-300 ${
                selectedCategory === cat.name
                  ? 'bg-[#800000] text-white shadow-lg'
                  : 'bg-white text-[#800000] border border-[#800000]/20 hover:border-[#800000]/50'
              }`}
            >
              <span className="mr-2">{cat.emoji}</span>
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Featured Restaurants */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h3 className="text-2xl font-bold text-[#800000] mb-6">
          {selectedCategory ? `${selectedCategory} Restaurants` : 'Featured Restaurants'}
        </h3>
        
        {loading ? (
          <div className="text-center py-12">
            <div className="text-[#800000] text-xl animate-pulse">Loading deliciousness...</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRestaurants.map((restaurant, index) => (
              <div
                key={restaurant.id}
                className="group bg-white rounded-2xl border border-[#800000]/10 overflow-hidden hover:border-[#800000]/30 hover:shadow-xl hover:shadow-[#4B0082]/10 transition-all duration-300 hover:scale-[1.02]"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="relative h-48 overflow-hidden">
                  <img
                    src={restaurant.image_url || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80'}
                    alt={restaurant.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                  <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full">
                    <span className="text-[#800000] font-bold">⭐ {restaurant.rating}</span>
                  </div>
                </div>
                
                <div className="p-5">
                  <h4 className="text-xl font-bold text-[#800000] mb-2 group-hover:text-[#4B0082] transition">
                    {restaurant.name}
                  </h4>
                  <p className="text-[#800000]/60 text-sm mb-3">{restaurant.location}</p>
                  
                  <div className="flex flex-wrap gap-2 mb-3">
                    {restaurant.tags?.map((tag, i) => (
                      <span 
                        key={i}
                        className="px-3 py-1 bg-[#4B0082]/10 text-[#4B0082] text-xs font-medium rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  
                  <div className="flex justify-between items-center pt-3 border-t border-[#800000]/10">
                    <span className="text-[#800000] font-semibold">
                      ₹{restaurant.price_for_two} for two
                    </span>
                    <button className="bg-[#800000] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#4B0082] transition shadow-md">
                      Order
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Access Links */}
      <div className="max-w-6xl mx-auto px-4 py-6 mt-4 text-center border-t border-[#800000]/10">
        <p className="text-[#800000]/60 text-sm mb-3">Test the dashboards:</p>
        <div className="flex justify-center gap-3 flex-wrap">
          <button onClick={() => router.push('/login')} className="px-4 py-2 bg-[#800000] text-white rounded-lg text-sm font-semibold">Login</button>
          <button onClick={() => router.push('/restaurant')} className="px-4 py-2 bg-[#4B0082] text-white rounded-lg text-sm font-semibold">Restaurant</button>
          <button onClick={() => router.push('/rider')} className="px-4 py-2 bg-[#800000] text-white rounded-lg text-sm font-semibold">Rider</button>
          <button onClick={() => router.push('/customer')} className="px-4 py-2 bg-[#4B0082] text-white rounded-lg text-sm font-semibold">Customer</button>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-[#800000] text-white py-8 mt-4">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <h3 className="text-2xl font-rustico mb-4">YUMMYY</h3>
          <p className="text-white/70">Premium Food Delivery • Luxury Dining Experience</p>
          <p className="text-white/50 text-sm mt-4">© 2026 YUMMYY. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}