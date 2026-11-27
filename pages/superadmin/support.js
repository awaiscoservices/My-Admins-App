/**
 * /superadmin/support — the platform owner's one inbox for every casino.
 *
 * Each tenant has a single "Platform Support" thread; the super admin sees them
 * all here. Tenant staff reach this same thread from /admin/support.
 */
import Head from 'next/head'
import SuperAdminLayout from '../../components/layout/SuperAdminLayout'
import InternalSupport from '../../components/internal/InternalSupport'

export default function SuperAdminSupport() {
  return (
    <SuperAdminLayout title="Support">
      <Head><title>Support — Super Admin</title></Head>
      <InternalSupport superadmin />
    </SuperAdminLayout>
  )
}
