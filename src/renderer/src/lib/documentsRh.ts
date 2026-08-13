// Documents individuels du salarié : fiche de personnel et attestations
// courantes. Tous partagent l'en-tête professionnel de l'établissement et
// s'impriment au format A4 portrait.

import type { AppConfig, Contract, Employee } from '../../../shared/types'
import { CATEGORIES_CNSS } from '../../../shared/types'
import { formatDate, formatMoney } from './format'

const esc = (s: string): string =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

/** Ligne « libellé : valeur » du corps de la fiche. */
const champ = (k: string, v: string | null | undefined): string =>
  `<div class="fp-champ"><span class="fp-k">${esc(k)}</span><span class="fp-v">${
    v ? esc(v) : 'Non renseigné'
  }</span></div>`

/** Monogramme de l'établissement : jusqu'à deux initiales. */
function monogramme(nom: string): string {
  const mots = nom
    .split(/[\s-]+/)
    .filter((m) => m.length > 1)
    .slice(0, 2)
  return mots.length > 0 ? mots.map((m) => m[0].toUpperCase()).join('') : 'É'
}

/**
 * En-tête d'acte : papier à en-tête de l'établissement.
 *
 * Composition classique d'un acte administratif : sceau et raison sociale à
 * gauche, identifiants légaux dans un cartouche à droite, double filet, puis le
 * titre au centre en capitales espacées, séparé de sa référence par un fleuron.
 * C'est la graisse, l'espacement et le blanc qui font le sérieux · la couleur
 * reste cantonnée au sceau et aux filets.
 */
function enteteEtablissement(
  config: AppConfig,
  titre: string,
  reference = '',
  sousTitre = ''
): string {
  const lieu = [config.entreprise_adresse, config.entreprise_ville].filter(Boolean).map(esc)
  const contacts = [
    config.entreprise_telephone ? `Tél. ${esc(config.entreprise_telephone)}` : '',
    config.entreprise_email ? esc(config.entreprise_email) : ''
  ].filter(Boolean)
  const identifiants = [
    ['N° employeur CNSS', config.numero_employeur_cnss],
    ['IFU', config.ifu],
    ['RCCM', config.rccm]
  ].filter(([, v]) => Boolean(v))

  return `
    <header class="acte-entete">
      <div class="ae-gauche">
        ${
          config.logo
            ? `<img class="ae-logo" src="${config.logo}" alt="">`
            : `<div class="ae-sceau" aria-hidden="true">${esc(monogramme(config.entreprise_nom))}</div>`
        }
        <div class="ae-bloc">
          <div class="ae-nom">${esc(config.entreprise_nom)}</div>
          <div class="ae-regle" aria-hidden="true"></div>
          <div class="ae-activite">${esc(config.entreprise_activite)}</div>
          <div class="ae-coord">
            ${lieu.join(' · ')}
            ${contacts.length ? `<br>${contacts.join(' · ')}` : ''}
          </div>
        </div>
      </div>
      ${
        identifiants.length > 0
          ? `<div class="ae-cartouche">
              <div class="ae-cart-titre">Identification</div>
              ${identifiants
                .map(
                  ([lib, val]) =>
                    `<div class="ae-cart-l"><span>${esc(String(lib))}</span><b>${esc(
                      String(val)
                    )}</b></div>`
                )
                .join('')}
            </div>`
          : ''
      }
    </header>

    <div class="acte-double-filet" aria-hidden="true"></div>

    <div class="acte-titre-bloc">
      <h1 class="acte-titre">${esc(titre)}</h1>
      <div class="acte-fleuron" aria-hidden="true"><i></i>&#9670;<i></i></div>
      ${sousTitre ? `<div class="acte-sous-titre">${sousTitre}</div>` : ''}
      ${
        reference
          ? `<div class="acte-reference"><span>Référence</span>${esc(reference)}</div>`
          : ''
      }
    </div>`
}

