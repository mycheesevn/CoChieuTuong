/**
 * Phase 2C will wire this to the push-trigger route (challenge received,
 * your-turn, corr move, challenge declined). No-op in 2B so every caller
 * can fire events today without guarding on future infrastructure.
 */
export async function fireEvent(
  kind: "challenge" | "turn" | "corr" | "challenge_declined",
  payload: Record<string, string>
): Promise<void> {
  void kind;
  void payload;
  /* Phase 2C wires this to the push trigger route; no-op in 2B */
}
