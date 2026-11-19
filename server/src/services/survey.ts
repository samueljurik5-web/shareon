/** Allowed answers of the market survey (/dotaznik), in the order shown in the admin. */
export const SURVEY = {
  boughtUnused: ['OFTEN', 'SOMETIMES', 'NO'],
  categories: ['TOOLS', 'GARDEN', 'SPORT', 'CAMPING', 'ELECTRONICS', 'KIDS', 'OTHER'],
  wouldBorrow: ['YES_SURE', 'RATHER_YES', 'RATHER_NO', 'NO'],
  barriers: ['DEPOSIT', 'DAMAGE', 'TRUST', 'HASSLE', 'NOTHING'],
  noDepositHelps: ['YES', 'DONT_KNOW', 'NO'],
  wouldLend: ['YES', 'MAYBE', 'NO'],
} as const;
