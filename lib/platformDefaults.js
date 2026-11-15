/**
 * lib/platformDefaults.js
 *
 * What every new casino is created with — held in code, not in a database
 * table and not copied from an existing casino.
 *
 * This used to live in the `platform_defaults` table with a Super Admin screen
 * to edit it. That let the starter set be changed without a deploy, but it was
 * one more thing to set up and keep in sync. Now the starter set is a constant
 * here: a new casino is seeded from it automatically at creation time, so there
 * is nothing to configure. Changing what a new casino starts with is a code
 * edit to STARTER_SETS below.
 *
 * Each row is stored WITHOUT the columns that tie it to one casino (no id, no
 * tenant_id, no created_at/updated_at). applyDefaultsToTenant stamps tenant_id
 * on insert. If a table gains a column, add it here too.
 */

/** key → the table its rows are inserted into. Order is the order applied. */
export const DEFAULT_KINDS = [
  { key: 'player_levels',        table: 'player_levels',        label: 'Player Levels'  },
  { key: 'game_panels',          table: 'game_panels',          label: 'Games'          },
  { key: 'payment_methods',      table: 'payment_methods',      label: 'Payment Methods'},
  { key: 'referral_bonus_tiers', table: 'referral_bonus_tiers', label: 'Referral Tiers' },
  { key: 'platform_settings',    table: 'platform_settings',    label: 'Settings'       },
]

