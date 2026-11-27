/**
 * /admin/support — internal staff Support for a casino.
 *
 * Team chat: any staff member can DM any teammate in the same casino. Plus a
 * "Platform Support" thread to reach the platform owner (super admin).
 * Distinct from /admin/chat (Live Chat), which is players ⇄ staff.
 */
import Head from 'next/head'
import AdminLayout from '../../components/layout/AdminLayout'
import InternalSupport from '../../components/internal/InternalSupport'

export default function AdminSupport() {
  return (
    <AdminLayout title="Support">
      <Head><title>Support — Casinoze</title></Head>
      <InternalSupport />
    </AdminLayout>
  )
}
