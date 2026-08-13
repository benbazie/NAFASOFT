import type {
  AppConfig,
  ContractData,
  ContractInput,
  Employee,
  DeclarationDto,
  PayrollRow,
  PayrollSettings
} from '../../../shared/types'
import { CATEGORIES_CNSS, CONFIG_DEFAUT } from '../../../shared/types'
import { formatDate } from './format'

// ---------------------------------------------------------------- utilitaires

const esc = (s: string): string =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

/** Montant en devise, sans décimale (le franc CFA n'a pas de sous-unité). */
const mt = (n: number, devise: string): string =>
  Math.round(n).toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' ' + devise

const pct = (t: number): string => (t * 100).toFixed(2).replace('.', ',') + ' %'

const kv = (k: string, v: string): string =>
  `<div class="kv"><span class="k">${esc(k)}</span><span class="v">${esc(v)}</span></div>`

/** Libellé complet d'une catégorie CNSS à partir de son code (colonne 9 du BNTS). */
function libelleCategorie(code: string): string {
  const info = CATEGORIES_CNSS.find((c) => c.code === code)
  return info ? `${info.code} · ${info.libelle}` : code
}

/** Nom du mois et année d'une date ISO (ex. « juillet 2026 »). */
function libellePeriode(debut: string, fin: string): string {
  const d = new Date(debut + 'T00:00:00')
  const f = new Date(fin + 'T00:00:00')
  const mois = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  const memeMois = d.getMonth() === f.getMonth() && d.getFullYear() === f.getFullYear()
  return memeMois ? mois : `${formatDate(debut)} · ${formatDate(fin)}`
}

/** Ancienneté en années/mois depuis la date d'embauche. */
function anciennete(dateEmbauche: string | null): string {
  if (!dateEmbauche) return '—'
  const d = new Date(dateEmbauche + 'T00:00:00')
  const now = new Date()
  let mois = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth())
  if (now.getDate() < d.getDate()) mois--
  if (mois < 0) return '—'
  const ans = Math.floor(mois / 12)
  const reste = mois % 12
  if (ans === 0) return `${reste} mois`
  return reste === 0 ? `${ans} an(s)` : `${ans} an(s) ${reste} mois`
}

function enteteDoc(config: AppConfig, typeDoc: string, sousTitre: string): string {
  const coordonnees = [config.entreprise_adresse, config.entreprise_ville]
    .filter(Boolean)
    .map(esc)
    .join(' · ')
  const contacts = [
    config.entreprise_telephone ? `Tél. ${esc(config.entreprise_telephone)}` : '',
    config.entreprise_email ? esc(config.entreprise_email) : ''
  ]
    .filter(Boolean)
    .join(' · ')
  const identifiants = [
    config.numero_employeur_cnss ? `N° employeur CNSS : ${esc(config.numero_employeur_cnss)}` : '',
    config.ifu ? `IFU : ${esc(config.ifu)}` : '',
    config.rccm ? `RCCM : ${esc(config.rccm)}` : ''
  ]
    .filter(Boolean)
    .join(' · ')

  return `
    <div class="doc-entete">
      <div>
        <div class="doc-marque">${esc(config.entreprise_nom)}</div>
        <div class="doc-employeur">
          ${esc(config.entreprise_activite)}
          ${coordonnees ? `<br>${coordonnees}` : ''}
          ${contacts ? `<br>${contacts}` : ''}
          ${identifiants ? `<br><span class="doc-ids">${identifiants}</span>` : ''}
        </div>
      </div>
      <div>
        <div class="doc-type">${esc(typeDoc)}</div>
        <div class="doc-periode">${sousTitre}</div>
      </div>
    </div>`
}

// ---------------------------------------------------------------- bulletin de paie

export interface BulletinContexte {
  periode_debut: string
  periode_fin: string
  config: AppConfig
  settings: PayrollSettings
}

/**
 * Bulletin de paie sur une page A4 : identité, gains, retenues salariales
 * (CNSS + IUTS), net à payer et charges patronales.
 */