function anciennete(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso + 'T00:00:00')
  const now = new Date()
  let mois = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth())
  if (now.getDate() < d.getDate()) mois--
  if (mois < 0) return '—'
  const ans = Math.floor(mois / 12)
  const reste = mois % 12
  if (ans === 0) return `${reste} mois`
  return reste === 0 ? `${ans} an(s)` : `${ans} an(s) et ${reste} mois`
}

function remuneration(e: Employee): string {
  if ((e.salaire_mensuel ?? 0) > 0) return `${formatMoney(e.salaire_mensuel)} par mois`
  if ((e.salaire_horaire ?? 0) > 0) return `${formatMoney(e.salaire_horaire)} par heure`
  return '—'
}

/** Bloc photo : le portrait s'il existe, sinon un cadre réservé. */
function blocPhoto(e: Employee): string {
  return e.photo
    ? `<img class="fp-photo" src="${e.photo}" alt="">`
    : `<div class="fp-photo fp-photo-vide">Photo</div>`
}

// ---------------------------------------------------------------- fiche de personnel

/** Fiche individuelle du personnel, à classer au dossier papier du salarié. */
export function fichePersonnelHtml(
  e: Employee,
  config: AppConfig,
  contrats: Contract[] = []
): string {
  const auj = formatDate(new Date().toISOString().slice(0, 10))
  const categorie = CATEGORIES_CNSS.find((c) => c.code === e.categorie_cnss)
  const matricule = e.matricule || String(e.id).padStart(4, '0')

  const historique = contrats.length
    ? `
      <h2 class="fp-section">Historique contractuel</h2>
      <table class="fp-table">
        <thead>
          <tr>
            <th>Référence</th><th>Type</th><th>Début</th><th>Fin</th>
            <th class="num">Rémunération</th><th>Statut</th>
          </tr>
        </thead>
        <tbody>
          ${contrats
            .map(
              (c) => `
            <tr>
              <td>${esc(c.reference)}</td>
              <td>${esc(c.type_contrat)}</td>
              <td>${formatDate(c.date_debut)}</td>
              <td>${c.date_fin ? formatDate(c.date_fin) : 'Indéterminée'}</td>
              <td class="num">${formatMoney(c.salaire_montant)}</td>
              <td>${esc(c.statut)}</td>
            </tr>`
            )
            .join('')}
        </tbody>
      </table>`
    : ''

  return `
  <div class="page page-flux">
    ${enteteEtablissement(config, 'Fiche individuelle du personnel', '', `Établie le ${auj}`)}

    <div class="fp-bandeau">
      ${blocPhoto(e)}
      <div class="fp-identite">
        <div class="fp-nom">${esc(e.nom.toUpperCase())} ${esc(e.prenom)}</div>
        <div class="fp-poste">${esc(e.poste || 'Poste non précisé')}</div>
        <div class="fp-statut">
          ${esc(e.type_contrat)} · ${e.statut === 'actif' ? 'En activité' : 'Inactif'}
        </div>
      </div>
      <div class="fp-refs">
        <div><span>Matricule</span><strong>${esc(matricule)}</strong></div>
        <div><span>N° CNSS</span><strong>${esc(e.numero_cnss || 'Non renseigné')}</strong></div>
      </div>
    </div>

    <h2 class="fp-section">État civil</h2>
    <div class="fp-grille">
      ${champ('Nom', e.nom.toUpperCase())}
      ${champ('Prénom(s)', e.prenom)}
      ${champ('Sexe', e.sexe === 'M' ? 'Masculin' : e.sexe === 'F' ? 'Féminin' : null)}
      ${champ('Date de naissance', e.date_naissance ? formatDate(e.date_naissance) : null)}
      ${champ('Lieu de naissance', e.lieu_naissance)}
      ${champ('Nationalité', e.nationalite || 'Burkinabè')}
      ${champ("Pièce d'identité (CNIB)", e.cnib)}
    </div>

    <h2 class="fp-section">Filiation</h2>
    <div class="fp-grille">
      ${champ('Nom et prénom(s) du père', e.nom_pere)}
      ${champ('Nom et prénom(s) de la mère', e.nom_mere)}
    </div>

    <h2 class="fp-section">Situation matrimoniale</h2>
    <div class="fp-grille">
      ${champ('Situation de famille', e.situation_famille)}
      ${champ('Nom du conjoint', e.nom_conjoint)}
      ${champ("Nombre d'enfants", String(e.nombre_enfants))}
      ${champ('Personnes à charge (fiscales)', String(e.personnes_a_charge))}
    </div>

    <h2 class="fp-section">Coordonnées</h2>
    <div class="fp-grille">
      ${champ('Téléphone', e.telephone)}
      ${champ('Adresse électronique', e.email)}
      ${champ('Adresse', e.adresse)}
      ${champ("Personne à prévenir en cas d'urgence", e.contact_urgence)}
    </div>

    <h2 class="fp-section">Situation professionnelle</h2>
    <div class="fp-grille">
      ${champ('Emploi occupé', e.poste)}
      ${champ('Nature du contrat', e.type_contrat)}
      ${champ("Date d'embauche", e.date_embauche ? formatDate(e.date_embauche) : null)}
      ${champ('Ancienneté', anciennete(e.date_embauche))}
      ${champ('Fin de contrat', e.date_fin_contrat ? formatDate(e.date_fin_contrat) : 'Indéterminée')}
      ${champ('Durée hebdomadaire', e.heures_hebdo ? `${e.heures_hebdo} heures` : null)}
    </div>

    <h2 class="fp-section">Rémunération et cotisations</h2>
    <div class="fp-grille">
      ${champ('Rémunération brute', remuneration(e))}
      ${champ('Catégorie CNSS', categorie ? `${categorie.code} · ${categorie.libelle}` : null)}
      ${champ('Qualification', e.cadre ? 'Cadre moyen ou supérieur' : 'Employé / ouvrier')}
      ${champ('Abattement IUTS', e.cadre ? '20 %' : '25 %')}
    </div>

    ${historique}

    ${
      e.notes
        ? `<h2 class="fp-section">Observations</h2><p class="fp-notes">${esc(e.notes)}</p>`
        : ''
    }

    <div class="signatures">
      <div class="signature">
        <strong>Le Salarié</strong>
        <div class="ligne">Signature</div>
      </div>
      <div class="signature" style="text-align:right">
        <strong>L'Employeur</strong><br>
        <span style="color:#5f5875">${esc(config.representant || '')}</span>
        <div class="ligne">Cachet et signature</div>
      </div>
    </div>

    <div class="doc-pied">
      Fiche individuelle du personnel · ${esc(config.entreprise_nom)} · document interne
      confidentiel, à conserver au dossier du salarié.
    </div>
  </div>`
}

