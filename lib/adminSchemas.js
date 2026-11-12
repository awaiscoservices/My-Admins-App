// Shared by the admin APIs (validation) and the admin screens (forms). No secrets in here.

export const STAFF_ROLES = ['super_admin', 'finance', 'game_ops', 'support', 'kyc_agent', 'risk', 'reporting', 'marketing']

// Read-only lists
export const BROWSE = {
  wallets:      { table: 'wallets',            roles: ['super_admin', 'finance'],              order: 'cash_balance_cents' },
  transactions: { table: 'ledger',             roles: ['super_admin', 'finance', 'reporting'], order: 'created_at' },
  adjustments:  { table: 'wallet_adjustments', roles: ['super_admin', 'finance'],              order: 'created_at' },
  audit:        { table: 'audit_logs',         roles: ['super_admin'],                         order: 'created_at', byAction: true },
}

// NOTE: the old schema-driven generic editor (MANAGE + cleanFields, used only
// by the removed ManageList component and /api/admin/manage) lived here. It is
// gone. Payment methods are edited on /admin/payments, player levels via the
// Level drawer, and bonuses on /admin/promotions (Player Bonuses) — those are
// the single sources of truth now.