export function bulletinHtml(r: PayrollRow, ctx: BulletinContexte): string {
  const dev = ctx.config.devise
  const c = ctx.config
  const periode = libellePeriode(ctx.periode_debut, ctx.periode_fin)

  // Montant nu : la devise n'est répétée qu'au net à payer.
  const n = (v: number): string => Math.round(v).toLocaleString('fr-FR')

  const categorie = CATEGORIES_CNSS.find((x) => x.code === r.categorie_cnss)
  const dureeMensuelle = r.heures_total > 0 ? r.heures_total : r.heures_normales

  /** Une ligne du corps : gains à gauche, retenues à droite. */
  const ligne = (
    designation: string,
    base: string,
    taux: string,
    gain: string,
    retenue: string,
    classe = ''
  ): string => `
      <tr class="${classe}">
        <td class="bp-design">${designation}</td>
        <td class="num">${base}</td>
        <td class="num">${taux}</td>
        <td class="num">${gain}</td>
        <td class="num">${retenue}</td>
      </tr>`

  const section = (titre: string): string =>
    `<tr class="bp-section"><td colspan="5">${esc(titre)}</td></tr>`

  // Rémunération : salaire de base, heures supplémentaires, primes et indemnités.
  const lignesGains = r.gains
    .map((g) =>
      ligne(esc(g.libelle), esc(g.base), esc(g.taux), n(g.montant), '', g.montant < 0 ? 'bp-negatif' : '')
    )
    .join('')

  // Retenues : CNSS, IUTS, puis les retenues saisies (avances, prêts…).
  const lignesRetenues = r.retenues
    .map((d) => ligne(esc(d.libelle), esc(d.base), esc(d.taux), '', n(d.montant)))
    .join('')

  const adresseEmployeur = [c.entreprise_adresse, c.entreprise_ville]
    .filter(Boolean)
    .map(esc)
    .join('<br>')
  const identifiants = [
    c.numero_employeur_cnss ? `N° EMPLOYEUR CNSS : ${esc(c.numero_employeur_cnss)}` : '',
    c.ifu ? `IFU : ${esc(c.ifu)}` : ''
  ]
    .filter(Boolean)
    .join('<br>')

  return `
  <div class="page bulletin">
    <div class="bp-entete">
      <div class="bp-titre">Bulletin de paie</div>
      <div class="bp-filet"></div>
      <div class="bp-periode-titre">${esc(periode)}</div>
    </div>

    <div class="bp-haut">
      <div class="bp-employeur">
        <div class="bp-cadre-titre">Employeur</div>
        <div class="bp-emp-nom">${esc(c.entreprise_nom)}</div>
        <div class="bp-emp-adr">${adresseEmployeur}</div>
        ${identifiants ? `<div class="bp-emp-ids">${identifiants}</div>` : ''}
      </div>
      <div class="bp-periode">
        <div class="bp-cadre-titre">Période de paie</div>
        <div><span>Début de période</span><strong>${formatDate(ctx.periode_debut)}</strong></div>
        <div><span>Fin de période</span><strong>${formatDate(ctx.periode_fin)}</strong></div>
        <div><span>Début du contrat</span><strong>${
          r.date_embauche ? formatDate(r.date_embauche) : 'Non renseigné'
        }</strong></div>
        <div><span>Ancienneté</span><strong>${anciennete(r.date_embauche)}</strong></div>
      </div>
    </div>

    <div class="bp-salarie">
      <div class="bp-sal-gauche">
        <div class="bp-cadre-titre">Salarié</div>
        <div class="bp-sal-nom">${esc(r.nom.toUpperCase())} ${esc(r.prenom)}</div>
        <div class="bp-sal-emploi">${esc(r.poste || 'Emploi non précisé')}</div>
        <div class="bp-sal-contact">
          ${r.adresse ? `${esc(r.adresse)}<br>` : ''}
          ${r.telephone ? `Tél. ${esc(r.telephone)}` : ''}
        </div>
      </div>
      <div class="bp-sal-refs">
        <div><span>Matricule</span><strong>${esc(r.matricule)}</strong></div>
        <div><span>N° CNSS</span><strong>${esc(r.numero_cnss || 'Non renseigné')}</strong></div>
      </div>
    </div>

    <div class="bp-classif">
      <div>
        <div class="kv2"><span>Emploi</span><b>${esc(r.poste || 'Non renseigné')}</b></div>
        <div class="kv2"><span>Qualification</span><b>${
          r.cadre ? 'Cadre' : 'Employé / ouvrier'
        }</b></div>
      </div>
      <div>
        <div class="kv2"><span>Catégorie CNSS</span><b>${esc(
          categorie ? `${categorie.code} · ${categorie.libelle.split(' /')[0]}` : r.categorie_cnss
        )}</b></div>
        <div class="kv2"><span>Contrat</span><b>${esc(r.type_contrat)}</b></div>
      </div>
      <div>
        <div class="kv2"><span>SALAIRE DE BASE</span><b>${n(r.salaire_base)}</b></div>
        <div class="kv2"><span>TAUX HORAIRE</span><b>${n(r.taux_horaire)}</b></div>
      </div>
      <div>
        <div class="kv2"><span>DURÉE DE TRAVAIL</span><b>${dureeMensuelle.toFixed(2)} H</b></div>
        <div class="kv2"><span>JOURS D'ABSENCE</span><b>${r.jours_absence}</b></div>
      </div>
      <div>
        <div class="kv2"><span>PERSONNES À CHARGE</span><b>${r.personnes_a_charge}</b></div>
        <div class="kv2"><span>ABATTEMENT IUTS</span><b>${pct(r.taux_abattement)}</b></div>
      </div>
    </div>

    <table class="bp-table">
      <thead>
        <tr>
          <th class="bp-th-design">DÉSIGNATION</th>
          <th class="num">BASE</th>
          <th class="num">TAUX</th>
          <th class="num">GAINS</th>
          <th class="num">RETENUES</th>
        </tr>
      </thead>
      <tbody>
        ${section('Rémunération')}
        ${lignesGains}
        ${ligne('SALAIRE BRUT', '', '', n(r.brut_imposable), '', 'bp-total')}

        ${section('Retenues')}
        ${lignesRetenues}
        ${ligne('TOTAL DES RETENUES', '', '', '', n(r.total_retenues), 'bp-total')}
      </tbody>
    </table>

    <div class="bp-net">
      <span class="bp-net-lib">NET À PAYER</span>
      <span class="bp-net-val">${n(r.net_a_payer)} ${esc(dev)}</span>
    </div>

    <div class="bp-signatures">
      <div>
        <strong>L'Employeur</strong>
        <div class="bp-ligne-sign">Cachet et signature</div>
      </div>
      <div style="text-align:right">
        <strong>Le Salarié</strong>
        <div class="bp-ligne-sign">Signature pour acquit</div>
      </div>
    </div>

    <div class="bp-pied">
      Bulletin établi le ${formatDate(new Date().toISOString().slice(0, 10))} par
      ${esc(c.entreprise_nom)}. Dans votre intérêt et pour vous aider à faire valoir vos droits,
      conservez ce bulletin de paie sans limitation de durée.
    </div>
  </div>`
}