// ---------------------------------------------------------------- listes

/** Cartouche commun aux listes : titre, sous-titre et date d'édition. */
function enteteListe(config: AppConfig, titre: string, sousTitre: string): string {
  const auj = formatDate(new Date().toISOString().slice(0, 10))
  return `
    ${enteteEtablissement(config, titre, '', `Édité le ${auj}`)}
    <div class="liste-sous-titre">${sousTitre}</div>`
}

/** Liste générale du personnel, à afficher ou à archiver. */
export function listePersonnelHtml(
  employes: Employee[],
  config: AppConfig,
  sousTitre = 'Ensemble du personnel'
): string {
  const actifs = employes.filter((e) => e.statut === 'actif').length
  const masse = employes
    .filter((e) => e.statut === 'actif')
    .reduce((t, e) => t + (e.salaire_mensuel ?? 0), 0)

  const lignes = employes
    .map(
      (e, i) => `
      <tr>
        <td class="c">${i + 1}</td>
        <td class="c">${esc(e.matricule || String(e.id).padStart(4, '0'))}</td>
        <td class="c">${esc(e.numero_cnss || 'Non renseigné')}</td>
        <td><strong>${esc(e.nom.toUpperCase())}</strong> ${esc(e.prenom)}</td>
        <td class="c">${esc(e.sexe || 'Non renseigné')}</td>
        <td>${esc(e.poste || 'Non renseigné')}</td>
        <td class="c">${esc(e.type_contrat)}</td>
        <td class="c">${esc(e.categorie_cnss)}</td>
        <td class="c">${e.date_embauche ? formatDate(e.date_embauche) : 'Non renseigné'}</td>
        <td class="c">${e.date_fin_contrat ? formatDate(e.date_fin_contrat) : 'Non renseigné'}</td>
        <td class="num">${
          (e.salaire_mensuel ?? 0) > 0
            ? Math.round(e.salaire_mensuel!).toLocaleString('fr-FR')
            : (e.salaire_horaire ?? 0) > 0
              ? `${Math.round(e.salaire_horaire!).toLocaleString('fr-FR')} /h`
              : 'Non renseigné'
        }</td>
        <td class="c">${esc(e.telephone || 'Non renseigné')}</td>
        <td class="c">${e.statut === 'actif' ? 'Actif' : 'Inactif'}</td>
      </tr>`
    )
    .join('')

  return `
  <div class="page page-paysage">
    ${enteteListe(config, 'Liste du personnel', sousTitre)}

    <table class="tab-liste">
      <thead>
        <tr>
          <th style="width:8mm">N°</th>
          <th style="width:18mm">Matricule</th>
          <th style="width:24mm">N° CNSS</th>
          <th>Nom et prénom(s)</th>
          <th style="width:10mm">Sexe</th>
          <th style="width:34mm">Emploi</th>
          <th style="width:16mm">Contrat</th>
          <th style="width:12mm">Cat.</th>
          <th style="width:22mm">Embauche</th>
          <th style="width:22mm">Fin</th>
          <th style="width:26mm">Salaire</th>
          <th style="width:26mm">Téléphone</th>
          <th style="width:16mm">Statut</th>
        </tr>
      </thead>
      <tbody>
        ${lignes}
        <tr class="total">
          <td colspan="10">TOTAL · ${employes.length} salarié(s), dont ${actifs} en activité</td>
          <td class="num">${masse.toLocaleString('fr-FR')}</td>
          <td colspan="2"></td>
        </tr>
      </tbody>
    </table>

    <p class="liste-note">
      Masse salariale mensuelle brute des salariés en activité :
      <strong>${formatMoney(masse)}</strong>. Catégories CNSS :
      ${CATEGORIES_CNSS.map((c) => `${c.code} = ${c.libelle}`).join(' · ')}.
    </p>

    <div class="liste-signature">
      Fait à ${esc(config.entreprise_ville || '……………………')}, le ${formatDate(
        new Date().toISOString().slice(0, 10)
      )}<br><br>
      <strong>${esc(config.representant || "L'Employeur")}</strong>
      <div class="ligne">Cachet et signature</div>
    </div>
  </div>`
}

