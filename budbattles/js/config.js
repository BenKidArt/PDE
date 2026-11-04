// APP SETTINGS. The only file you may ever need to touch by hand.
export const CONFIG = {
  // Supabase connection. Both values are public and safe to share.
  // Leave them empty to run in demo mode (data stays on this device).
  supabaseUrl: '',
  supabaseKey: '', // the "publishable" key (older projects call it "anon public")

  // Version of the terms people accept at sign-up. Change it when the terms change.
  termsVersion: '2026-11-draft',

  // On/off switches used in DEMO mode. With Supabase, the switches live in
  // the "settings" table instead, so you can flip them from your phone.
  features: {
    partner: true,
    prize: true,
    strain: true,
  },
};

export const isDemo = !CONFIG.supabaseUrl || !CONFIG.supabaseKey;