// ---------------------------------------------------------------- déclarations CNSS

// Les blocs ci-dessous reproduisent le cadre institutionnel imprimé sur les
// formulaires officiels de la CNSS (en-tête, référence de procédure, cartouche
// de certification et coordonnées des directions régionales).

/**
 * En-tête institutionnel. Le cartouche de droite porte le numéro de la
 * déclaration produite · c'est lui qui sert de référence à l'employeur, et non
 * les métadonnées du formulaire vierge.
 */
function enteteCnss(codeDocument: string | null, complement = ''): string {
  return `
    <div class="cnss-bandeau">
      <div class="cnss-institution">
        CAISSE NATIONALE DE SECURITE SOCIALE DU BURKINA FASO
        ${complement ? `<div class="cnss-nb">${complement}</div>` : ''}
      </div>
      <div class="cnss-reference">
        <span class="ref-lib">N° de la déclaration</span>
        <span class="ref-code">${esc(codeDocument || '……………………')}</span>
      </div>
    </div>`
}

/** Cartouche « Certifié exact le … à … » avec zone de signature et cachet. */
function certificationCnss(config: AppConfig, libelle = 'Certifié exact le'): string {
  const auj = formatDate(new Date().toISOString().slice(0, 10))
  return `
    <div class="cnss-certif">
      <div>
        ${esc(libelle)} <strong>${auj}</strong>
        à <strong>${esc(config.entreprise_ville || '……………………………')}</strong>
      </div>
      <div class="signature-zone">
        Signature et cachet
        <div class="mention">
          <strong>${esc(config.representant || '……………………………')}</strong><br>
          <span class="mention-lib">Nom et Prénom(s) du déclarant</span>
        </div>
      </div>
    </div>`
}

