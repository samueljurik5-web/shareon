/** Market survey (/dotaznik): questions and answer labels, shared by the form and the admin summary. */
export type SurveyKey = 'boughtUnused' | 'categories' | 'wouldBorrow' | 'barriers' | 'noDepositHelps' | 'wouldLend';

export interface SurveyQuestion {
  key: SurveyKey;
  title: string;
  multi?: boolean;
  options: [value: string, label: string][];
}

export const SURVEY_QUESTIONS: SurveyQuestion[] = [
  {
    key: 'boughtUnused',
    title: 'Kúpil si si niekedy vec, ktorú si potom použil len párkrát?',
    options: [['OFTEN', 'Áno, často'], ['SOMETIMES', 'Áno, niekedy'], ['NO', 'Nie']],
  },
  {
    key: 'categories',
    title: 'Ktoré veci by si si radšej požičal, ako kúpil?',
    multi: true,
    options: [
      ['TOOLS', 'Náradie (vŕtačka, rebrík…)'],
      ['GARDEN', 'Záhradné náradie (kosačka…)'],
      ['SPORT', 'Športové veci (bicykel, paddleboard, lyže…)'],
      ['CAMPING', 'Kempovanie (stan, spacák…)'],
      ['ELECTRONICS', 'Elektronika (projektor, fotoaparát…)'],
      ['KIDS', 'Veci pre deti (vozík, autosedačka…)'],
      ['OTHER', 'Iné'],
    ],
  },
  {
    key: 'wouldBorrow',
    title: 'Požičal by si si vec od človeka z okolia cez aplikáciu?',
    options: [['YES_SURE', 'Určite áno'], ['RATHER_YES', 'Skôr áno'], ['RATHER_NO', 'Skôr nie'], ['NO', 'Určite nie']],
  },
  {
    key: 'barriers',
    title: 'Čo by ťa od požičania odradilo najviac?',
    multi: true,
    options: [
      ['DEPOSIT', 'Záloha, ktorú musím zaplatiť vopred'],
      ['DAMAGE', 'Strach, že vec bude pokazená'],
      ['TRUST', 'Nedôvera k cudzím ľuďom'],
      ['HASSLE', 'Zložité dohadovanie a odovzdanie'],
      ['NOTHING', 'Nič, požičal by som si'],
    ],
  },
  {
    key: 'noDepositHelps',
    title: 'Pomohlo by ti, keby si nemusel platiť zálohu a namiesto nej by bola v cene malá ochrana prenájmu (najviac 5 €)?',
    options: [['YES', 'Áno'], ['DONT_KNOW', 'Neviem'], ['NO', 'Nie']],
  },
  {
    key: 'wouldLend',
    title: 'Požičal by si aj ty svoje veci iným a zarobil na nich?',
    options: [['YES', 'Áno'], ['MAYBE', 'Možno'], ['NO', 'Nie']],
  },
];

export const surveyLabel = (key: SurveyKey, value: string) =>
  SURVEY_QUESTIONS.find((q) => q.key === key)?.options.find(([v]) => v === value)?.[1] ?? value;
