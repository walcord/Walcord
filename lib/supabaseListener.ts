import { supabase } from './supabaseClient';

export function initSupabaseAuthListener() {
  supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session?.user) {
      const user = session.user;

      // 1. Verificamos si ya existe un perfil
      const { data: existingProfile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .single();

      if (!existingProfile) {
        // 2. Creamos un username automáticamente a partir del email o nombre
        const fullName = user.user_metadata?.full_name || '';
        const baseUsername =
          fullName?.trim().toLowerCase().replace(/\s+/g, '') ||
          user.email?.split('@')[0] ||
          'user';

        let finalUsername = `@${baseUsername}`;
        let counter = 1;

        // 3. Asegurarse de que el username sea único
        while (true) {
          const { data: usernameExists } = await supabase
            .from('profiles')
            .select('id')
            .eq('username', finalUsername)
            .maybeSingle();

          if (!usernameExists) break;

          counter++;
          finalUsername = `@${baseUsername}${counter}`;
        }

        // 4. Insertar perfil
        const { error: insertError } = await supabase.from('profiles').insert({
          id: user.id,
          full_name: fullName,
          username: finalUsername,
          avatar_url: user.user_metadata?.avatar_url || '',
          created_at: new Date().toISOString(),
        });

        if (insertError) {
          console.error('Error creating profile:', insertError.message);
        } else {
          console.log('✅ Profile created for:', user.email);
        }
      }
    }
  });
}