/**
 * Bordereau Nominatif des Travailleurs Salariés (BNTS) · imprimé Pr-RCS/Cot 01.
 * Format paysage, onze colonnes numérotées.
 */
/**
 * Nombre de salariés portés par une page de BNTS. Valeur mesurée sur le rendu
 * réel : au-delà, le tableau pousse le pied de page hors de la feuille A4.
 * La dernière page reçoit en plus les deux lignes de totaux, elle est donc
 * dimensionnée sur cette capacité-là pour toutes les pages.
 */
const BNTS_LIGNES_PAR_PAGE = 9

export function bntsHtml(d: DeclarationDto, config: AppConfig, code: string | null = null): string {
  // Taux global de cotisation, somme des branches (21,50 % au Burkina Faso).
  const tauxGlobal =
    (d.branches.reduce((t, b) => t + b.taux, 0) * 100).toFixed(2).replace('.', ',') + ' %'

  // Découpage en pages : un bordereau nominatif peut compter bien plus de
  // salariés qu'une feuille n'en porte. Les totaux ne figurent qu'à la fin.
  const paquets: DeclarationDto['lignes'][] = []
  for (let i = 0; i < d.lignes.length; i += BNTS_LIGNES_PAR_PAGE) {
    paquets.push(d.lignes.slice(i, i + BNTS_LIGNES_PAR_PAGE))
  }
  if (paquets.length === 0) paquets.push([])

  return paquets
    .map((paquet, index) =>
      pageBnts(d, config, code, paquet, index + 1, paquets.length, tauxGlobal)
    )
    .join('')
}

