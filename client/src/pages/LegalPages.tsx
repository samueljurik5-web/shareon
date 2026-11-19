import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useSite } from '../lib/site';

const MISSING = '[doplní prevádzkovateľ]';
const VALID_FROM = '30. 10. 2026';

/** Operator identification (Slovak e-commerce law) – values come from the deployment settings. */
function OperatorInfo() {
  const { operatorName, contactEmail } = useSite();
  return (
    <dl className="card-elevated grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 p-4 text-sm">
      <dt className="text-ink-3">Prevádzkovateľ</dt><dd>{operatorName ?? MISSING}</dd>
      <dt className="text-ink-3">Kontakt</dt>
      <dd>{contactEmail ? <a href={`mailto:${contactEmail}`} className="text-neon-blue underline">{contactEmail}</a> : MISSING}</dd>
    </dl>
  );
}

function LegalShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article className="mx-auto max-w-3xl space-y-6 [&_h2]:text-lg [&_h2]:font-bold [&_li]:text-ink-2 [&_p]:text-ink-2 [&_section]:space-y-2 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
      <div>
        <h1 className="text-gradient text-3xl font-extrabold sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-ink-3">Platné od {VALID_FROM} · testovacia verzia ShareOn. Pred ostrým spustením prejdú dokumenty právnou kontrolou.</p>
      </div>
      {children}
    </article>
  );
}

export function PrivacyPage() {
  return (
    <LegalShell title="Ochrana osobných údajov">
      <section>
        <h2>Kto spracúva tvoje údaje</h2>
        <p>Prevádzkovateľom služby ShareOn a zodpovednou osobou za spracúvanie osobných údajov je:</p>
        <OperatorInfo />
      </section>
      <section>
        <h2>Aké údaje spracúvame a prečo</h2>
        <ul>
          <li><strong className="text-ink">Účet:</strong> meno, e-mail, telefón, mesto, heslo (len v zašifrovanej podobe), voliteľne fotka a popis – na vytvorenie účtu a sprostredkovanie prenájmov (plnenie zmluvy).</li>
          <li><strong className="text-ink">Ponuky a prenájmy:</strong> veci, fotky, termíny, ceny, správy, záznamy o odovzdaní a vrátení, hodnotenia – na fungovanie prenájmov (plnenie zmluvy).</li>
          <li><strong className="text-ink">Hlásenia problémov:</strong> popis, fotky a poznámka ku kontaktu – na riešenie škôd a sporov (plnenie zmluvy, oprávnený záujem).</li>
          <li><strong className="text-ink">Spätná väzba, „Čo hľadáš“ a „Chcem byť medzi prvými“:</strong> správa, voliteľne meno alebo e-mail a mestská časť – na zlepšenie služby a aby sme ťa mohli kontaktovať, keď bude dostupné to, o čo máš záujem (súhlas, ktorý môžeš kedykoľvek odvolať).</li>
          <li><strong className="text-ink">Štatistiky:</strong> anonymné denné počty (napr. koľko ľudí otvorilo stránku alebo poslalo žiadosť) a texty vyhľadávaní – bez cookies, bez IP adresy a bez identifikácie návštevníka (oprávnený záujem na zlepšovaní služby).</li>
        </ul>
        <p>Telefón a e-mail druhej strany sa zobrazia až po prijatí žiadosti o prenájom.</p>
      </section>
      <section>
        <h2>Komu údaje poskytujeme</h2>
        <ul>
          <li>Druhej strane prenájmu – len údaje potrebné na odovzdanie veci.</li>
          <li>Render Services, Inc. – hosting aplikácie a databázy, servery vo Frankfurte (EÚ).</li>
          <li>Ak sú zapnuté e-mailové upozornenia: Resend, Inc. – odosielanie e-mailov (prenos podľa štandardných zmluvných doložiek EÚ).</li>
        </ul>
        <p>Údaje nepredávame a nepoužívame na reklamu.</p>
      </section>
      <section>
        <h2>Ako dlho údaje uchovávame</h2>
        <ul>
          <li>Účet a ponuky – kým účet používaš; po zrušení účtu ich vymažeme, okrem údajov o prenájmoch a hláseniach.</li>
          <li>Prenájmy, hodnotenia a hlásenia – najviac 3 roky od skončenia prenájmu kvôli možným sporom.</li>
          <li>Spätná väzba, „Čo hľadáš“ a zoznam záujemcov – kým súhlas neodvoláš, najviac 2 roky.</li>
        </ul>
      </section>
      <section>
        <h2>Prehliadač a cookies</h2>
        <p>
          Nepoužívame reklamné ani analytické cookies. V prehliadači ukladáme len to, čo je nevyhnutné: prihlásenie (localStorage) a informáciu,
          že si už videl úvodnú animáciu (sessionStorage). Písmo je súčasťou aplikácie, nenačítava sa od tretích strán.
        </p>
      </section>
      <section>
        <h2>Tvoje práva</h2>
        <p>
          Máš právo na prístup k údajom, opravu, vymazanie, obmedzenie spracúvania, prenosnosť, právo namietať a kedykoľvek odvolať súhlas.
          Stačí nám napísať na kontakt vyššie. Ak si myslíš, že s údajmi zaobchádzame nesprávne, môžeš podať sťažnosť na Úrad na ochranu osobných
          údajov SR, Hraničná 12, 820 07 Bratislava (dataprotection.gov.sk).
        </p>
      </section>
      <p className="text-sm"><Link to="/podmienky" className="text-neon-blue underline">Podmienky používania</Link></p>
    </LegalShell>
  );
}

