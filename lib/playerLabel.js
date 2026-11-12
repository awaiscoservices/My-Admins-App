/**
 * lib/playerLabel.js
 *
 * The ONLY player identity staff are allowed to see is a unique username slug.
 * A player's real name and email address are never shown to admin staff, on
 * the support screens or anywhere else in the panel.
 *
 * playerLabel(profile) → the username to display (with a safe fallback).
 * maskPlayer(profile)  → the same profile object with the name replaced by the
 *                        username and the email stripped out, keeping any other
 *                        fields a screen needs (status, level, phone, …).
 *
 * Every admin route that returns player info should pass the joined profile
 * through maskPlayer() (and make sure its select includes `username`).
 */
export function playerLabel(profile) {
  if (!profile) return 'Player'
  if (profile.username) return profile.username
  const id = String(profile.id || '')
  return id ? `player${id.replace(/-/g, '').slice(0, 8)}` : 'Player'
}

export function maskPlayer(profile) {
  if (!profile) return profile
  const label = playerLabel(profile)
  return { ...profile, full_name: label, username: label, email: null }
}