/** Une feuille du bordereau : en-tête, identification, tranche de salariés. */
function pageBnts(
  d: DeclarationDto,
  config: AppConfig,
  code: string | null,
  paquet: DeclarationDto['lignes'],
  numero: number,
  total: number,
  tauxGlobal: string
): string {
  const derniere = numero === total

  const lignes = paquet
    .map(
      (l) => `
      <tr>
        <td class="c">${esc(l.matricule)}</td>
        <td class="c">${esc(l.numero_cnss)}</td>
        <td>${esc(l.nom.toUpperCase())}</td>
        <td>${esc(l.prenom)}</td>
        <td class="c">${formatDate(l.periode_debut)}</td>
        <td class="c">${formatDate(l.periode_fin)}</td>
        <td class="num">${l.salaire_brut.toLocaleString('fr-FR')}</td>
        <td class="num">${l.base_cnss.toLocaleString('fr-FR')}</td>
        <td class="c">${esc(l.categorie)}</td>
        <td class="c">${esc(l.nature)}</td>
        <td></td>
      </tr>`
    )
    .join('')

  // Le formulaire officiel comporte des lignes vierges : on complète la page
  // pour conserver la même hauteur de tableau d'une feuille à l'autre.
  const lignesVides = Array.from(
    { length: Math.max(0, BNTS_LIGNES_PAR_PAGE - paquet.length) },
    () => `<tr>${'<td></td>'.repeat(11)}</tr>`
  ).join('')

  // Totaux et cotisation : uniquement sur la dernière feuille, sinon ils
  // seraient comptés autant de fois qu'il y a de pages.
  const totaux = derniere
    ? `
        <tr class="total">
          <td colspan="6" class="c">TOTAL</td>
          <td class="num">${d.total_salaires_bruts.toLocaleString('fr-FR')}</td>
          <td class="num">${d.total_base_cnss.toLocaleString('fr-FR')}</td>
          <td colspan="3"></td>
        </tr>
        <tr class="a-payer">
          <td colspan="6" class="lib-cot">
            COTISATION À PAYER À LA CNSS (${tauxGlobal})
          </td>
          <td class="num"></td>
          <td class="num">${d.total_cotisations.toLocaleString('fr-FR')}</td>
          <td colspan="3"></td>
        </tr>`
    : ''

  return `
  <div class="page page-paysage form-cnss">
    ${enteteCnss(code)}

    <div class="cnss-titre">Bordereau Nominatif des Travailleurs Salariés</div>

    <div class="cnss-identite">
      <div class="cnss-col-periode">
        <div class="cnss-ligne"><strong>Période de déclaration</strong></div>
        <div class="cnss-ligne"><span class="lib">du</span><span class="val">${formatDate(
          d.periode_debut
        )}</span></div>
        <div class="cnss-ligne"><span class="lib">au</span><span class="val">${formatDate(
          d.periode_fin
        )}</span></div>
      </div>
      <div class="cnss-col-societe">
        <div class="cnss-ligne"><span class="lib">Raison sociale :</span><span class="val">${esc(
          config.entreprise_nom
        )}</span></div>
        <div class="cnss-ligne"><span class="lib">Tél :</span><span class="val">${esc(
          config.entreprise_telephone || '……………………'
        )}</span></div>
        <div class="cnss-ligne"><span class="lib">E-mail :</span><span class="val">${esc(
          config.entreprise_email || '……………………'
        )}</span></div>
      </div>
      <div class="cnss-col-empl">
        <div class="cnss-ligne"><span class="lib">N° empl.</span><span class="val">${esc(
          config.numero_employeur_cnss || '……………………'
        )}</span></div>
        <div class="cnss-ligne"><span class="lib">BP :</span><span class="val">${esc(
          config.entreprise_adresse || '……………………'
        )}</span></div>
        <div class="cnss-ligne"><span class="lib">Nb lignes</span><span class="val">${
          d.effectif
        }</span></div>
        <div class="cnss-ligne"><span class="lib">Feuille</span><span class="val">${numero} / ${total}</span></div>
      </div>
    </div>

    <table class="tab-cnss tab-bnts">
      <thead>
        <tr>
          <th style="width:20mm">N° MATRICULE<br>ENTREPRISE (1)</th>
          <th style="width:26mm">N° IMMATRICULATION<br>CNSS (2)</th>
          <th style="width:44mm">NOM<br>(3)</th>
          <th style="width:44mm">PRENOM(S)<br>(4)</th>
          <th style="width:20mm">PERIODE<br>DU (5)</th>
          <th style="width:20mm">PERIODE<br>AU (6)</th>
          <th style="width:26mm">SAL. BRUT<br>(7)</th>
          <th style="width:26mm">BASE CNSS<br>(8)</th>
          <th style="width:13mm">TYPE<br>(9)</th>
          <th style="width:13mm">NAT.<br>(10)</th>
          <th>OBSERVATIONS<br>(11)</th>
        </tr>
      </thead>
      <tbody>
        ${lignes}
        ${lignesVides}
        ${totaux}
      </tbody>
    </table>

    <div class="cnss-effectif">
      ${
        derniere
          ? `Effectif total des employés : ${d.effectif}
             &nbsp;·&nbsp; Cotisation due (${tauxGlobal}) :
             <strong>${d.total_cotisations.toLocaleString('fr-FR')} ${esc(config.devise)}</strong>`
          : `Suite du bordereau à la feuille ${numero + 1} sur ${total}.`
      }
    </div>

    ${certificationCnss(config)}
  </div>`
}


/**
 * Déclaration Récapitulative des Salaires (DRS) · imprimé Pr-RCS/Cot 04.
 * Format portrait, décompte par branche.
 */