/** Registre des contrats de travail. */
export function listeContratsHtml(
  contrats: (Contract & { employee_nom: string; employee_prenom: string })[],
  config: AppConfig,
  sousTitre = 'Ensemble des contrats'
): string {
  const signes = contrats.filter((c) => c.statut === 'Signé').length

  const lignes = contrats
    .map(
      (c, i) => `
      <tr>
        <td class="c">${i + 1}</td>
        <td class="c">${esc(c.reference)}</td>
        <td><strong>${esc(c.employee_nom.toUpperCase())}</strong> ${esc(c.employee_prenom)}</td>
        <td>${esc(c.poste || 'Non renseigné')}</td>
        <td class="c">${esc(c.type_contrat)}</td>
        <td class="c">${formatDate(c.date_debut)}</td>
        <td class="c">${c.date_fin ? formatDate(c.date_fin) : 'Indéterminée'}</td>
        <td class="c">${c.duree_mois ? `${c.duree_mois} mois` : 'Non renseigné'}</td>
        <td class="num">${Math.round(c.salaire_montant).toLocaleString('fr-FR')}</td>
        <td class="c">${c.mode_salaire === 'mensuel' ? 'Mensuel' : 'Horaire'}</td>
        <td class="c">${c.date_signature ? formatDate(c.date_signature) : 'Non renseigné'}</td>
        <td class="c">${esc(c.statut)}</td>
      </tr>`
    )
    .join('')

  return `
  <div class="page page-paysage">
    ${enteteListe(config, 'Registre des contrats', sousTitre)}

    <table class="tab-liste">
      <thead>
        <tr>
          <th style="width:8mm">N°</th>
          <th style="width:28mm">Référence</th>
          <th>Salarié</th>
          <th style="width:34mm">Poste</th>
          <th style="width:16mm">Type</th>
          <th style="width:22mm">Début</th>
          <th style="width:24mm">Terme</th>
          <th style="width:16mm">Durée</th>
          <th style="width:24mm">Salaire</th>
          <th style="width:18mm">Mode</th>
          <th style="width:22mm">Signé le</th>
          <th style="width:20mm">Statut</th>
        </tr>
      </thead>
      <tbody>
        ${lignes}
        <tr class="total">
          <td colspan="12">TOTAL · ${contrats.length} contrat(s), dont ${signes} en vigueur</td>
        </tr>
      </tbody>
    </table>

    <div class="liste-signature">
      Fait à ${esc(config.entreprise_ville || '……………………')}, le ${formatDate(
        new Date().toISOString().slice(0, 10)
      )}<br><br>
      <strong>${esc(config.representant || "L'Employeur")}</strong>
      <div class="ligne">Cachet et signature</div>
    </div>
  </div>`
}

