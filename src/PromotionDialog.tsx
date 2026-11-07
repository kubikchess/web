// SPDX-License-Identifier: GPL-3.0-or-later
import { useTranslation } from 'react-i18next';

import type { ColorName } from './api';
import type { Promotion } from './moves';
import { glyph, PROMOTION_PIECES } from './pieces';

interface PromotionDialogProps {
  color: ColorName;
  choices: Promotion[];
  onChoose: (promotion: Promotion) => void;
  onCancel: () => void;
}

export function PromotionDialog({ color, choices, onChoose, onCancel }: PromotionDialogProps) {
  const { t } = useTranslation();
  return (
    <div className="promotion" role="dialog" aria-modal="true" aria-label={t('promotion.title')}>
      <p>{t('promotion.title')}</p>
      <div className="promotion-choices">
        {choices.map((choice) => (
          <button
            key={choice}
            type="button"
            onClick={() => onChoose(choice)}
            aria-label={t(`piece.${PROMOTION_PIECES[choice]}`)}
          >
            {glyph(color, PROMOTION_PIECES[choice])}
          </button>
        ))}
      </div>
      <button type="button" className="secondary" onClick={onCancel}>
        {t('promotion.cancel')}
      </button>
    </div>
  );
}