export function drsHtml(d: DeclarationDto, config: AppConfig, code: string | null = null): string {
  const codes = CATEGORIES_CNSS.map((c) => c.code)

  const lignesBranches = d.branches
    .map(
      (b) => `
      <tr>
        <td>${esc(b.nom)}</td>
        ${codes
          .map((code) => {
            const n = b.effectifs[code] ?? 0
            return `<td class="c">${n > 0 ? n : ''}</td>`
          })
          .join('')}
        <td class="num">${b.base.toLocaleString('fr-FR')}</td>
        <td class="c">${(b.taux * 100).toFixed(2).replace('.', ',')} %</td>
        <td class="num">${b.cotisation.toLocaleString('fr-FR')}</td>
      </tr>`
    )
    .join('')

  // Effectif global par catégorie, repris du décompte des branches.
  const effectifGlobal = new Map<string, number>()
  for (const b of d.branches) {
    for (const c of CATEGORIES_CNSS) {
      effectifGlobal.set(c.code, Math.max(effectifGlobal.get(c.code) ?? 0, b.effectifs[c.code] ?? 0))
    }
  }

  return `
  <div class="page form-cnss">
    ${enteteCnss(
      code,
      "NB : pour tous vos règlements, prière de rappeler votre Numéro Employeur.<br>** Cases à remplir par la CNSS"
    )}

    <div class="cnss-titre">DECLARATION RECAPITULATIVE DES SALAIRES</div>

    <div class="drs-haut">
      <div class="drs-rappel">
        <div class="titre-rappel">RAPPEL IMPORTANT</div>
        Cette déclaration doit être obligatoirement envoyée par l'employeur à la CNSS à
        l'appui des cotisations, sous peine des sanctions visées aux articles 18 et 19 de la
        loi 004-2021/AN du 06/04/2021.
      </div>
      <div class="drs-droite">
        <div class="drs-periode-cadre">
          Période du : <strong>${formatDate(d.periode_debut)}</strong>
          &nbsp;&nbsp; au : <strong>${formatDate(d.periode_fin)}</strong>
        </div>
        <div class="drs-societe">
          <div class="ligne-pointillee">
            Raison sociale / Nom et Prénom(s) : <strong>${esc(config.entreprise_nom)}</strong>
          </div>
          <div class="ligne-pointillee">Tél. : <strong>${esc(
            config.entreprise_telephone || '……………………………'
          )}</strong></div>
          <div class="ligne-pointillee">E-Mail : <strong>${esc(
            config.entreprise_email || '……………………………'
          )}</strong></div>
          <div class="ligne-pointillee">B.P : <strong>${esc(
            config.entreprise_adresse || '……………………………'
          )}</strong></div>
        </div>
      </div>
    </div>

    <div class="drs-banque">
      COMPTE BICIA-B OUAGA N° 9053060001001-63 &nbsp;-&nbsp; CCP OUAGA N° 2125 &nbsp;-&nbsp; TRESOR 45000/01
    </div>

    <div class="drs-num-employeur">
      <span class="case">${esc(config.numero_employeur_cnss || '/______________________/')}</span>
      <span class="lib">Numéro employeur</span>
    </div>

    <div class="drs-titre-decompte">DECOMPTE DES COTISATIONS</div>

    <div class="drs-categories">
      ${CATEGORIES_CNSS.map((c) => {
        const n = effectifGlobal.get(c.code) ?? 0
        return `<span class="cat"><span class="case-cat">${n > 0 ? n : ''}</span>${esc(c.libelle)}</span>`
      }).join('')}
    </div>

    <table class="tab-cnss tab-drs">
      <thead>
        <tr>
          <th rowspan="2" style="width:30mm">BRANCHE</th>
          <th colspan="${codes.length}">NOMBRE DE SALARIÉS PAR CATÉGORIE</th>
          <th rowspan="2" style="width:26mm">Base cotisation</th>
          <th rowspan="2" style="width:13mm">Taux %</th>
          <th rowspan="2" style="width:26mm">Cotisation due</th>
        </tr>
        <tr>
          <th class="col-cat">Perm.<br><span class="code-cat">P</span></th>
          <th class="col-cat">Temp.<br><span class="code-cat">T</span></th>
          <th class="col-cat">Jour.<br><span class="code-cat">J</span></th>
          <th class="col-cat">Fonct.<br><span class="code-cat">F</span></th>
          <th class="col-cat">Stag.<br><span class="code-cat">S</span></th>
          <th class="col-cat">Élève<br><span class="code-cat">E</span></th>
          <th class="col-cat">Vol.<br><span class="code-cat">N</span></th>
        </tr>
      </thead>
      <tbody>
        ${lignesBranches}
      </tbody>
    </table>


    <table class="drs-recap">
      <tbody>
        <tr>
          <td>Cotisations principales :</td>
          <td class="num">${d.total_cotisations.toLocaleString('fr-FR')}</td>
        </tr>
        <tr>
          <td>Majorations de retard** :</td>
          <td class="num"></td>
        </tr>
        <tr>
          <td>Majoration pour non production** :</td>
          <td class="num"></td>
        </tr>
        <tr class="total">
          <td>Total des cotisations dues** :</td>
          <td class="num">${d.total_cotisations.toLocaleString('fr-FR')}</td>
        </tr>
      </tbody>
    </table>

    <div class="cnss-note-cnss">** Cases à remplir par la CNSS.</div>

    ${certificationCnss(config, 'Certifié exacte le')}
  </div>`
}


