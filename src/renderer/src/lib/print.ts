// Génération, aperçu et impression de documents au format A4.
//
// Le même HTML sert à l'aperçu (iframe) et à l'impression : chaque document est
// une suite de blocs `.page` de 210 × 297 mm. En impression, @page prend le
// relais et chaque `.page` occupe exactement une feuille.

export const A4_LARGEUR_MM = 210
export const A4_HAUTEUR_MM = 297

export type Orientation = 'portrait' | 'paysage'

/** Dimensions de la feuille selon l'orientation. */
export function dimensionsPage(o: Orientation): { largeur: number; hauteur: number } {
  return o === 'paysage'
    ? { largeur: A4_HAUTEUR_MM, hauteur: A4_LARGEUR_MM }
    : { largeur: A4_LARGEUR_MM, hauteur: A4_HAUTEUR_MM }
}

const STYLE = `
  @page { margin: 0; }

  /* Palette et fontes des documents. Centralisees ici pour que les actes
     partagent exactement les memes encres et le meme rythme typographique. */
  :root {
    /* Palette NEUTRE par défaut (graphite / ardoise). L'accent des documents
       · --doc-marque et --doc-marque-clair · peut être remplacé par la couleur
       choisie dans les réglages ; le reste (encre, gris, filets) reste sobre. */
    --doc-encre: #1e293b;
    --doc-gris: #475569; /* 7,4:1 sur blanc · AAA */
    --doc-gris-clair: #64748b; /* 4,8:1 sur blanc · AA, y compris en petit */
    --doc-marque: #1f2937; /* accent foncé (défaut neutre) */
    --doc-marque-clair: #334155; /* accent (défaut neutre) */
    --doc-accent-pale: #eef2f7; /* teinte pâle de l'accent (fonds de tableau) */
    --doc-filet: #cbd5e1;
    --doc-filet-fin: #e2e8f0;
    --doc-fond-doux: #f8fafc;
    --doc-serif: Georgia, Cambria, 'Times New Roman', serif;
  }

  * { box-sizing: border-box; }

  html, body {
    margin: 0;
    padding: 0;
    background: #eef1f5;
    font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
    color: #1e293b;
    font-size: 10.5pt;
    line-height: 1.42;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* --- La feuille A4 (portrait par défaut) --- */
  .page {
    width: ${A4_LARGEUR_MM}mm;
    min-height: ${A4_HAUTEUR_MM}mm;
    padding: 11mm 14mm;
    margin: 0 auto 8mm;
    background: #fff;
    box-shadow: 0 2px 10px rgba(30, 20, 50, .18);
    position: relative;
    display: flex;
    flex-direction: column;
  }
  .page:last-child { margin-bottom: 0; }

  /* Documents à longueur variable (contrat, fiche individuelle) : le contenu
     s'écoule sur autant de feuilles qu'il en faut. Une page nommée leur donne
     leurs propres marges, qui se répètent sur chaque feuille · alors qu'une
     boîte de hauteur fixe se contentait de déborder. */
  @page flux { size: A4 portrait; margin: 14mm 16mm; }
  .page-flux { page: flux; }

  /* Feuille en paysage (formulaire BNTS) */
  .page-paysage {
    width: ${A4_HAUTEUR_MM}mm;
    min-height: ${A4_LARGEUR_MM}mm;
    padding: 8mm 9mm;
  }

  @media print {
    html, body { background: #fff; }
    .page {
      margin: 0;
      box-shadow: none;
      page-break-after: always;
      break-after: page;
    }
    .page:last-child { page-break-after: auto; break-after: auto; }
    /* En flux, les marges viennent de @page : la boîte ne doit plus en poser,
       sinon elles s'ajoutent sur la première feuille et manquent sur les autres. */
    .page-flux {
      width: auto;
      min-height: 0;
      padding: 0;
      page-break-after: auto;
      break-after: auto;
    }
  }

  /* À l'écran, un document en flux reste une colonne de largeur A4 : on voit
     qu'il dépasse la feuille, ce qui est l'information utile. */
  .page-flux { padding-bottom: 14mm; }
  .page-flux .acte-pied,
  .page-flux .doc-pied { margin-top: 8mm; }

  /* --- En-tête de document --- */
  .doc-entete {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 10mm;
    padding-bottom: 3mm;
    border-bottom: 2.5pt solid var(--doc-marque-clair);
    margin-bottom: 3.5mm;
  }
  .doc-marque { font-size: 16pt; font-weight: 800; color: var(--doc-marque-clair); letter-spacing: -.3pt; line-height: 1.1; }
  .doc-employeur { font-size: 8.5pt; color: var(--doc-gris); margin-top: 1.5mm; line-height: 1.5; }
  .doc-type {
    text-align: right;
    font-size: 13pt;
    font-weight: 800;
    letter-spacing: .4pt;
    text-transform: uppercase;
    line-height: 1.15;
  }
  .doc-periode { font-size: 9pt; font-weight: 600; color: var(--doc-gris); margin-top: 1.5mm; text-align: right; }

  /* --- Blocs d'identité --- */
  .blocs { display: flex; gap: 4mm; margin-bottom: 3mm; }
  .bloc {
    flex: 1;
    border: .75pt solid var(--doc-filet);
    border-radius: 1.5mm;
    padding: 2.2mm 3mm;
  }
  .bloc-titre {
    font-size: 7.5pt;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: .5pt;
    color: var(--doc-marque-clair);
    margin-bottom: 2mm;
  }
  .kv { display: flex; justify-content: space-between; gap: 4mm; padding: .45mm 0; font-size: 8.8pt; }
  .kv .k { color: var(--doc-gris); }
  .kv .v { font-weight: 600; text-align: right; }

  /* --- Tableaux --- */
  table { width: 100%; border-collapse: collapse; }
  thead th {
    background: var(--doc-accent-pale);
    border-top: .75pt solid var(--doc-filet);
    border-bottom: .75pt solid var(--doc-filet);
    padding: 2mm 2.5mm;
    font-size: 8pt;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: .3pt;
    color: var(--doc-marque);
    text-align: left;
  }
  tbody td {
    padding: 1.4mm 2.5mm;
    border-bottom: .5pt solid var(--doc-filet-fin);
    font-size: 9.5pt;
  }
  .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  tr.section td {
    background: var(--doc-fond-doux);
    font-weight: 700;
    font-size: 8.5pt;
    text-transform: uppercase;
    letter-spacing: .3pt;
    color: var(--doc-gris);
    padding: 1.5mm 2.5mm;
  }
  tr.total td {
    border-top: .75pt solid var(--doc-filet);
    border-bottom: none;
    font-weight: 700;
    background: var(--doc-fond-doux);
  }

  /* --- Net à payer --- */
  .net {
    margin-top: 3mm;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: var(--doc-marque-clair);
    color: #fff;
    border-radius: 2mm;
    padding: 3mm 4.5mm;
  }
  .net .lib { font-size: 10.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: .5pt; }
  .net .val { font-size: 17pt; font-weight: 800; font-variant-numeric: tabular-nums; }

  /* --- Signatures --- */
  .signatures {
    display: flex;
    justify-content: space-between;
    gap: 12mm;
    margin-top: 6mm;
  }
  .signature { flex: 1; font-size: 9pt; }
  .signature .ligne {
    margin-top: 10mm;
    border-top: .75pt dotted var(--doc-gris-clair);
    padding-top: 1.5mm;
    color: var(--doc-gris);
    font-size: 8pt;
  }

  /* --- Pied de page --- */
  .doc-pied {
    margin-top: auto;
    padding-top: 4mm;
    border-top: .5pt solid var(--doc-filet-fin);
    font-size: 7.5pt;
    color: var(--doc-gris);
    text-align: center;
    line-height: 1.5;
  }

  .doc-ids { color: var(--doc-marque-clair); font-weight: 600; }

  /* --- Bandeau salarié du bulletin --- */
  .bandeau-salarie {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8mm;
    background: var(--doc-accent-pale);
    border-left: 3pt solid var(--doc-marque-clair);
    border-radius: 1.5mm;
    padding: 3.5mm 4mm;
    margin-bottom: 4mm;
  }
  .bandeau-nom { font-size: 13pt; font-weight: 800; letter-spacing: -.2pt; line-height: 1.1; }
  .bandeau-emploi { font-size: 10pt; color: var(--doc-gris); font-weight: 600; margin-top: .5mm; }
  .bandeau-refs { display: flex; gap: 8mm; text-align: right; }
  .bandeau-refs div { display: flex; flex-direction: column; }
  .bandeau-refs span { font-size: 7.5pt; text-transform: uppercase; letter-spacing: .4pt; color: var(--doc-gris); }
  .bandeau-refs strong { font-size: 11pt; font-variant-numeric: tabular-nums; }

  /* ================= Formulaires officiels CNSS =================
     Reproduction fidèle des imprimés Pr-RCS/Cot 01 (BNTS, paysage) et
     Pr-RCS/Cot 04 (DRS, portrait) : noir et blanc, quadrillage complet. */
  .form-cnss { color: #000; font-size: 9.5pt; }
  .form-cnss .doc-pied { border: none; margin-top: 2mm; padding-top: 1mm; }

  .cnss-bandeau {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 6mm;
    margin-bottom: 2mm;
  }
  .cnss-institution {
    font-weight: 700;
    font-size: 11.5pt;
    letter-spacing: .2pt;
    flex: 1;
  }
  .cnss-nb { font-size: 8.5pt; margin-top: 1.2mm; line-height: 1.4; }
  /* Cartouche du numéro de déclaration : c'est la référence de l'employeur. */
  .cnss-reference {
    border: 1pt solid var(--doc-marque-clair);
    border-radius: 1.5mm;
    padding: 2mm 4mm;
    text-align: center;
    white-space: nowrap;
    background: var(--doc-fond-doux);
  }
  .cnss-reference .ref-lib {
    display: block;
    font-size: 7.5pt;
    text-transform: uppercase;
    letter-spacing: .5pt;
    color: var(--doc-gris);
  }
  .cnss-reference .ref-code {
    display: block;
    font-size: 13pt;
    font-weight: 800;
    letter-spacing: .3pt;
    color: var(--doc-marque);
    margin-top: .8mm;
    font-variant-numeric: tabular-nums;
  }

  .cnss-certif .signature-zone .mention-lib {
    font-size: 7.5pt;
    color: var(--doc-gris);
    text-transform: uppercase;
    letter-spacing: .3pt;
  }

  .cnss-titre {
    text-align: center;
    font-size: 14pt;
    font-weight: 700;
    margin: 2mm 0 .5mm;
  }
  .cnss-sous-titre { text-align: center; font-size: 9.5pt; font-style: italic; margin-bottom: 2.5mm; }

  /* Bloc d'identification de l'employeur, en colonnes comme sur l'imprimé */
  .cnss-identite {
    display: flex;
    gap: 0;
    border: .75pt solid #000;
    margin-bottom: 2mm;
    font-size: 9.5pt;
  }
  .cnss-identite > div { padding: 2mm 2.5mm; border-right: .75pt solid #000; }
  .cnss-identite > div:last-child { border-right: none; }
  .cnss-col-periode { width: 46mm; }
  .cnss-col-societe { flex: 1; }
  .cnss-col-empl { width: 52mm; }
  .cnss-ligne { padding: .7mm 0; }
  .cnss-ligne .lib { display: inline-block; min-width: 23mm; }
  .cnss-ligne .val { font-weight: 700; }

  /* Tableau réglementaire : quadrillage complet, en-tête teinté */
  .tab-cnss { border-collapse: collapse; width: 100%; }
  .tab-cnss th, .tab-cnss td {
    border: .5pt solid var(--doc-filet);
    padding: 1.6mm 1.8mm;
    font-size: 9pt;
    vertical-align: middle;
  }
  .tab-cnss thead th {
    text-align: center;
    font-weight: 700;
    line-height: 1.2;
    background: var(--doc-accent-pale);
    color: var(--doc-marque);
    border-color: var(--doc-gris);
    text-transform: uppercase;
    letter-spacing: .2pt;
    font-size: 8.5pt;
  }
  /* Lisibilité des longues listes nominatives */
  .tab-cnss tbody tr:nth-child(even) td { background: #fbf9fd; }
  .tab-cnss tbody tr:hover td { background: var(--doc-accent-pale); }
  .tab-cnss td.c { text-align: center; }
  .tab-cnss td.num, .tab-cnss th.num { text-align: right; }
  .tab-cnss tr.total td { font-weight: 700; }
  /* Lignes vides du formulaire vierge : hauteur constante. Le DRS ne porte
     qu'une ligne par categorie et dispose de place : ses lignes sont plus
     hautes que celles du BNTS, nominatif et donc bien plus fourni. */
  .tab-cnss td { height: 6.4mm; }
  .tab-drs td, .tab-drs th { height: 11mm; }
  /* Le BNTS est nominatif : police legerement plus serree que le DRS pour que
     les patronymes en capitales tiennent sur une seule ligne. */
  .tab-bnts td { height: 5.8mm; }
  .tab-bnts th, .tab-bnts td { padding: 1.2mm 1.6mm; font-size: 8.5pt; }
  .tab-bnts thead th { font-size: 8pt; }

  /* Décompte de la DRS : largeurs imposées pour tenir sur la largeur utile
     d'une A4 portrait (180 mm). Sans table-layout fixed, les intitulés de
     catégorie élargissent le tableau au-delà de la feuille. */
  .tab-drs { table-layout: fixed; }
  .tab-drs .col-cat {
    width: 11mm;
    font-size: 7.5pt;
    line-height: 1.2;
    padding: 1.2mm .5mm;
    word-break: break-word;
  }
  .tab-drs .code-cat {
    display: inline-block;
    margin-top: .5mm;
    font-size: 9.5pt;
    font-weight: 800;
  }
  .tab-drs td { overflow: hidden; text-overflow: ellipsis; }

  .cnss-effectif { font-size: 9.5pt; margin-top: 2mm; font-weight: 700; }

  /* Récapitulatif des cotisations, sous les totaux du bordereau */
  .tab-cnss tr.cotisation td { background: var(--doc-fond-doux); font-size: 9pt; }
  .tab-cnss tr.cotisation .lib-cot,
  .tab-cnss tr.a-payer .lib-cot { text-align: right; padding-right: 3mm; }
  .tab-cnss tr.a-payer td {
    background: var(--doc-accent-pale);
    font-weight: 800;
    font-size: 11pt;
    border-top: 1pt solid #000;
  }

  /* Cartouche « certifié exact » */
  .cnss-certif {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 8mm;
    margin-top: auto;
    padding-top: 5mm;
    font-size: 9.5pt;
  }
  .cnss-certif .signature-zone { text-align: center; min-width: 55mm; }
  .cnss-certif .signature-zone .mention { margin-top: 9mm; font-size: 9pt; }

  /* ============ Imprimés travailleur : bulletin d'entrée/sortie et
     demande d'immatriculation. Ces formulaires se remplissent case par case ;
     le peigne ci-dessous reproduit ce quadrillage. ============ */

  .peigne {
    display: inline-flex;
    vertical-align: middle;
  }
  .peigne .pc {
    width: 4.6mm;
    height: 5.4mm;
    border: .5pt solid #000;
    border-right: none;
    text-align: center;
    line-height: 5.2mm;
    font-size: 9pt;
    font-weight: 600;
    font-family: 'Courier New', monospace;
  }
  .peigne .pc:last-child { border-right: .5pt solid #000; }

  .coche {
    display: inline-block;
    width: 4.6mm;
    height: 4.2mm;
    border: .75pt solid #000;
    text-align: center;
    line-height: 4mm;
    font-size: 9pt;
    font-weight: 700;
    vertical-align: middle;
  }

  /* Valeur portée sur une ligne continue, comme sur l'imprimé papier */
  .ligne-val {
    display: inline-block;
    flex: 1;
    min-width: 20mm;
    border-bottom: .75pt solid #000;
    padding: 0 1.5mm .5mm;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .ligne-val.court { flex: none; width: 18mm; }
  .ligne-val.moitie { flex: 1; min-width: 30mm; }

  /* ---------------------- bulletin d'entrée / sortie ---------------------- */

  .form-bulletin { font-size: 10pt; }

  .bul-entete {
    display: flex;
    border: 1pt solid #000;
    margin-bottom: 3mm;
  }
  .bul-institution {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 3mm;
    padding: 2.5mm 3mm;
    border-right: 1pt solid #000;
    text-align: center;
  }
  .bul-cnss-nom {
    font-size: 14pt;
    font-weight: 800;
    line-height: 1.15;
    text-align: left;
  }
  .bul-cnss-coord { font-size: 8.5pt; line-height: 1.35; }
  .bul-type {
    width: 78mm;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 2mm;
    padding: 2mm;
  }
  .bul-mot { font-size: 15pt; font-weight: 700; }
  .bul-accolade { font-size: 30pt; font-weight: 300; line-height: 1; }
  .bul-choix { display: flex; flex-direction: column; gap: 2mm; }
  .bul-ligne-choix {
    display: flex;
    align-items: center;
    gap: 3mm;
    font-size: 14pt;
    font-weight: 800;
    letter-spacing: .5pt;
  }

  .bul-cadre {
    border: 1pt solid #000;
    padding: 3mm 4mm 4mm;
    margin: 0 0 3mm;
  }
  .bul-cadre legend {
    padding: 0 3mm;
    font-size: 12pt;
    font-weight: 700;
    letter-spacing: .3pt;
  }

  .bul-matricule {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 3mm;
    margin-bottom: 3mm;
  }
  .bul-matricule .lib { font-weight: 700; font-size: 10.5pt; }

  .bul-employeur { display: flex; align-items: stretch; gap: 3mm; }
  .bul-accolade-gauche {
    width: 38mm;
    display: flex;
    flex-direction: column;
    justify-content: space-around;
    text-align: center;
    border-right: 1pt solid #000;
    padding-right: 2mm;
  }
  .bul-accolade-gauche em { font-style: normal; font-size: 10pt; line-height: 1.2; }
  .bul-accolade-gauche small { font-size: 8pt; }
  .bul-lignes {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: space-around;
    gap: 3mm;
  }
  .bul-lignes .ligne-val { display: block; min-height: 5mm; }

  .bul-champ {
    display: flex;
    align-items: flex-end;
    gap: 2mm;
    margin-bottom: 3mm;
  }
  .bul-champ .lib { white-space: nowrap; font-size: 10.5pt; }
  .bul-champ .lib.gras { font-weight: 700; }
  .bul-champ .lib.lib-court { margin-left: 3mm; }

  .bul-motifs { margin-top: 2mm; }
  .bul-motifs .lib { font-size: 10.5pt; }
  .bul-motifs .lib.souligne { text-decoration: underline; font-weight: 600; }
  .bul-grille-motifs {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 2.5mm 3mm;
    margin-top: 2.5mm;
  }
  .bul-grille-motifs .mt {
    display: flex;
    align-items: center;
    gap: 1.5mm;
    font-size: 9pt;
  }

  .bul-signature {
    margin-top: auto;
    padding-top: 4mm;
    text-align: center;
    font-size: 10.5pt;
    line-height: 1.5;
  }
  .bul-nom-signataire {
    margin-top: 14mm;
    font-weight: 700;
  }
  .bul-note { font-size: 8.5pt; font-style: italic; margin-top: 2mm; }

  /* ------------------- demande d'immatriculation travailleur ------------- */

  .form-immat { font-size: 9.5pt; }

  .im-entete { text-align: center; margin-bottom: 3mm; }
  .im-titre-institution {
    font-size: 12pt;
    font-weight: 800;
    letter-spacing: .2pt;
  }
  .im-titre {
    font-size: 14pt;
    font-weight: 800;
    margin-top: 2.5mm;
    line-height: 1.25;
  }

  .im-cadre {
    border: 1pt solid #000;
    padding: 2.5mm 3mm 3mm;
    margin: 0 0 3mm;
  }
  .im-cadre legend {
    border: 1pt solid #000;
    padding: .5mm 2.5mm;
    font-size: 10.5pt;
    font-weight: 700;
  }

  .im-l {
    display: flex;
    align-items: center;
    gap: 2mm;
    margin-bottom: 1mm;
  }
  .im-l .lib {
    font-weight: 600;
    white-space: nowrap;
    font-size: 9.5pt;
  }
  /* Les libellés de la colonne de gauche sont alignés : sans largeur commune,
     les peignes démarrent en escalier et l'imprimé devient illisible. */
  .im-l > .lib:first-child { min-width: 44mm; }
  .im-l small { font-size: 7.5pt; font-weight: 400; }
  .im-reserve .lib { font-style: italic; }

  .im-inline { flex-wrap: wrap; }
  .im-inline .opt {
    display: flex;
    align-items: center;
    gap: 1.5mm;
    margin-right: 4mm;
    font-size: 9.5pt;
  }

  .im-nb {
    margin-top: 2mm;
    font-size: 8.5pt;
    font-weight: 600;
  }

  .im-certif {
    margin: 6mm 0 4mm auto;
    width: 90mm;
    text-align: center;
    font-size: 10pt;
    line-height: 1.6;
  }
  .im-certif-titre { font-weight: 700; margin-bottom: 2mm; }
  .im-certif-signature { margin-top: 6mm; font-weight: 600; }
  .im-nom-signataire { margin-top: 12mm; font-weight: 700; }

  .im-important {
    text-align: center;
    font-weight: 700;
    font-size: 11pt;
    margin: 3mm 0 2mm;
  }
  .im-pieces p { margin: 0 0 2mm; font-size: 9pt; line-height: 1.45; }
  .im-pieces p:last-child { margin-bottom: 0; }

  .im-loi {
    margin-top: auto;
    padding-top: 3mm;
    font-size: 9pt;
    line-height: 1.5;
    text-align: justify;
  }

  /* --- Spécifique DRS --- */
  .drs-haut { display: flex; gap: 3mm; margin-bottom: 2mm; align-items: stretch; }
  .drs-rappel {
    border: .75pt solid #000;
    padding: 2.5mm 3mm;
    font-size: 8.5pt;
    width: 66mm;
    line-height: 1.45;
    text-align: center;
  }
  .drs-rappel .titre-rappel { font-weight: 700; margin-bottom: 1mm; }
  .drs-droite { flex: 1; display: flex; flex-direction: column; gap: 2mm; }
  .drs-periode-cadre {
    border: .75pt solid #000;
    padding: 2.5mm 3mm;
    font-size: 10pt;
  }
  .drs-societe { border: .75pt solid #000; padding: 2.5mm 3mm; font-size: 9.5pt; flex: 1; }
  .drs-societe .ligne-pointillee { border-bottom: .5pt dotted #000; padding: 1.3mm 0; }

  .drs-banque {
    text-align: center;
    font-size: 8.5pt;
    font-weight: 700;
    border: .75pt solid #000;
    padding: 1.8mm;
    margin-bottom: 2mm;
  }

  .drs-num-employeur {
    display: flex;
    align-items: center;
    gap: 3mm;
    margin-bottom: 2.5mm;
  }
  .drs-num-employeur .case {
    border: 1pt solid #000;
    padding: 2.5mm 4mm;
    font-weight: 700;
    font-size: 12.5pt;
    letter-spacing: 1pt;
    min-width: 60mm;
    text-align: center;
  }
  .drs-num-employeur .lib { font-size: 9.5pt; font-weight: 700; }

  .drs-titre-decompte { text-align: center; font-weight: 700; font-size: 11.5pt; margin: 3mm 0 1mm; }

  /* Cases à cocher des catégories présentes */
  .drs-categories {
    display: flex;
    flex-wrap: wrap;
    gap: 2mm 5mm;
    border: .75pt solid #000;
    padding: 2mm 2.5mm;
    margin-bottom: 2.5mm;
    font-size: 9pt;
  }
  .drs-categories .cat { display: flex; align-items: center; gap: 1.2mm; }
  .drs-categories .case-cat {
    display: inline-block;
    width: 3.9mm;
    height: 3.9mm;
    border: .75pt solid #000;
    text-align: center;
    line-height: 3.7mm;
    font-size: 8.5pt;
    font-weight: 700;
  }

  .drs-recap { border-collapse: collapse; width: 102mm; margin-left: auto; margin-top: 3mm; }
  .drs-recap td { border: .75pt solid #000; padding: 1.7mm 2.5mm; font-size: 9.5pt; }
  .drs-recap td.num { text-align: right; font-variant-numeric: tabular-nums; }
  .drs-recap tr.total td { font-weight: 700; }

  .cnss-note-cnss { font-size: 8.5pt; font-style: italic; margin-top: 2mm; }

  /* --- Verso : instructions --- */
  .verso h2 { font-size: 11pt; font-weight: 700; text-align: center; margin: 0 0 3mm; letter-spacing: .5pt; }
  .verso h3 { font-size: 9pt; font-weight: 700; margin: 4mm 0 1.5mm; }
  .verso p, .verso li { font-size: 8.5pt; line-height: 1.5; text-align: justify; }
  .verso .tab-codes { border-collapse: collapse; width: 100%; margin: 2mm 0; }
  .verso .tab-codes th, .verso .tab-codes td {
    border: .75pt solid #000;
    padding: 1.2mm;
    font-size: 7.5pt;
    text-align: center;
  }
  .verso .tab-codes th { font-weight: 700; }

  /* ================= Bulletin de paie ================= */
  .bulletin { font-size: 8.5pt; }

  /* En-tête : titre, filet dégradé, période. Sobre mais soigné. */
  .bp-entete { text-align: center; margin-bottom: 5mm; }
  .bp-titre {
    font-size: 19pt; font-weight: 300; letter-spacing: 3pt;
    text-transform: uppercase; color: var(--doc-marque); line-height: 1.1;
  }
  .bp-filet {
    width: 46mm; height: 1.6pt; margin: 2mm auto 1.6mm;
    background: linear-gradient(90deg, transparent, var(--doc-marque-clair) 25%, var(--doc-marque-clair) 75%, transparent);
  }
  .bp-periode-titre {
    font-size: 9.5pt; font-weight: 700; color: var(--doc-gris);
    text-transform: capitalize; letter-spacing: .3pt;
  }

  /* Intitulé discret en haut de chaque cadre */
  .bp-cadre-titre {
    font-size: 6.5pt; font-weight: 800; text-transform: uppercase; letter-spacing: .8pt;
    color: var(--doc-marque-clair); margin-bottom: 1.2mm;
  }

  /* Bandeau haut : employeur encadré à gauche, période à droite */
  .bp-haut { display: flex; gap: 4mm; align-items: stretch; }
  .bp-employeur, .bp-periode {
    flex: 1; border: .75pt solid var(--doc-filet); border-radius: 1.5mm;
    padding: 2.5mm 3.5mm; background: #fdfcfe;
  }
  .bp-emp-nom { font-weight: 800; font-size: 11pt; line-height: 1.2; color: #241b34; }
  .bp-emp-adr { font-size: 8.5pt; line-height: 1.45; margin-top: .8mm; color: var(--doc-gris); }
  .bp-periode > div:not(.bp-cadre-titre) {
    display: flex; justify-content: space-between; gap: 4mm;
    padding: .75mm 0; font-size: 8.5pt;
    border-bottom: .4pt dotted #e0daea;
  }
  .bp-periode > div:last-child { border-bottom: none; }
  .bp-periode span { color: var(--doc-gris); }
  .bp-periode strong { font-variant-numeric: tabular-nums; }

  .bp-emp-ids { font-size: 7pt; color: var(--doc-gris); margin-top: 1.5mm; line-height: 1.4; }

  /* Bandeau du salarié : c'est lui qu'on identifie en premier */
  .bp-salarie {
    display: flex; justify-content: space-between; align-items: flex-start; gap: 8mm;
    border: .75pt solid var(--doc-filet); border-left: 2.5pt solid var(--doc-marque-clair); border-radius: 1.5mm;
    padding: 2.8mm 3.5mm; margin-top: 3mm; background: var(--doc-fond-doux);
  }
  .bp-sal-gauche { flex: 1; }
  .bp-sal-nom { font-weight: 800; font-size: 13pt; line-height: 1.15; letter-spacing: -.2pt; }
  .bp-sal-emploi { font-size: 10pt; font-weight: 600; color: var(--doc-marque); margin-top: .4mm; }
  .bp-sal-contact { font-size: 8pt; color: var(--doc-gris); margin-top: 1.2mm; line-height: 1.4; }
  .bp-sal-refs { display: flex; gap: 9mm; text-align: right; }
  .bp-sal-refs div { display: flex; flex-direction: column; }
  .bp-sal-refs span {
    font-size: 6.5pt; text-transform: uppercase; letter-spacing: .4pt; color: var(--doc-gris);
  }
  .bp-sal-refs strong { font-size: 10.5pt; font-variant-numeric: tabular-nums; }

  /* Bande de classification en trois colonnes */
  .bp-classif {
    display: flex; gap: 0; margin: 3mm 0 2.5mm;
    border: .75pt solid var(--doc-filet); border-radius: 1.5mm; overflow: hidden;
  }
  .bp-classif > div { flex: 1; padding: 2mm 2.8mm; border-right: .5pt solid #e0daea; }
  .bp-classif > div:last-child { border-right: none; }
  .kv2 { display: flex; justify-content: space-between; gap: 3mm; font-size: 8pt; padding: .5mm 0; }
  .kv2 span { color: var(--doc-gris); }
  .kv2 b { font-variant-numeric: tabular-nums; text-align: right; }
  .kv2-total { border-top: .5pt solid var(--doc-filet); margin-top: .8mm; padding-top: .8mm; font-weight: 800; }

  /* Corps du bulletin */
  .bp-table { width: 100%; border-collapse: collapse; }
  .bp-table th, .bp-table td {
    border: .5pt solid var(--doc-gris-clair); padding: 1.1mm 1.6mm; font-size: 8pt;
  }
  .bp-table thead th {
    background: var(--doc-accent-pale); color: var(--doc-marque); font-weight: 700;
    text-align: center; font-size: 7pt; text-transform: uppercase; letter-spacing: .3pt;
  }
  .bp-th-design { text-align: left !important; width: 72mm; }
  .bp-design { text-align: left; }
  .bp-table td.num { text-align: right; font-variant-numeric: tabular-nums; }
  .bp-table tr.bp-section td {
    background: var(--doc-fond-doux); font-weight: 800; font-size: 7.5pt;
    text-transform: uppercase; letter-spacing: .4pt; color: var(--doc-marque);
  }
  .bp-table tr.bp-total td { background: var(--doc-accent-pale); font-weight: 800; }
  .bp-table tr.bp-negatif td.num { color: #be123c; }

  /* Net à payer : la ligne que le salarié regarde en premier */
  .bp-net {
    display: flex; justify-content: space-between; align-items: center;
    margin-top: 3.5mm; padding: 3.5mm 5mm; border-radius: 2mm;
    background: linear-gradient(100deg, var(--doc-marque), var(--doc-marque-clair) 60%, #9d2f7a);
    color: #fff;
  }
  .bp-net-lib { font-size: 11pt; font-weight: 700; letter-spacing: 1.2pt; text-transform: uppercase; }
  .bp-net-val { font-size: 17pt; font-weight: 800; font-variant-numeric: tabular-nums; }

  /* Trois encadrés de synthèse */
  .bp-bas { display: flex; gap: 3mm; margin-top: 3mm; }
  .bp-encadre {
    flex: 1; border: .75pt solid var(--doc-filet); border-radius: 1mm; padding: 2mm 2.5mm;
  }
  .bp-encadre-titre {
    font-size: 7pt; font-weight: 800; text-transform: uppercase; letter-spacing: .4pt;
    color: var(--doc-marque); margin-bottom: 1.2mm; padding-bottom: .8mm;
    border-bottom: .5pt solid var(--doc-filet-fin);
  }
  .bp-cout { background: var(--doc-fond-doux); }

  .bp-signatures { display: flex; justify-content: space-between; gap: 12mm; margin-top: 5mm; }
  .bp-ligne-sign {
    margin-top: 10mm; border-top: .75pt dotted var(--doc-gris-clair); padding-top: 1.2mm;
    font-size: 7.5pt; color: var(--doc-gris);
  }

  .bp-pied {
    margin-top: auto; padding-top: 3mm; border-top: .5pt solid var(--doc-filet-fin);
    font-size: 6.5pt; color: var(--doc-gris); text-align: center; line-height: 1.5;
  }

  /* --- Fiche individuelle du personnel --- */
  .fp-bandeau {
    display: flex;
    align-items: center;
    gap: 5mm;
    border: .75pt solid var(--doc-filet);
    border-left: 3pt solid var(--doc-marque-clair);
    border-radius: 1.5mm;
    padding: 2.8mm 3.5mm;
    margin-bottom: 3mm;
  }
  .fp-photo {
    width: 26mm;
    height: 33mm;
    object-fit: cover;
    border: .75pt solid var(--doc-gris-clair);
    flex-shrink: 0;
  }
  .fp-photo-vide {
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--doc-gris-clair);
    font-size: 8pt;
    border-style: dashed;
  }
  .fp-identite { flex: 1; }
  .fp-nom { font-size: 15pt; font-weight: 800; letter-spacing: -.3pt; line-height: 1.1; }
  .fp-poste { font-size: 10.5pt; font-weight: 600; color: var(--doc-gris); margin-top: .8mm; }
  .fp-statut { font-size: 9pt; color: var(--doc-gris); margin-top: 1.5mm; }
  .fp-refs { text-align: right; display: flex; flex-direction: column; gap: 2mm; }
  .fp-refs span {
    display: block;
    font-size: 7pt;
    text-transform: uppercase;
    letter-spacing: .4pt;
    color: var(--doc-gris);
  }
  .fp-refs strong { font-size: 10.5pt; font-variant-numeric: tabular-nums; }

  .fp-section {
    font-size: 9.5pt;
    font-weight: 800;
    color: var(--doc-marque);
    text-transform: uppercase;
    letter-spacing: .4pt;
    margin: 2.8mm 0 1.2mm;
    padding-bottom: .6mm;
    border-bottom: .75pt solid var(--doc-filet);
  }

  .fp-grille { display: grid; grid-template-columns: 1fr 1fr; gap: 0 6mm; }
  .fp-champ {
    display: flex;
    justify-content: space-between;
    gap: 3mm;
    padding: .75mm 0;
    border-bottom: .4pt dotted var(--doc-filet);
    font-size: 9pt;
  }
  .fp-k { color: var(--doc-gris); }
  .fp-v { font-weight: 600; text-align: right; }

  .fp-table { width: 100%; border-collapse: collapse; margin-top: 1.5mm; }
  .fp-table th, .fp-table td {
    border: .5pt solid var(--doc-filet);
    padding: 1mm 2mm;
    font-size: 8.5pt;
    text-align: left;
  }
  .fp-table th { background: var(--doc-fond-doux); font-weight: 700; font-size: 7.5pt; text-transform: uppercase; }
  .fp-notes { font-size: 9pt; }

  /* --- Listes (personnel, contrats) --- */
  .liste-sous-titre {
    font-size: 10pt;
    font-weight: 700;
    color: var(--doc-gris);
    margin-bottom: 3mm;
  }
  .tab-liste { width: 100%; border-collapse: collapse; }
  .tab-liste th, .tab-liste td {
    border: .5pt solid #b8afc9;
    padding: 1.2mm 1.6mm;
    font-size: 7.8pt;
    vertical-align: middle;
  }
  .tab-liste thead th {
    background: var(--doc-accent-pale);
    text-align: center;
    font-weight: 700;
    font-size: 7.2pt;
    text-transform: uppercase;
    letter-spacing: .2pt;
    color: var(--doc-marque);
  }
  .tab-liste td.c { text-align: center; }
  .tab-liste td.num { text-align: right; font-variant-numeric: tabular-nums; }
  .tab-liste tbody tr:nth-child(even) td { background: var(--doc-fond-doux); }
  .tab-liste tr.total td {
    background: var(--doc-accent-pale);
    font-weight: 800;
    border-top: .75pt solid var(--doc-marque-clair);
  }
  .liste-note { font-size: 7.5pt; color: var(--doc-gris); margin-top: 2mm; }
  .liste-signature { margin-top: 8mm; text-align: right; font-size: 9pt; }
  .liste-signature .ligne {
    margin-top: 12mm;
    border-top: .75pt dotted var(--doc-gris-clair);
    padding-top: 1.5mm;
    color: var(--doc-gris);
    font-size: 8pt;
    display: inline-block;
    min-width: 55mm;
  }

  /* ============ Actes individuels · composition typographique ============
     Un acte administratif tire son sérieux de trois choses : une hiérarchie
     nette entre le titre et le corps, du blanc généreux, et une typographie
     à empattements pour les parties nobles. La couleur n'y sert qu'à marquer
     l'émetteur : sceau et filets, jamais le texte courant. */

  .acte {
    color: var(--doc-encre);
    padding: 14mm 18mm 12mm;
  }

  /* ------------------------------------------------------------- en-tête */

  .acte-entete {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10mm;
  }
  .ae-gauche { display: flex; align-items: flex-start; gap: 5mm; flex: 1; min-width: 0; }

  /* Sceau : double anneau et monogramme. Tient lieu d'emblème tant que
     l'établissement n'a pas de logo à charger. */
  .ae-sceau {
    flex: none;
    width: 17mm;
    height: 17mm;
    border-radius: 50%;
    border: 1.4pt solid var(--doc-marque);
    box-shadow: inset 0 0 0 1.6pt #fff, inset 0 0 0 2.3pt var(--doc-marque-clair);
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--doc-serif);
    font-size: 15pt;
    font-weight: 700;
    letter-spacing: .5pt;
    color: var(--doc-marque);
  }
  /* Logo importé par le client, à la place du sceau à monogramme. */
  .ae-logo {
    flex: none;
    width: 20mm;
    height: 20mm;
    object-fit: contain;
  }

  .ae-bloc { min-width: 0; padding-top: .5mm; }
  .ae-nom {
    font-family: var(--doc-serif);
    font-size: 20pt;
    font-weight: 700;
    line-height: 1.05;
    letter-spacing: .2pt;
    color: var(--doc-encre);
  }
  /* Petit filet sous la raison sociale : sépare la marque de la ligne
     d'activité sans ajouter d'espace. */
  .ae-regle {
    width: 26mm;
    height: 1.6pt;
    background: var(--doc-marque-clair);
    margin: 1.8mm 0;
  }
  .ae-activite {
    font-size: 9pt;
    font-style: italic;
    color: var(--doc-gris);
    letter-spacing: .2pt;
  }
  .ae-coord {
    font-size: 8.2pt;
    color: var(--doc-gris);
    line-height: 1.6;
    margin-top: 1.5mm;
  }

  /* Cartouche des identifiants légaux */
  .ae-cartouche {
    flex: none;
    min-width: 46mm;
    border: .6pt solid var(--doc-filet);
    border-top: 2pt solid var(--doc-marque);
    padding: 2.5mm 3.5mm;
    background: var(--doc-fond-doux);
  }
  .ae-cart-titre {
    font-size: 6.6pt;
    text-transform: uppercase;
    letter-spacing: 1.1pt;
    color: var(--doc-gris-clair);
    text-align: center;
    padding-bottom: 1.2mm;
    margin-bottom: 1.8mm;
    border-bottom: .5pt solid var(--doc-filet);
  }
  .ae-cart-l { display: flex; justify-content: space-between; gap: 4mm; padding: .5mm 0; }
  .ae-cart-l span { font-size: 7.2pt; color: var(--doc-gris); white-space: nowrap; }
  .ae-cart-l b {
    font-size: 8.4pt;
    font-variant-numeric: tabular-nums;
    letter-spacing: .2pt;
  }

  /* Double filet : trait épais puis filet fin, séparés d'un blanc */
  .acte-double-filet {
    margin-top: 5mm;
    border-top: 2.2pt solid var(--doc-marque);
    border-bottom: .6pt solid var(--doc-filet);
    height: 1.4mm;
  }

  /* -------------------------------------------------------------- titre */

  .acte-titre-bloc { text-align: center; margin: 11mm 0 9mm; }
  .acte-titre {
    margin: 0;
    font-family: var(--doc-serif);
    font-size: 17pt;
    font-weight: 700;
    letter-spacing: 3.4pt;
    text-indent: 3.4pt; /* compense l'interlettrage sur le dernier signe */
    text-transform: uppercase;
    line-height: 1.3;
  }
  /* Fleuron : losange encadré de deux filets courts */
  .acte-fleuron {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 3mm;
    margin-top: 3.5mm;
    font-size: 8.5pt;
    color: var(--doc-marque-clair);
  }
  .acte-fleuron i { display: block; width: 22mm; height: .7pt; background: var(--doc-filet); }
  .acte-sous-titre {
    margin-top: 3mm;
    font-size: 9.5pt;
    font-style: italic;
    color: var(--doc-gris);
  }
  .acte-reference {
    margin-top: 3.5mm;
    font-size: 8.6pt;
    font-weight: 700;
    letter-spacing: .6pt;
    font-variant-numeric: tabular-nums;
    color: var(--doc-marque);
  }
  .acte-reference span {
    display: block;
    font-size: 6.6pt;
    font-weight: 400;
    letter-spacing: 1.1pt;
    text-transform: uppercase;
    color: var(--doc-gris-clair);
    margin-bottom: .6mm;
  }

  /* --------------------------------------------------------- pied d'acte */

  .acte-pied {
    margin-top: auto;
    padding-top: 3mm;
    border-top: .6pt solid var(--doc-filet-fin);
    text-align: center;
    font-size: 7pt;
    letter-spacing: .5pt;
    text-transform: uppercase;
    color: var(--doc-gris-clair);
  }

  /* --------------------- Corps des actes : lettres et attestations -------
     Texte à empattements, interligne large, justification. Le paragraphe qui
     identifie le salarié est isolé entre deux filets plutôt qu'enfermé dans
     une boîte colorée : c'est la mise en page d'un acte, pas d'une page web. */

  .lettre {
    font-family: var(--doc-serif);
    font-size: 11.5pt;
    line-height: 1.85;
    text-align: justify;
    hyphens: auto;
  }
  .lettre p { margin: 0 0 5mm; }

  /* Lettrine d'attaque : donne le ton dès le premier mot. */
  .lettre > p:first-child::first-line {
    font-variant: small-caps;
    letter-spacing: .3pt;
  }

  .lettre-sujet {
    margin: 6mm 0 !important;
    padding: 5mm 8mm;
    border-top: .6pt solid var(--doc-filet);
    border-bottom: .6pt solid var(--doc-filet);
    background: var(--doc-fond-doux);
    line-height: 1.95;
    text-align: justify;
  }
  /* Le nom du salarié, en petites capitales : c'est lui qu'on cherche. */
  .lettre-sujet strong:first-of-type {
    font-variant: small-caps;
    letter-spacing: .6pt;
    font-size: 12pt;
  }

  .lettre-mention {
    margin-top: 8mm !important;
    font-style: italic;
    font-size: 10.5pt;
    color: var(--doc-gris);
    text-align: center;
  }

  /* ------------------------------------------------------ bloc signature */

  .lettre-signature {
    margin-top: 12mm;
    margin-left: auto;
    width: 82mm;
    text-align: center;
    font-family: var(--doc-serif);
    font-size: 10.5pt;
  }
  .lettre-signature .ls-lieu {
    text-align: right;
    font-style: italic;
    color: var(--doc-gris);
    margin-bottom: 7mm;
  }
  .lettre-signature .ls-qualite {
    font-size: 9.5pt;
    color: var(--doc-gris);
  }
  .lettre-signature .ls-nom {
    margin-top: 1mm;
    font-weight: 700;
    font-size: 11.5pt;
    letter-spacing: .3pt;
  }
  /* Emplacement réservé au cachet : un cadre discret vaut mieux qu'un trait,
     il indique où apposer le tampon sans préjuger de sa taille. */
  .lettre-signature .ligne {
    margin-top: 3mm;
    height: 26mm;
    border: .6pt dashed var(--doc-filet);
    border-radius: 1.5mm;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    padding-bottom: 1.5mm;
    font-family: 'Segoe UI', system-ui, sans-serif;
    font-size: 6.8pt;
    letter-spacing: 1pt;
    text-transform: uppercase;
    color: var(--doc-gris-clair);
  }

  /* --- Contrat : texte juridique --- */
  h2.article {
    font-size: 10pt;
    font-weight: 800;
    color: var(--doc-marque);
    margin: 4mm 0 1.5mm;
    padding-bottom: 1mm;
    border-bottom: .5pt solid var(--doc-filet-fin);
    text-transform: uppercase;
    letter-spacing: .3pt;
  }
  p { margin: 0 0 2mm; text-align: justify; }
  .preambule { font-size: 9.5pt; }
  ul { margin: 0 0 2mm 5mm; padding: 0; }
  li { margin-bottom: 1mm; font-size: 9.5pt; }
`

