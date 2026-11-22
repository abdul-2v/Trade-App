import 'react-native-url-polyfill/auto';
import 'expo-sqlite/localStorage/install';
import { createClient } from '@supabase/supabase-js';
import {AppState,Platform} from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// A single Supabase Auth project owns identities for Tradarr on iPhone and web.
// Refuse to register a separate account in a mistakenly configured project.
const TRADARR_AUTH_HOST='sjwedfdwqxfrnpruiqnq.supabase.co';
let sharedAccountProject=false;
try {
  const address=new URL(supabaseUrl||'');
  sharedAccountProject=address.protocol==='https:'&&address.hostname===TRADARR_AUTH_HOST;
} catch { /* Missing or malformed environment setting. */ }
if (!supabaseUrl || !supabasePublishableKey || !sharedAccountProject) {
  throw new Error('Tradarr account service is not configured for the shared website/iPhone Supabase project.');
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    storage: localStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// React Native has no browser visibility events. Keep session refresh active
// while foregrounded and stop background refresh to avoid stalled sessions.
// Register once at the shared Supabase client, not once per screen.
if(Platform.OS!=='web'){
  if(AppState.currentState==='active')supabase.auth.startAutoRefresh();
  AppState.addEventListener('change',state=>{
    if(state==='active')supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
