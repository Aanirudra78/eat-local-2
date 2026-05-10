import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY is not set');
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export async function POST(request) {
  try {
    if (!supabaseServiceKey) {
      return Response.json({ error: 'Server configuration error: Service key missing' }, { status: 500 });
    }

    const { email, password, role } = await request.json();

    if (!email || !password || !role) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { data: existingUser, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    let existing = null;
    if (listError) {
      console.error('List users error:', listError);
    } else if (existingUser?.users) {
      existing = existingUser.users.find(u => u.email === email);
    }

    let data, error;
    
    if (existing) {
      const { data: updatedData, error: updateError } = await supabaseAdmin.auth.admin.updateUser(existing.id, {
        password,
        email_confirm: true,
        user_metadata: { role }
      });
      data = { user: updatedData.user };
      error = updateError;
    } else {
      const result = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { role }
      });
      data = result.data;
      error = result.error;
    }

    if (error) {
      console.error('User error:', error);
      throw error;
    }

    if (data?.user) {
      try {
        const { error: profileError } = await supabaseAdmin
          .from('profiles')
          .upsert([{ id: data.user.id, role }], { onConflict: 'id' });
        
        if (profileError) {
          console.log('Profile upsert skipped (RLS issue):', profileError.message);
        }
      } catch (e) {
        console.log('Profile creation skipped');
      }
    }

    return Response.json({ success: true, user: data.user });
  } catch (error) {
    console.error('API Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}