// ---------------------------------------------------------------- contrat de travail

/**
 * Remplace les variables {{cle}} d'un article par les valeurs réelles du contrat.
 * Une variable inconnue est laissée telle quelle, pour que l'erreur soit visible
 * à la relecture plutôt que silencieusement effacée.
 */
export function interpolerArticle(texte: string, d: ContractData): string {
  const valeurs: Record<string, string> = {
    salarie: `${d.salarie_prenom} ${d.salarie_nom.toUpperCase()}`,
    entreprise: d.entreprise_nom,
    poste: d.poste || '……………………',
    type_contrat: d.type_contrat,
    date_debut: formatDate(d.date_debut),
    date_fin: d.type_contrat === 'CDI' ? 'indéterminée' : formatDate(d.date_fin),
    duree_mois: String(d.duree_mois ?? ''),
    salaire: mt(d.salaire_montant, d.devise),
    periodicite: d.mode_salaire === 'mensuel' ? 'mensuel' : 'horaire',
    heures_hebdo: String(d.heures_hebdo),
    jours_repos: String(d.jours_repos),
    periode_essai: d.periode_essai || 'aucune',
    ville: d.entreprise_ville || '……………………',
    representant: d.representant || '……………………'
  }
  return texte.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (entier, cle: string) =>
    cle in valeurs ? valeurs[cle] : entier
  )
}

/**
 * Contrat de travail sur deux pages A4, rédigé selon la structure attendue
 * par le Code du travail burkinabè (loi n° 028-2008/AN).
 */
/**
 * Assemble les données d'impression d'un contrat.
 *
 * Vit ici plutôt que dans l'éditeur : le dossier du salarié réimprime des
 * contrats déjà signés sans passer par l'écran d'édition.
 */
export function donneesContrat(
  c: ContractInput,
  employee: Employee,
  config: AppConfig
): ContractData {
  return {
    entreprise_nom: config.entreprise_nom,
    entreprise_activite: config.entreprise_activite,
    entreprise_adresse: config.entreprise_adresse,
    entreprise_ville: config.entreprise_ville,
    representant: config.representant,
    salarie_nom: employee.nom,
    salarie_prenom: employee.prenom,
    salarie_adresse: employee.adresse ?? '',
    salarie_tel: employee.telephone ?? '',
    salarie_secu: employee.numero_cnss ?? '',
    type_contrat: c.type_contrat,
    poste: c.poste,
    date_debut: c.date_debut,
    duree_mois: c.duree_mois ?? 0,
    date_fin: c.date_fin ?? '',
    mode_salaire: c.mode_salaire,
    salaire_montant: c.salaire_montant,
    heures_hebdo: c.heures_hebdo,
    jours_repos: c.jours_repos,
    periode_essai: c.periode_essai,
    clauses: c.clauses,
    articles: c.articles,
    lieu_signature: c.lieu_signature,
    devise: config.devise
  }
}

