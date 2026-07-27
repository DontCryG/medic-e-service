import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const customFetch = async (url, options) => {
  const timeoutMs = 10000;
  let isDone = false;
  
  const timeoutTracker = setTimeout(() => {
    if (!isDone && window.sendErrorToDiscord) {
      window.sendErrorToDiscord(
        '⚠️ Warning: Data loading timeout (Exceeded 10 seconds). The database might be unresponsive.',
        `No crash occurred. This is a manual assertion triggered because the API did not return data within 10000ms.\nRequest URL: ${url}`,
        window.location.href
      );
    }
  }, timeoutMs);

  try {
    const response = await fetch(url, options);
    isDone = true;
    clearTimeout(timeoutTracker);
    return response;
  } catch (error) {
    isDone = true;
    clearTimeout(timeoutTracker);
    throw error;
  }
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: customFetch
  }
});
