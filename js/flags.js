// Nationality: ISO 3166-1 alpha-2 codes, localized country names (Intl.DisplayNames) and small flag images.
// Flags are SVGs from the flag-icons package (MIT) on jsDelivr; the service worker caches them for offline use.
import { html } from '../vendor/preact-htm.js';

export const COUNTRIES = ('AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ ' +
  'CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY ' +
  'HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ ' +
  'NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ ' +
  'TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW').split(' ');
// home nations of darts get their own flags too
export const EXTRA = ['GB-ENG', 'GB-SCT', 'GB-WLS', 'GB-NIR'];
const EXTRA_NAMES = { tr: { 'GB-ENG': 'İngiltere', 'GB-SCT': 'İskoçya', 'GB-WLS': 'Galler', 'GB-NIR': 'Kuzey İrlanda' }, en: { 'GB-ENG': 'England', 'GB-SCT': 'Scotland', 'GB-WLS': 'Wales', 'GB-NIR': 'Northern Ireland' } };

export const isCountry = (c) => typeof c === 'string' && (COUNTRIES.includes(c) || EXTRA.includes(c));

const namers = {};
export function countryName(code, lang = 'en') {
  if (!code) return '';
  if (EXTRA_NAMES[lang]?.[code] || EXTRA_NAMES.en[code]) return EXTRA_NAMES[lang]?.[code] || EXTRA_NAMES.en[code];
  try {
    namers[lang] = namers[lang] || new Intl.DisplayNames([lang], { type: 'region' });
    return namers[lang].of(code) || code;
  } catch { return code; }
}

/** All selectable countries, sorted by name in the given language (darts home nations listed with the UK). */
export function countryList(lang) {
  return [...COUNTRIES, ...EXTRA].map((code) => ({ code, name: countryName(code, lang) })).sort((a, b) => a.name.localeCompare(b.name, lang));
}

export const flagUrl = (code) => `https://cdn.jsdelivr.net/npm/flag-icons@7.2.3/flags/1x1/${code.toLowerCase()}.svg`;

export const Flag = ({ code, cls = '' }) => (isCountry(code) ? html`<img class=${'flag ' + cls} src=${flagUrl(code)} alt=${code} loading="lazy" decoding="async" draggable="false" />` : null);
