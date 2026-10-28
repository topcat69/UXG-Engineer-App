// Shared between asset-register/actions.ts (a "use server" file, which
// Next.js only allows async function exports from — a plain constant
// there breaks the build) and the client component that needs the same
// number for its "showing the first N, keep typing to narrow" hint.
export const SITE_SEARCH_LIMIT = 100;
