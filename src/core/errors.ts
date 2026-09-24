/**
 * A request the rules refuse, with a message safe to show the user. Action wrappers turn it into
 * `{ error }` for the form. Not for "not yours" (that is notFound, INV-04) or a missing permission (AuthzError).
 */
export class Refused extends Error {}
