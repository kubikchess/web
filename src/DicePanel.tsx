// SPDX-License-Identifier: GPL-3.0-or-later
import { useTranslation } from 'react-i18next';

import type { DiceState } from './api';
import { diceSlots } from './dice';
import { glyph } from './pieces';

export function DicePanel({ dice }: { dice: Pick<DiceState, 'color' | 'faces' | 'remaining'> | null }) {
  const { t } = useTranslation();
  if (!dice) return <p className="dice-empty">{t('dice.none')}</p>;
  return (
    <section className="dice" aria-label={t(`dice.of_${dice.color}`)}>
      <h2>{t(`dice.of_${dice.color}`)}</h2>
      <ul>
        {diceSlots(dice.faces, dice.remaining).map((slot, index) => (
          <li
            key={index}
            className={slot.used ? 'die used' : 'die'}
            data-testid="die"
            data-piece={slot.piece}
            data-used={slot.used}
            title={t(`piece.${slot.piece}`)}
          >
            <span aria-hidden="true">{glyph(dice.color, slot.piece)}</span>
            <span className="die-label">{t(`piece.${slot.piece}`)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