// ---------------------------------------------------------------- attestations

export interface OptionsDocumentRh {
  lieu: string
  date: string
  objet: string
  date_debut: string
  date_fin: string
}

/** Corps de lettre commun aux attestations : en-tête, texte, signature. */
function lettreHtml(
  config: AppConfig,
  titre: string,
  corps: string,
  opts: OptionsDocumentRh,
  reference = '',
  mentionFinale = 'En foi de quoi, le présent acte lui est délivré pour servir et valoir ce que de droit.'
): string {
  // Pied de page : ce qui permet d'identifier l'émetteur si la feuille est
  // détachée de son enveloppe ou photocopiée.
  const pied = [
    config.entreprise_nom,
    config.entreprise_activite,
    config.numero_employeur_cnss ? `N° employeur CNSS ${config.numero_employeur_cnss}` : ''
  ]
    .filter(Boolean)
    .map(esc)
    .join(' · ')

  return `
  <div class="page acte">
    ${enteteEtablissement(config, titre, reference)}
    <div class="lettre">
      ${corps}
      <p class="lettre-mention">${esc(mentionFinale)}</p>
      <div class="lettre-signature">
        <div class="ls-lieu">
          Fait à ${esc(opts.lieu || config.entreprise_ville || '……………………')},
          le ${formatDate(opts.date)}
        </div>
        <div class="ls-qualite">Pour l'établissement,</div>
        <div class="ls-nom">${esc(config.representant || "L'Employeur")}</div>
        <div class="ligne">Cachet et signature</div>
      </div>
    </div>
    <div class="acte-pied">${pied}</div>
  </div>`
}

/**
 * Référence d'un acte : préfixe + année + initiales du salarié.
 * Elle donne au document un numéro citable, ce qu'un acte administratif
 * doit avoir pour être classé et retrouvé.
 */
