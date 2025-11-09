export type SelectedTeam = 'home' | 'away' | null;

export interface TeamOdds {
  home: number;
  away: number;
}

// Compute liquidation odds based on a base value and multiplier
// Baseline at 1x; higher multiplier -> lower liquidation; clamp [0.3, 4.0]
export function computeLiquidation(base: number, multiplier: number): number {
  const lowered = base - 0.25 * (multiplier - 1);
  return parseFloat(Math.max(0.3, Math.min(4.0, lowered)).toFixed(2));
}

// Calculate payout given amount, multiplier, selected team and odds
export function calculatePayout(
  amount: number,
  multiplier: number,
  selectedTeam: SelectedTeam,
  odds: TeamOdds
): number {
  if (!selectedTeam || amount <= 0) return 0;
  const selectedOdds = selectedTeam === 'home' ? odds.home : odds.away;
  return parseFloat((amount * selectedOdds * multiplier).toFixed(2));
}