/**
 * Casinoze Support has no public landing page — it is a staff tool.
 * Send everyone to the staff sign-in, which then routes by role.
 */
export default function Index() { return null }

export async function getServerSideProps() {
  return { redirect: { destination: '/auth/login', permanent: false } }
}
