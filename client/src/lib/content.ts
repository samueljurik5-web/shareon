/** Marketing / trust copy shared by the home page, item detail and info pages. */
import { CalendarClock, Flag, Handshake, Leaf, PiggyBank, ReceiptText, Search, ShieldCheck, Star, Wallet } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface IconText {
  icon: LucideIcon;
  title: string;
  text: string;
}

export const TRUST_CARDS: IconText[] = [
  { icon: Wallet, title: 'Bez kaucie', text: 'Žiadne viazané peniaze. Požičaj si vec bez zálohy.' },
  { icon: ShieldCheck, title: 'Ochrana prenájmu v cene', text: 'Malý poplatok chráni prenájom a pomáha riešiť prípadné škody.' },
  { icon: ReceiptText, title: 'Jasná cena vopred', text: 'Cenu prenájmu aj Ochranu prenájmu vidíš ešte pred rezerváciou – bez skrytých poplatkov.' },
  { icon: Flag, title: 'Riešenie škôd', text: 'Ak niečo nie je v poriadku, môžeš to nahlásiť priamo v aplikácii.' },
];

export const HOW_STEPS: IconText[] = [
  { icon: Search, title: 'Nájdi vec', text: 'Vyber si vec podľa kategórie, ceny a dostupnosti.' },
  { icon: CalendarClock, title: 'Rezervuj si ju', text: 'Vyber hodiny alebo dni a pošli žiadosť majiteľovi. Cenu vidíš vopred.' },
  { icon: Handshake, title: 'Vyzdvihni a vráť', text: 'Dohodni sa s majiteľom, vyfotografuj stav veci a vráť ju.' },
  { icon: Star, title: 'Ohodnoť prenájom', text: 'Pomôž ostatným vybrať dôveryhodných ľudí a kvalitné veci.' },
];

export const WHY_POINTS: { icon: LucideIcon; text: string }[] = [
  { icon: PiggyBank, text: 'Nekupuj, čo potrebuješ len niekoľkokrát.' },
  { icon: Leaf, text: 'Ušetri miesto, peniaze aj životné prostredie.' },
  { icon: Handshake, text: 'Využi veci, ktoré už máš.' },
  { icon: ShieldCheck, text: 'Požičiavaj bez kaucie a s ochranou prenájmu.' },
];