export function contratHtml(d: ContractData, config?: AppConfig): string {
  const auj = formatDate(new Date().toISOString().slice(0, 10))

  // L'en-tête reprend l'identité complète de l'établissement (coordonnées et
  // identifiants légaux) : c'est ce qui donne au contrat son aspect officiel.
  const entete: AppConfig = {
    ...CONFIG_DEFAUT,
    ...(config ?? {}),
    entreprise_nom: d.entreprise_nom,
    entreprise_activite: d.entreprise_activite,
    entreprise_adresse: d.entreprise_adresse,
    entreprise_ville: d.entreprise_ville,
    representant: d.representant,
    devise: d.devise
  }

  // Chaque article est numéroté automatiquement ; les sauts de ligne du texte
  // deviennent des paragraphes, et les variables sont remplacées.
  const articles = (d.articles ?? [])
    .filter((a) => a.titre.trim() || a.contenu.trim())
    .map((a, i) => {
      const paragraphes = interpolerArticle(a.contenu, d)
        .split(/\n+/)
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => `<p>${esc(l)}</p>`)
        .join('')
      return `
        <h2 class="article">Article ${i + 1} · ${esc(interpolerArticle(a.titre, d))}</h2>
        ${paragraphes}`
    })
    .join('')

  // Les dispositions particulières restent saisies à part, sous forme de liste.
  const clauses = (d.clauses ?? '')
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => `<li>${esc(l)}</li>`)
    .join('')

  return `
  <div class="page page-flux">
    ${enteteDoc(entete, 'Contrat de travail', `${esc(d.type_contrat)} · établi le ${auj}`)}

    <p class="preambule"><strong>ENTRE LES SOUSSIGNÉS :</strong></p>
    <p class="preambule">
      <strong>${esc(d.entreprise_nom)}</strong>${
        d.entreprise_activite ? `, ${esc(d.entreprise_activite)}` : ''
      }${d.entreprise_adresse ? `, sis à ${esc(d.entreprise_adresse)}` : ''}${
        d.entreprise_ville ? ` · ${esc(d.entreprise_ville)}` : ''
      }, représenté par <strong>${esc(d.representant || '……………………………')}</strong>,
      agissant en qualité de responsable de l'établissement,
      ci-après dénommé « <strong>l'Employeur</strong> »,
    </p>
    <p class="preambule" style="text-align:center"><strong>D'UNE PART,</strong></p>
    <p class="preambule">
      <strong>${esc(d.salarie_nom.toUpperCase())} ${esc(d.salarie_prenom)}</strong>${
        d.salarie_adresse ? `, demeurant à ${esc(d.salarie_adresse)}` : ''
      }${d.salarie_tel ? `, téléphone ${esc(d.salarie_tel)}` : ''}${
        d.salarie_secu ? `, n° CNSS ${esc(d.salarie_secu)}` : ''
      }, ci-après dénommé « <strong>le Salarié</strong> »,
    </p>
    <p class="preambule" style="text-align:center"><strong>D'AUTRE PART,</strong></p>

    <p class="preambule">
      Vu la loi n° 028-2008/AN du 13 mai 2008 portant Code du travail au Burkina Faso et
      ses textes d'application, vu la convention collective applicable à la branche
      hôtellerie-restauration, il a été arrêté et convenu ce qui suit :
    </p>

    ${articles}

    ${
      clauses
        ? `<h2 class="article">Dispositions particulières</h2><ul>${clauses}</ul>`
        : ''
    }

    <p style="margin-top:5mm">
      Fait à <strong>${esc(d.lieu_signature || '……………………')}</strong>, le <strong>${auj}</strong>,
      en deux exemplaires originaux, dont un remis à chacune des parties.
    </p>

    <div class="signatures">
      <div class="signature">
        <strong>L'Employeur</strong><br>
        <span style="color:#5f5875">${esc(d.representant || '')}</span>
        <div class="ligne">Cachet et signature</div>
      </div>
      <div class="signature" style="text-align:right">
        <strong>Le Salarié</strong><br>
        <span style="color:#5f5875">${esc(d.salarie_prenom)} ${esc(d.salarie_nom.toUpperCase())}</span>
        <div class="ligne">Signature précédée de la mention « Lu et approuvé »</div>
      </div>
    </div>

    <div class="doc-pied">
      Contrat établi par ${esc(d.entreprise_nom)} · document à faire valider par un conseil
      juridique avant signature.
    </div>
  </div>`
}
