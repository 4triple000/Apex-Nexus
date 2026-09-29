/**
 * App owner accounts. Set OWNER_EMAILS to a comma-separated list of the
 * email addresses that may use owner-only tools such as the Dev Cockpit.
 * With it unset, nobody is an owner.
 */
function ownerEmails(): Set<string> {
  return new Set(
    (process.env.OWNER_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isOwnerEmail(email: string | null | undefined): boolean {
  return !!email && ownerEmails().has(email.trim().toLowerCase());
}
