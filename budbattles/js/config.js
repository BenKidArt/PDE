// APP SETTINGS. The only file you may ever need to touch by hand.
export const CONFIG = {
  // Supabase connection. Both values are public and safe to share.
  // Leave them empty to run in demo mode (data stays on this device).
  supabaseUrl: 'https://chjkseolzvdtlurafvim.supabase.co',
  supabaseKey: 'sb_publishable_PUh0RWXSPQSO8UGYeY9BJQ_9EmSTyRo', // the "publishable" key (older projects call it "anon public")

  // Cloudflare Turnstile bot check (sign-up, login, voting). The SITE key is public.
  // Leave empty to switch the bot check off. The SECRET key never goes here.
  turnstileSiteKey: '0x4AAAAAAF8BgK-6C32_fg0V',

  // Anti-cheat: at most this many accounts per device (checked again by the database when voting).
  accountsPerDevice: 3,

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
