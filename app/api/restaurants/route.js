import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('restaurants')
      .select('*')
      .order('rating', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ restaurants: data });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    
    const restaurants = [
      {
        name: 'The Royal Kitchens',
        image_url: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80',
        rating: 4.8,
        price_for_two: 1200,
        tags: ['Fine Dining', 'North Indian', 'Luxury'],
        location: 'Connaught Place, Delhi'
      },
      {
        name: 'Spice Garden',
        image_url: 'https://images.unsplash.com/photo-1552566626-52f8b828add9?w=800&q=80',
        rating: 4.5,
        price_for_two: 800,
        tags: ['Asian', 'Chinese', 'Thai'],
        location: 'Cyber City, Gurgaon'
      },
      {
        name: 'La Milano',
        image_url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&q=80',
        rating: 4.7,
        price_for_two: 1500,
        tags: ['Italian', 'Pizzeria', 'Wine Bar'],
        location: 'Sector 56, Gurgaon'
      },
      {
        name: 'Bengal Spice',
        image_url: 'https://images.unsplash.com/photo-1567337710282-00832b415979?w=800&q=80',
        rating: 4.6,
        price_for_two: 600,
        tags: ['Bengali', 'Seafood', 'Authentic'],
        location: 'Park Street, Kolkata'
      },
      {
        name: 'The Burger Vault',
        image_url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80',
        rating: 4.4,
        price_for_two: 500,
        tags: ['American', 'Burgers', 'Fast Food'],
        location: 'MG Road, Bangalore'
      }
    ];

    const { data, error } = await supabase
      .from('restaurants')
      .upsert(restaurants, { onConflict: 'name' })
      .select();

    if (error) throw error;
    return NextResponse.json({ success: true, restaurants: data });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}