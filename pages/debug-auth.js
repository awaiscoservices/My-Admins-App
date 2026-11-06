// Developer-only page removed. It now returns a 404 so it can't be used to inspect sessions.
export default function DebugAuth() { return null }
export async function getServerSideProps() { return { notFound: true } }
