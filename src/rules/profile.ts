// SPDX-License-Identifier: GPL-3.0-or-later
// Numbers of the rules profile classic3 for the rules text (NFR-18). The server owns the rules
// (ADR 0006); a test keeps this file equal to RuleProfile (L-079).
import classic3 from './classic3.json';

export interface RulesProfile {
  diceCount: number;
  noCaptureDrawMoves: number;
  skippedRoundsDraw: number;
  blitzSeconds: number;
  rapidSeconds: number;
  incrementMinSeconds: number;
  incrementMaxSeconds: number;
}

export const CLASSIC3: RulesProfile = classic3;

/** Values for i18n interpolation in the rules texts. */
export function rulesTextValues(profile: RulesProfile = CLASSIC3) {
  return {
    dice: profile.diceCount,
    drawMoves: profile.noCaptureDrawMoves,
    skipRounds: profile.skippedRoundsDraw,
    // Both sides skip in a row: one count per side (game-end, OQ-060).
    skipRoundsTotal: 2 * profile.skippedRoundsDraw,
    blitzMinutes: profile.blitzSeconds / 60,
    rapidMinutes: profile.rapidSeconds / 60,
    incrementMin: profile.incrementMinSeconds,
    incrementMax: profile.incrementMaxSeconds,
  };
}