export function TermsPage() {
  return (
    <LegalShell title="Podmienky používania">
      <section>
        <h2>1. Kto prevádzkuje ShareOn</h2>
        <OperatorInfo />
        <p>
          ShareOn je platforma, ktorá spája ľudí, ktorí chcú vec požičať, s ľuďmi, ktorí si ju chcú požičať. ShareOn nie je stranou dohody o prenájme –
          tá vzniká medzi majiteľom a nájomcom. Služba je v prvej testovacej verzii a môže sa meniť.
        </p>
      </section>
      <section>
        <h2>2. Účet</h2>
        <ul>
          <li>Registrovať sa môže osoba staršia ako 18 rokov s pravdivými údajmi.</li>
          <li>Za bezpečnosť hesla a činnosť vo svojom účte zodpovedáš ty.</li>
          <li>Účet môžeme obmedziť alebo zrušiť pri porušení podmienok alebo podozrení na podvod.</li>
        </ul>
      </section>
      <section>
        <h2>3. Ponuky</h2>
        <ul>
          <li>Ponúkať môžeš len veci, ktoré vlastníš alebo máš právo požičať, sú bezpečné a v stave podľa popisu a fotiek.</li>
          <li>Zakázané sú najmä zbrane, nelegálne, nebezpečné alebo kradnuté veci a veci vyžadujúce osobitné povolenie.</li>
          <li>Ponuky označené ako „Ukážka“ slúžia len na ukážku fungovania a nedajú sa prenajať.</li>
        </ul>
      </section>
      <section>
        <h2>4. Cena, Ochrana prenájmu a platba</h2>
        <ul>
          <li>Cenu prenájmu určuje majiteľ. ShareOn nevyžaduje žiadnu kauciu.</li>
          <li>
            Každý prenájom obsahuje Ochranu prenájmu – 10 % z ceny prenájmu, najmenej 0,50 € a najviac 5 €. Je to služba ShareOn, ktorá pomáha riešiť
            škody a spory – je to interná služba platformy a náhrada škody nie je automatická ani garantovaná.
          </li>
          <li>V testovacej verzii ShareOn ešte nespracúva platby – cenu prenájmu platíš majiteľovi pri odovzdaní a Ochranu prenájmu počas testovania neplatíš.</li>
        </ul>
      </section>
      <section>
        <h2>5. Odovzdanie, vrátenie a škody</h2>
        <ul>
          <li>Pri odovzdaní aj vrátení potvrďte stav veci v aplikácii, ideálne s fotkami.</li>
          <li>Nájomca vráti vec načas, čistú a v rovnakom stave; za škodu spôsobenú počas prenájmu zodpovedá podľa všeobecných právnych predpisov.</li>
          <li>Problém alebo škodu nahlás v aplikácii najneskôr do 48 hodín po vrátení. Hlásenie posúdi tím ShareOn podľa dôkazov a pomôže so sporom; ShareOn však nerozhoduje s konečnou platnosťou a nevypláca náhrady.</li>
        </ul>
      </section>
      <section>
        <h2>6. Zodpovednosť</h2>
        <p>
          ShareOn nezodpovedá za stav, bezpečnosť ani použitie požičaných vecí a za plnenie dohôd medzi používateľmi, okrem prípadov, keď to vyžaduje zákon.
          Spotrebiteľské práva podľa slovenských a európskych predpisov tým nie sú dotknuté.
        </p>
      </section>
      <section>
        <h2>7. Kontakt a sťažnosti</h2>
        <p>
          Otázky a sťažnosti posielaj na kontakt v bode 1. Spotrebiteľ môže využiť aj alternatívne riešenie sporov (Slovenská obchodná inšpekcia).
          Na tieto podmienky sa vzťahuje právo Slovenskej republiky.
        </p>
      </section>
      <p className="text-sm"><Link to="/ochrana-udajov" className="text-neon-blue underline">Ochrana osobných údajov</Link></p>
    </LegalShell>
  );
}