/**
 * Enveloppe un corps HTML dans un document A4 complet et stylé.
 * L'orientation pilote `@page` : elle doit correspondre au format du formulaire
 * (le BNTS officiel est en paysage, la DRS en portrait).
 */
// Couleur d'accent des documents, choisie dans les réglages. `null` = neutre
// (les valeurs par défaut du :root s'appliquent). Fixée une fois au démarrage
// et à chaque enregistrement des réglages, elle vaut pour tous les documents
// (impression comme aperçu), sans avoir à la passer à chaque appel.
let couleurDoc: string | null = null

/** Définit (ou efface avec `null`/'') la couleur d'accent des documents. */
export function definirCouleurDocuments(hex: string | null): void {
  couleurDoc = hex && /^#[0-9a-fA-F]{6}$/.test(hex.trim()) ? hex.trim() : null
}

/** Éclaircit ou assombrit une couleur #rrggbb de `ratio` (négatif = assombrir). */
function melanger(hex: string, ratio: number): string {
  const n = parseInt(hex.slice(1), 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  const vers = ratio >= 0 ? 255 : 0
  const t = Math.abs(ratio)
  const c = (x: number): string =>
    Math.round(x + (vers - x) * t)
      .toString(16)
      .padStart(2, '0')
  return `#${c(r)}${c(g)}${c(b)}`
}

/** Surcharge CSS de l'accent quand une couleur est choisie ; vide sinon. */
function surchargeCouleur(): string {
  if (!couleurDoc) return ''
  const fonce = melanger(couleurDoc, -0.35) // accent foncé (titres, texte d'accent)
  const pale = melanger(couleurDoc, 0.9) // teinte pâle (fonds de tableau)
  return (
    `:root{--doc-marque:${fonce};--doc-marque-clair:${couleurDoc};` +
    `--doc-accent-pale:${pale};}`
  )
}

export function wrapDocument(
  titre: string,
  corpsHtml: string,
  orientation: Orientation = 'portrait'
): string {
  const taillePage = orientation === 'paysage' ? 'A4 landscape' : 'A4 portrait'
  return (
    `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${titre}</title>` +
    `<style>@page { size: ${taillePage}; margin: 0; }${STYLE}${surchargeCouleur()}</style></head>` +
    `<body>${corpsHtml}</body></html>`
  )
}

/** Ouvre la boîte d'impression de Chromium (« Enregistrer au format PDF » possible). */
export function imprimerDocument(
  titre: string,
  corpsHtml: string,
  orientation: Orientation = 'portrait'
): void {
  const iframe = document.createElement('iframe')
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'
  document.body.appendChild(iframe)

  const doc = iframe.contentDocument
  if (!doc) return
  doc.open()
  doc.write(wrapDocument(titre, corpsHtml, orientation))
  doc.close()

  const win = iframe.contentWindow
  if (!win) return
  const lancer = (): void => {
    win.focus()
    win.print()
    // Laisse le temps à la boîte d'impression de s'ouvrir avant de retirer l'iframe.
    setTimeout(() => iframe.remove(), 1500)
  }
  if (doc.readyState === 'complete') setTimeout(lancer, 80)
  else win.addEventListener('load', () => setTimeout(lancer, 80))
}

/**
 * Nom de fichier d'un document produit : le code d'archivage d'abord, puis la
 * date du jour. C'est ce nom que le titre de la page transmet à la boîte
 * « Enregistrer au format PDF », et celui du fichier exporté.
 *
 * Les caractères interdits par Windows (\ / : * ? " < > |) sont remplacés,
 * sans quoi l'enregistrement échoue silencieusement : les références de
 * déclaration contiennent des tirets, mais un code saisi à la main peut
 * contenir n'importe quoi.
 */
export function nomFichierDocument(parties: (string | null | undefined)[]): string {
  const jour = new Date().toISOString().slice(0, 10)
  return [...parties, jour]
    .filter((p): p is string => Boolean(p && p.trim()))
    .map((p) =>
      p
        .trim()
        .replace(/[\\/:*?"<>|]+/g, '-')
        .replace(/\s+/g, '-')
        .replace(/-{2,}/g, '-')
        .replace(/^-|-$/g, '')
    )
    .filter(Boolean)
    .join('_')
}

/** Génère une chaîne CSV (séparateur point-virgule, standard Excel FR). */
export function toCsv(entetes: string[], lignes: (string | number)[][]): string {
  const echap = (v: string | number): string => {
    const s = String(v)
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [entetes, ...lignes].map((l) => l.map(echap).join(';')).join('\r\n')
}
