/**
 * Whether the user must complete /setup/username.
 * Any account without a non-empty stored username is sent to onboarding (covers legacy rows where
 * `username_setup_done` defaulted to true in the DB before signup flow set it false).
 */
export function needsUsernameOnboarding(user) {
    if (!user) return false;
    const handle = user.username != null ? String(user.username).trim() : "";
    return handle.length === 0;
}
