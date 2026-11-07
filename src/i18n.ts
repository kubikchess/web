// SPDX-License-Identifier: GPL-3.0-or-later
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import ru from './locales/ru.json';

// Russian only for now (OQ-035); other languages add a resource here.
void i18n.use(initReactI18next).init({
  resources: { ru: { translation: ru } },
  lng: 'ru',
  fallbackLng: 'ru',
  interpolation: { escapeValue: false }, // React escapes
});

export default i18n;