/** The rows every new casino starts with, one array per kind. */
export const STARTER_SETS = {
  player_levels: [
    { name: 'Bronze',   perks: null, min_xp: 0,      is_active: true, badge_icon: null, sort_order: 1, badge_color: '#cd7f32', description: 'Entry level',          xp_required: 0,      accent_color: '#cd7f32', kyc_required: false, display_order: 1, max_redeem_cents: 50000,   min_redeem_cents: 2000, bonus_to_cash_pct: 10, deposit_bonus_pct: 0,  max_deposit_cents: 500000,   min_deposit_cents: 500, redeem_multiplier: 5, max_game_load_cents: 50000,   min_game_load_cents: 500, max_redeem_cap_cents: 50000, max_withdrawal_cents: 100000,  min_withdrawal_cents: 2000, referral_bonus_cents: 0,     max_redeem_multiplier: 5, min_redeem_multiplier: 1, deposit_threshold_cents: 0,      max_daily_withdrawal_cents: 50000,   daily_withdrawal_limit_cents: 50000 },
    { name: 'Silver',   perks: null, min_xp: 500,    is_active: true, badge_icon: null, sort_order: 2, badge_color: '#9ca3af', description: 'Getting started',      xp_required: 500,    accent_color: '#9ca3af', kyc_required: false, display_order: 2, max_redeem_cents: 100000,  min_redeem_cents: 2000, bonus_to_cash_pct: 15, deposit_bonus_pct: 5,  max_deposit_cents: 1000000,  min_deposit_cents: 500, redeem_multiplier: 5, max_game_load_cents: 100000,  min_game_load_cents: 500, max_redeem_cap_cents: 50000, max_withdrawal_cents: 200000,  min_withdrawal_cents: 2000, referral_bonus_cents: 500,   max_redeem_multiplier: 5, min_redeem_multiplier: 1, deposit_threshold_cents: 10000,  max_daily_withdrawal_cents: 100000,  daily_withdrawal_limit_cents: 100000 },
    { name: 'Gold',     perks: null, min_xp: 1500,   is_active: true, badge_icon: null, sort_order: 3, badge_color: '#fbbf24', description: 'Regular player',       xp_required: 1500,   accent_color: '#fbbf24', kyc_required: true,  display_order: 3, max_redeem_cents: 150000,  min_redeem_cents: 2000, bonus_to_cash_pct: 22, deposit_bonus_pct: 10, max_deposit_cents: 2000000,  min_deposit_cents: 500, redeem_multiplier: 5, max_game_load_cents: 150000,  min_game_load_cents: 500, max_redeem_cap_cents: 50000, max_withdrawal_cents: 300000,  min_withdrawal_cents: 2000, referral_bonus_cents: 1000,  max_redeem_multiplier: 5, min_redeem_multiplier: 1, deposit_threshold_cents: 25000,  max_daily_withdrawal_cents: 200000,  daily_withdrawal_limit_cents: 200000 },
    { name: 'Platinum', perks: null, min_xp: 3500,   is_active: true, badge_icon: null, sort_order: 4, badge_color: '#e2e8f0', description: 'Trusted player',       xp_required: 3500,   accent_color: '#e2e8f0', kyc_required: true,  display_order: 4, max_redeem_cents: 200000,  min_redeem_cents: 2000, bonus_to_cash_pct: 25, deposit_bonus_pct: 15, max_deposit_cents: 3000000,  min_deposit_cents: 500, redeem_multiplier: 5, max_game_load_cents: 200000,  min_game_load_cents: 500, max_redeem_cap_cents: 50000, max_withdrawal_cents: 500000,  min_withdrawal_cents: 2000, referral_bonus_cents: 2000,  max_redeem_multiplier: 5, min_redeem_multiplier: 1, deposit_threshold_cents: 50000,  max_daily_withdrawal_cents: 300000,  daily_withdrawal_limit_cents: 300000 },
    { name: 'Diamond',  perks: null, min_xp: 7500,   is_active: true, badge_icon: null, sort_order: 5, badge_color: '#67e8f9', description: 'VIP player',           xp_required: 7500,   accent_color: '#67e8f9', kyc_required: true,  display_order: 5, max_redeem_cents: 300000,  min_redeem_cents: 2000, bonus_to_cash_pct: 30, deposit_bonus_pct: 20, max_deposit_cents: 5000000,  min_deposit_cents: 500, redeem_multiplier: 5, max_game_load_cents: 300000,  min_game_load_cents: 500, max_redeem_cap_cents: 50000, max_withdrawal_cents: 750000,  min_withdrawal_cents: 2000, referral_bonus_cents: 3000,  max_redeem_multiplier: 5, min_redeem_multiplier: 1, deposit_threshold_cents: 100000, max_daily_withdrawal_cents: 500000,  daily_withdrawal_limit_cents: 500000 },
    { name: 'Elite',    perks: null, min_xp: 15000,  is_active: true, badge_icon: null, sort_order: 6, badge_color: '#f87171', description: 'High-value player',    xp_required: 15000,  accent_color: '#f87171', kyc_required: true,  display_order: 6, max_redeem_cents: 500000,  min_redeem_cents: 2000, bonus_to_cash_pct: 35, deposit_bonus_pct: 25, max_deposit_cents: 10000000, min_deposit_cents: 500, redeem_multiplier: 5, max_game_load_cents: 500000,  min_game_load_cents: 500, max_redeem_cap_cents: 50000, max_withdrawal_cents: 1000000, min_withdrawal_cents: 2000, referral_bonus_cents: 5000,  max_redeem_multiplier: 5, min_redeem_multiplier: 1, deposit_threshold_cents: 200000, max_daily_withdrawal_cents: 750000,  daily_withdrawal_limit_cents: 750000 },
    { name: 'Master',   perks: null, min_xp: 30000,  is_active: true, badge_icon: null, sort_order: 7, badge_color: '#a855f7', description: 'Elite grinder',        xp_required: 30000,  accent_color: '#a855f7', kyc_required: true,  display_order: 7, max_redeem_cents: 750000,  min_redeem_cents: 2000, bonus_to_cash_pct: 40, deposit_bonus_pct: 30, max_deposit_cents: 10000000, min_deposit_cents: 500, redeem_multiplier: 5, max_game_load_cents: 750000,  min_game_load_cents: 500, max_redeem_cap_cents: 50000, max_withdrawal_cents: 1500000, min_withdrawal_cents: 2000, referral_bonus_cents: 7500,  max_redeem_multiplier: 5, min_redeem_multiplier: 1, deposit_threshold_cents: 350000, max_daily_withdrawal_cents: 1000000, daily_withdrawal_limit_cents: 1000000 },
    { name: 'Champion', perks: null, min_xp: 60000,  is_active: true, badge_icon: null, sort_order: 8, badge_color: '#f59e0b', description: 'Top tier player',      xp_required: 60000,  accent_color: '#f59e0b', kyc_required: true,  display_order: 8, max_redeem_cents: 1000000, min_redeem_cents: 2000, bonus_to_cash_pct: 45, deposit_bonus_pct: 35, max_deposit_cents: 10000000, min_deposit_cents: 500, redeem_multiplier: 5, max_game_load_cents: 1000000, min_game_load_cents: 500, max_redeem_cap_cents: 50000, max_withdrawal_cents: 2000000, min_withdrawal_cents: 2000, referral_bonus_cents: 10000, max_redeem_multiplier: 5, min_redeem_multiplier: 1, deposit_threshold_cents: 500000, max_daily_withdrawal_cents: 1500000, daily_withdrawal_limit_cents: 1500000 },
    { name: 'Legend',   perks: null, min_xp: 100000, is_active: true, badge_icon: null, sort_order: 9, badge_color: '#fbbf24', description: 'The best of the best', xp_required: 100000, accent_color: '#fbbf24', kyc_required: true,  display_order: 9, max_redeem_cents: 2000000, min_redeem_cents: 2000, bonus_to_cash_pct: 50, deposit_bonus_pct: 50, max_deposit_cents: 10000000, min_deposit_cents: 500, redeem_multiplier: 5, max_game_load_cents: 2000000, min_game_load_cents: 500, max_redeem_cap_cents: 50000, max_withdrawal_cents: 5000000, min_withdrawal_cents: 2000, referral_bonus_cents: 15000, max_redeem_multiplier: 5, min_redeem_multiplier: 1, deposit_threshold_cents: 750000, max_daily_withdrawal_cents: 2000000, daily_withdrawal_limit_cents: 2000000 },
  ],

  game_panels: [
    { name: 'EStar',                 slug: 'estar',               is_hot: false, logo_url: '/images/games/estar.png',                 is_active: true, panel_url: null, banner_url: null, sort_order: 1,  description: null,                                   accent_color: '#1f9d7a', provider_type: 'manual', max_load_cents: null,  min_load_cents: null, max_redeem_cents: null, min_redeem_cents: null, default_bonus_pct: 10, redeem_multiplier: null, agent_password_enc: null, agent_username_enc: null },
    { name: 'Fire Kirin',            slug: 'fire-kirin',          is_hot: true,  logo_url: null,                                      is_active: true, panel_url: null, banner_url: null, sort_order: 1,  description: 'Popular fish game with exciting bonuses', accent_color: '#ff6b00', provider_type: 'manual', max_load_cents: 50000, min_load_cents: 500,  max_redeem_cents: null, min_redeem_cents: null, default_bonus_pct: 10, redeem_multiplier: 5,    agent_password_enc: null, agent_username_enc: null },
    { name: 'Orion Stars',           slug: 'orion-stars',         is_hot: true,  logo_url: null,                                      is_active: true, panel_url: null, banner_url: null, sort_order: 2,  description: 'Classic fish shooting game',           accent_color: '#00d4ff', provider_type: 'manual', max_load_cents: 50000, min_load_cents: 500,  max_redeem_cents: null, min_redeem_cents: null, default_bonus_pct: 10, redeem_multiplier: 5,    agent_password_enc: null, agent_username_enc: null },
    { name: 'Game Vault',            slug: 'gamevault',           is_hot: false, logo_url: '/images/games/GameVault-game.png',        is_active: true, panel_url: null, banner_url: null, sort_order: 2,  description: null,                                   accent_color: '#2b5fd9', provider_type: 'manual', max_load_cents: null,  min_load_cents: null, max_redeem_cents: null, min_redeem_cents: null, default_bonus_pct: 10, redeem_multiplier: null, agent_password_enc: null, agent_username_enc: null },
    { name: 'Royal Treasure',        slug: 'royaltreasure',       is_hot: false, logo_url: '/images/games/royaltreasure.png',         is_active: true, panel_url: null, banner_url: null, sort_order: 3,  description: null,                                   accent_color: '#7a3fe0', provider_type: 'manual', max_load_cents: null,  min_load_cents: null, max_redeem_cents: null, min_redeem_cents: null, default_bonus_pct: 10, redeem_multiplier: null, agent_password_enc: null, agent_username_enc: null },
    { name: 'Ultra Thunder',         slug: 'ultrathunder',        is_hot: false, logo_url: '/images/games/ultrathunder.png',          is_active: true, panel_url: null, banner_url: null, sort_order: 5,  description: null,                                   accent_color: '#2b6fe0', provider_type: 'manual', max_load_cents: null,  min_load_cents: null, max_redeem_cents: null, min_redeem_cents: null, default_bonus_pct: 10, redeem_multiplier: null, agent_password_enc: null, agent_username_enc: null },
    { name: 'Dragon Fury',           slug: 'dragonfury',          is_hot: false, logo_url: '/images/games/dragonfury.png',            is_active: true, panel_url: null, banner_url: null, sort_order: 6,  description: null,                                   accent_color: '#1fa77f', provider_type: 'manual', max_load_cents: null,  min_load_cents: null, max_redeem_cents: null, min_redeem_cents: null, default_bonus_pct: 10, redeem_multiplier: null, agent_password_enc: null, agent_username_enc: null },
    { name: 'Juwa',                  slug: 'juwa',                is_hot: true,  logo_url: null,                                      is_active: true, panel_url: null, banner_url: null, sort_order: 6,  description: 'Action-packed fish game',              accent_color: '#ffaa00', provider_type: 'manual', max_load_cents: 50000, min_load_cents: 500,  max_redeem_cents: null, min_redeem_cents: null, default_bonus_pct: 10, redeem_multiplier: 5,    agent_password_enc: null, agent_username_enc: null },
    { name: 'Vegas Sweeps',          slug: 'vegassweeps',         is_hot: false, logo_url: '/images/games/Sweeps.png',                is_active: true, panel_url: null, banner_url: null, sort_order: 7,  description: null,                                   accent_color: '#1f9d7a', provider_type: 'manual', max_load_cents: null,  min_load_cents: null, max_redeem_cents: null, min_redeem_cents: null, default_bonus_pct: 10, redeem_multiplier: null, agent_password_enc: null, agent_username_enc: null },
    { name: 'Game Room',             slug: 'gameroom',            is_hot: false, logo_url: '/images/games/GamerRoom-game.png',        is_active: true, panel_url: null, banner_url: null, sort_order: 8,  description: null,                                   accent_color: '#2b5fd9', provider_type: 'manual', max_load_cents: null,  min_load_cents: null, max_redeem_cents: null, min_redeem_cents: null, default_bonus_pct: 10, redeem_multiplier: null, agent_password_enc: null, agent_username_enc: null },
    { name: 'Milky Way',             slug: 'milkyway',            is_hot: false, logo_url: '/images/games/MilkyWays.png',             is_active: true, panel_url: null, banner_url: null, sort_order: 9,  description: null,                                   accent_color: '#7a3fe0', provider_type: 'manual', max_load_cents: null,  min_load_cents: null, max_redeem_cents: null, min_redeem_cents: null, default_bonus_pct: 10, redeem_multiplier: null, agent_password_enc: null, agent_username_enc: null },
    { name: 'Yolo 777',              slug: 'yolo777',             is_hot: false, logo_url: '/images/games/yolo.png',                  is_active: true, panel_url: null, banner_url: null, sort_order: 12, description: null,                                   accent_color: '#1fa77f', provider_type: 'manual', max_load_cents: null,  min_load_cents: null, max_redeem_cents: null, min_redeem_cents: null, default_bonus_pct: 10, redeem_multiplier: null, agent_password_enc: null, agent_username_enc: null },
    { name: 'Cash Machine Jackpots', slug: 'cashmachinejackpots', is_hot: false, logo_url: '/images/games/cash-machine-jackpots.png', is_active: true, panel_url: null, banner_url: null, sort_order: 13, description: null,                                   accent_color: '#1f9d7a', provider_type: 'manual', max_load_cents: null,  min_load_cents: null, max_redeem_cents: null, min_redeem_cents: null, default_bonus_pct: 10, redeem_multiplier: null, agent_password_enc: null, agent_username_enc: null },
    { name: 'Blue Dragon',           slug: 'bluedragon',          is_hot: false, logo_url: '/images/games/blue-dragon.png',           is_active: true, panel_url: null, banner_url: null, sort_order: 14, description: null,                                   accent_color: '#2b5fd9', provider_type: 'manual', max_load_cents: null,  min_load_cents: null, max_redeem_cents: null, min_redeem_cents: null, default_bonus_pct: 10, redeem_multiplier: null, agent_password_enc: null, agent_username_enc: null },
    { name: 'Cash Vault',            slug: 'cashvault',           is_hot: false, logo_url: '/images/games/cash-vault.png',            is_active: true, panel_url: null, banner_url: null, sort_order: 15, description: null,                                   accent_color: '#7a3fe0', provider_type: 'manual', max_load_cents: null,  min_load_cents: null, max_redeem_cents: null, min_redeem_cents: null, default_bonus_pct: 10, redeem_multiplier: null, agent_password_enc: null, agent_username_enc: null },
    { name: 'Mr All In One',         slug: 'mrallinone',          is_hot: false, logo_url: '/images/games/mr-all.png',                is_active: true, panel_url: null, banner_url: null, sort_order: 16, description: null,                                   accent_color: '#12b8d6', provider_type: 'manual', max_load_cents: null,  min_load_cents: null, max_redeem_cents: null, min_redeem_cents: null, default_bonus_pct: 10, redeem_multiplier: null, agent_password_enc: null, agent_username_enc: null },
    { name: 'Cash Frenzy',           slug: 'cashfrenzy',          is_hot: false, logo_url: '/images/games/cash-frenzy.png',           is_active: true, panel_url: null, banner_url: null, sort_order: 17, description: null,                                   accent_color: '#2b6fe0', provider_type: 'manual', max_load_cents: null,  min_load_cents: null, max_redeem_cents: null, min_redeem_cents: null, default_bonus_pct: 10, redeem_multiplier: null, agent_password_enc: null, agent_username_enc: null },
    { name: 'Mafia City',            slug: 'mafiacity',           is_hot: false, logo_url: '/images/games/mafia.png',                 is_active: true, panel_url: null, banner_url: null, sort_order: 18, description: null,                                   accent_color: '#1fa77f', provider_type: 'manual', max_load_cents: null,  min_load_cents: null, max_redeem_cents: null, min_redeem_cents: null, default_bonus_pct: 10, redeem_multiplier: null, agent_password_enc: null, agent_username_enc: null },
    { name: 'Ace Club',              slug: 'aceclub',             is_hot: false, logo_url: '/images/games/ace-club.png',              is_active: true, panel_url: null, banner_url: null, sort_order: 19, description: null,                                   accent_color: '#1f9d7a', provider_type: 'manual', max_load_cents: null,  min_load_cents: null, max_redeem_cents: null, min_redeem_cents: null, default_bonus_pct: 10, redeem_multiplier: null, agent_password_enc: null, agent_username_enc: null },
    { name: 'Lucky Stars',           slug: 'luckystars',          is_hot: false, logo_url: '/images/games/lucky-star.png',            is_active: true, panel_url: null, banner_url: null, sort_order: 20, description: null,                                   accent_color: '#2b5fd9', provider_type: 'manual', max_load_cents: null,  min_load_cents: null, max_redeem_cents: null, min_redeem_cents: null, default_bonus_pct: 10, redeem_multiplier: null, agent_password_enc: null, agent_username_enc: null },
    { name: 'Juwa 2.0',              slug: 'juwa20',              is_hot: false, logo_url: '/images/games/juwa2.png',                 is_active: true, panel_url: null, banner_url: null, sort_order: 21, description: null,                                   accent_color: '#7a3fe0', provider_type: 'manual', max_load_cents: null,  min_load_cents: null, max_redeem_cents: null, min_redeem_cents: null, default_bonus_pct: 10, redeem_multiplier: null, agent_password_enc: null, agent_username_enc: null },
    { name: 'Vegas Luck',            slug: 'vegasluck',           is_hot: false, logo_url: '/images/games/vegas-luck.png',            is_active: true, panel_url: null, banner_url: null, sort_order: 22, description: null,                                   accent_color: '#12b8d6', provider_type: 'manual', max_load_cents: null,  min_load_cents: null, max_redeem_cents: null, min_redeem_cents: null, default_bonus_pct: 10, redeem_multiplier: null, agent_password_enc: null, agent_username_enc: null },
    { name: 'Win Star',              slug: 'winstar',             is_hot: false, logo_url: '/images/games/win-star.png',              is_active: true, panel_url: null, banner_url: null, sort_order: 23, description: null,                                   accent_color: '#2b6fe0', provider_type: 'manual', max_load_cents: null,  min_load_cents: null, max_redeem_cents: null, min_redeem_cents: null, default_bonus_pct: 10, redeem_multiplier: null, agent_password_enc: null, agent_username_enc: null },
  ],

  payment_methods: [
    { icon: null, name: 'CashApp',    type: 'cashapp', is_auto: false, logo_url: 'https://cdn.simpleicons.org/cashapp/00C244',                                                                 is_active: true, sort_order: 1, description: null, instructions: 'Send payment to $CasinozeRoom and upload screenshot', allow_deposit: true, allow_withdraw: true, requires_proof: true, account_details: { cashtag: '$CasinozeRoom' }, default_bonus_pct: 40, max_deposit_cents: 50000,  min_deposit_cents: 1000, requires_reference: true },
    { icon: null, name: 'PayPal',     type: 'paypal',  is_auto: false, logo_url: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQAy4l0fGZwt9I7YElPw0u-7W-sqVhI6DhG124QvDzRjQ&s=10', is_active: true, sort_order: 2, description: null, instructions: null,                                                 allow_deposit: true, allow_withdraw: true, requires_proof: true, account_details: {},                           default_bonus_pct: 0,  max_deposit_cents: 100000, min_deposit_cents: 500,  requires_reference: true },
    { icon: null, name: 'Chime',      type: 'chime',   is_auto: false, logo_url: 'https://www.google.com/s2/favicons?domain=chime.com&sz=128',                                                 is_active: true, sort_order: 3, description: null, instructions: null,                                                 allow_deposit: true, allow_withdraw: true, requires_proof: true, account_details: {},                           default_bonus_pct: 0,  max_deposit_cents: 100000, min_deposit_cents: 500,  requires_reference: true },
    { icon: null, name: 'Apple Pay',  type: 'other',   is_auto: false, logo_url: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT60GUrQT6awoC0Ywf1r3dDqTWkkf3wr9g354GhVSZhzQ&s',     is_active: true, sort_order: 4, description: null, instructions: null,                                                 allow_deposit: true, allow_withdraw: true, requires_proof: true, account_details: {},                           default_bonus_pct: 0,  max_deposit_cents: 100000, min_deposit_cents: 500,  requires_reference: true },
    { icon: null, name: 'Google Pay', type: 'other',   is_auto: false, logo_url: 'https://cdn-icons-png.flaticon.com/512/6124/6124998.png',                                                    is_active: true, sort_order: 5, description: null, instructions: null,                                                 allow_deposit: true, allow_withdraw: true, requires_proof: true, account_details: {},                           default_bonus_pct: 0,  max_deposit_cents: 100000, min_deposit_cents: 500,  requires_reference: true },
  ],

  referral_bonus_tiers: [
    { is_active: true, bonus_percent: 0, deposit_number: 1 },
    { is_active: true, bonus_percent: 0, deposit_number: 2 },
    { is_active: true, bonus_percent: 0, deposit_number: 3 },
  ],

  platform_settings: [
    { key: 'platform_name',          value: 'Casino',              description: 'Shown to players' },
    { key: 'support_email',          value: 'support@example.com', description: 'Where players are told to write' },
    { key: 'timezone',               value: 'UTC',                 description: 'Casino time zone' },
    { key: 'registrations_enabled',  value: 'true',                description: 'Allow new players to register' },
    { key: 'deposits_enabled',       value: 'true',                description: 'Allow players to deposit' },
    { key: 'withdrawals_enabled',    value: 'true',                description: 'Allow players to withdraw' },
    { key: 'session_timeout_enabled',value: 'false',               description: 'Sign staff out after inactivity' },
    { key: 'session_timeout_minutes',value: '60',                  description: 'Minutes of inactivity before sign-out' },
    { key: 'two_factor_required',    value: 'false',               description: 'Require staff to use an authenticator app' },
    { key: 'ip_whitelist_enabled',   value: 'false',               description: 'Restrict the panel to approved networks' },
    { key: 'ip_whitelist',           value: [],                    description: 'Approved networks' },
    { key: 'maintenance_mode',       value: 'false',               description: 'Block the player site' },
    { key: 'maintenance_message',    value: '',                    description: 'Shown when maintenance is on' },
  ],
}

/**
 * Give a casino everything it is missing from the starter set.
 *
 * A kind is only applied when that casino has none of it, so this is safe to
 * run twice and never touches a casino that has been set up by hand. Returns
 * what was added and what was skipped, so the caller can say so plainly.
 */
export async function applyDefaultsToTenant(db, tenantId) {
  const applied = {}

  for (const kind of DEFAULT_KINDS) {
    const rows = STARTER_SETS[kind.key] || []
    if (!rows.length) { applied[kind.key] = { added: 0, reason: 'no default set' }; continue }

    const { count } = await db
      .from(kind.table)
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)

    if (count > 0) { applied[kind.key] = { added: 0, reason: `already has ${count}` }; continue }

    const copies = rows.map(r => ({ ...r, tenant_id: tenantId }))
    const { error } = await db.from(kind.table).insert(copies)

    applied[kind.key] = error
      ? { added: 0, reason: error.message }
      : { added: copies.length }
  }

  return applied
}