export function referenceActe(prefixe: string, e: Employee, date: string): string {
  const annee = (date || new Date().toISOString()).slice(0, 4)
  const init = `${(e.nom[0] ?? 'X')}${(e.prenom[0] ?? 'X')}`.toUpperCase()
  return `${prefixe}-${annee}-${init}${String(e.id).padStart(3, '0')}`
}

const civilite = (e: Employee): string =>
  e.sexe === 'F' ? 'Madame' : e.sexe === 'M' ? 'Monsieur' : 'Monsieur / Madame'

/**
 * Accorde un participe au sexe du salarié quand il est connu. Écrire « né(e) »
 * alors que la fiche indique « F » donne à l'acte un air de formulaire non
 * rempli : la parenthèse n'est légitime que dans le doute.
 */
const accord = (e: Employee, masculin: string): string =>
  e.sexe === 'F' ? `${masculin}e` : e.sexe === 'M' ? masculin : `${masculin}(e)`

/**
 * Assemble une énumération en écartant les fragments vides, puis la termine
 * par une virgule. Sans cela, un lieu de naissance non renseigné laissait une
 * virgule orpheline au milieu de la phrase.
 */
const enumere = (...morceaux: (string | false | null | undefined)[]): string => {
  const utiles = morceaux
    .filter(Boolean)
    .map((m) => String(m).trim())
    .filter(Boolean)
  return utiles.length > 0 ? `${utiles.join(', ')},` : ''
}

/** Attestation de travail : atteste qu'un salarié est en poste. */
export function attestationTravailHtml(
  e: Employee,
  config: AppConfig,
  opts: OptionsDocumentRh
): string {
  const corps = `
    <p>Je soussigné(e), <strong>${esc(config.representant || '……………………')}</strong>, responsable de
    l'établissement <strong>${esc(config.entreprise_nom)}</strong>, atteste par la présente que :</p>

    <p class="lettre-sujet">
      ${civilite(e)} <strong>${esc(e.nom.toUpperCase())} ${esc(e.prenom)}</strong>,
      ${enumere(
        e.date_naissance &&
          `${accord(e, 'né')} le ${formatDate(e.date_naissance)}${
            e.lieu_naissance ? ` à ${esc(e.lieu_naissance)}` : ''
          }`,
        e.numero_cnss && `immatricul${accord(e, 'é')} à la CNSS sous le numéro ${esc(e.numero_cnss)}`
      )}
      est ${accord(e, 'employé')} au sein de notre établissement depuis le
      <strong>${e.date_embauche ? formatDate(e.date_embauche) : '……………………'}</strong>
      en qualité de <strong>${esc(e.poste || '……………………')}</strong>,
      sous contrat <strong>${esc(e.type_contrat)}</strong>.
    </p>

    <p>À ce jour, ${civilite(e).toLowerCase()} ${esc(e.nom.toUpperCase())} perçoit une rémunération
    brute de <strong>${remuneration(e)}</strong> pour une durée hebdomadaire de travail de
    <strong>${e.heures_hebdo ?? '……'} heures</strong>.</p>

    ${opts.objet ? `<p>${esc(opts.objet)}</p>` : ''}`
  return lettreHtml(
    config,
    'Attestation de travail',
    corps,
    opts,
    referenceActe('ATT', e, opts.date),
    "En foi de quoi, la présente attestation lui est délivrée pour servir et valoir ce que de droit."
  )
}

