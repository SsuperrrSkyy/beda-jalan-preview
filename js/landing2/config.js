// Single source for wording that may still change.
export const CTA_LABEL = 'Ikuti Jalanku';
export const CTA_MICRO = 'Tes minat gratis 3 menit untuk tahu kamu lebih condong ke IPA, IPS, atau dua-duanya.';

// Share link (FR-17): clean page URL + share-only UTM, no name or type in the URL. Values follow TRACKING_PLAN §6;
// utm_medium, utm_campaign and utm_content are still [TBD] there, so change them here once the media plan fixes them.
export const SHARE_UTM = 'utm_source=share&utm_medium=referral&utm_campaign=beda_jalan_satu_tujuan&utm_content=peta_minat';

// "Coba Belajar Gratis 7 Hari" on the Peta Minat sheet (FR-16, B-23): shown only when the promo is on and has a link.
export const PROMO = { on: false, label: 'Coba Belajar Gratis 7 Hari →', href: '' };