/** Certificat de travail : remis à la fin du contrat (obligation légale). */
export function certificatTravailHtml(
  e: Employee,
  config: AppConfig,
  opts: OptionsDocumentRh
): string {
  const corps = `
    <p>Je soussigné(e), <strong>${esc(config.representant || '……………………')}</strong>, responsable de
    l'établissement <strong>${esc(config.entreprise_nom)}</strong>, certifie que :</p>

    <p class="lettre-sujet">
      ${civilite(e)} <strong>${esc(e.nom.toUpperCase())} ${esc(e.prenom)}</strong>,
      ${enumere(
        e.numero_cnss && `immatricul${accord(e, 'é')} à la CNSS sous le numéro ${esc(e.numero_cnss)}`
      )}
      a été ${accord(e, 'employé')} dans notre établissement
      du <strong>${opts.date_debut ? formatDate(opts.date_debut) : '……………………'}</strong>
      au <strong>${opts.date_fin ? formatDate(opts.date_fin) : '……………………'}</strong>,
      en qualité de <strong>${esc(e.poste || '……………………')}</strong>.
    </p>

    <p>${civilite(e)} ${esc(e.nom.toUpperCase())} a exercé ses fonctions à notre entière
    satisfaction. ${opts.objet ? esc(opts.objet) : ''}</p>

    <p>Le présent certificat est délivré conformément aux dispositions du Code du travail,
    le salarié étant libre de tout engagement envers notre établissement.</p>`
  return lettreHtml(
    config,
    'Certificat de travail',
    corps,
    opts,
    referenceActe('CT', e, opts.date),
    'Le présent certificat est remis au salarié pour servir et valoir ce que de droit.'
  )
}

/** Ordre de mission : déplacement professionnel. */
export function ordreMissionHtml(
  e: Employee,
  config: AppConfig,
  opts: OptionsDocumentRh
): string {
  const corps = `
    <p>Il est donné ordre de mission à :</p>

    <p class="lettre-sujet">
      ${civilite(e)} <strong>${esc(e.nom.toUpperCase())} ${esc(e.prenom)}</strong>,
      ${esc(e.poste || '……………………')},
      matricule <strong>${esc(e.matricule || String(e.id).padStart(4, '0'))}</strong>.
    </p>

    <div class="fp-grille" style="margin:4mm 0">
      ${champ('Objet de la mission', opts.objet)}
      ${champ('Date de départ', opts.date_debut ? formatDate(opts.date_debut) : null)}
      ${champ('Date de retour', opts.date_fin ? formatDate(opts.date_fin) : null)}
      ${champ('Lieu', opts.lieu)}
    </div>

    <p>Les autorités administratives et les services de sécurité sont priés de faciliter
    l'accomplissement de cette mission.</p>`
  return lettreHtml(
    config,
    'Ordre de mission',
    corps,
    opts,
    referenceActe('OM', e, opts.date),
    "Les autorités civiles et militaires sont priées de faciliter la mission de l'intéressé(e)."
  )
}

/** Autorisation d'absence ou de congé. */
export function autorisationCongeHtml(
  e: Employee,
  config: AppConfig,
  opts: OptionsDocumentRh
): string {
  const corps = `
    <p>Je soussigné(e), <strong>${esc(config.representant || '……………………')}</strong>, responsable de
    l'établissement <strong>${esc(config.entreprise_nom)}</strong>, autorise :</p>

    <p class="lettre-sujet">
      ${civilite(e)} <strong>${esc(e.nom.toUpperCase())} ${esc(e.prenom)}</strong>,
      ${esc(e.poste || '……………………')},
      à s'absenter de son poste de travail
      du <strong>${opts.date_debut ? formatDate(opts.date_debut) : '……………………'}</strong>
      au <strong>${opts.date_fin ? formatDate(opts.date_fin) : '……………………'}</strong>.
    </p>

    ${opts.objet ? `<div class="fp-grille">${champ('Motif', opts.objet)}</div>` : ''}

    <p>Le salarié est tenu de reprendre son service à l'issue de cette période. Toute
    prolongation devra faire l'objet d'une nouvelle autorisation écrite.</p>`
  return lettreHtml(
    config,
    "Autorisation d'absence",
    corps,
    opts,
    referenceActe('AA', e, opts.date),
    "La présente autorisation vaut justificatif d'absence pour la période indiquée."
  )
}
