import type { AppConfig, Employee, MotifSortie, Qualification } from '../../../shared/types'
import { MOTIFS_SORTIE } from '../../../shared/types'
import { formatDate } from './format'

/**
 * Imprimés CNSS relatifs au travailleur :
 *  - la demande d'immatriculation, pour un salarié qui n'a pas encore de
 *    numéro CNSS (2 pages) ;
 *  - le bulletin d'entrée / de sortie, pour un salarié déjà immatriculé.
 *
 * Ces formulaires se remplissent case par case, un caractère par case. On
 * reproduit ce peigne : c'est ce qui rend l'imprimé reconnaissable, et c'est
 * aussi ce qui permet à l'agent de la CNSS de lire sans ambiguïté.
 */

const esc = (s: string): string =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

/**
 * Peigne de `n` cases contenant `valeur`, un caractère par case. Au-delà de
 * `n` caractères la valeur est tronquée · comme sur le papier, où l'on ne peut
 * pas écrire hors des cases.
 */
function cases(valeur: string | null | undefined, n: number): string {
  const v = String(valeur ?? '')
    .toUpperCase()
    .slice(0, n)
  let html = '<span class="peigne">'
  for (let i = 0; i < n; i++) html += `<span class="pc">${esc(v[i] ?? '')}</span>`
  return html + '</span>'
}

/** Peigne pour une date ISO, au format JJMMAAAA (8 cases). */
function casesDate(iso: string | null | undefined, n = 8): string {
  if (!iso) return cases('', n)
  const [a, m, j] = iso.split('-')
  return cases(`${j ?? ''}${m ?? ''}${a ?? ''}`, n)
}

/** Case à cocher, marquée d'une croix si la condition est vraie. */
function coche(actif: boolean): string {
  return `<span class="coche">${actif ? '✕' : ''}</span>`
}

/** Ligne pointillée portant une valeur, pour les champs sans peigne. */
function ligne(valeur: string | null | undefined, classe = ''): string {
  return `<span class="ligne-val ${classe}">${esc(valeur || '')}</span>`
}

/** Adresse postale de l'entreprise, condensée sur une ligne. */
function adresseEmployeur(c: AppConfig): string {
  return [c.entreprise_adresse, c.entreprise_ville].filter(Boolean).join(' · ')
}

// ==================================================== bulletin d'entrée/sortie

export interface OptionsBulletinCnss {
  sens: 'entree' | 'sortie'
  date_entree: string
  date_sortie: string
  motif: MotifSortie | null
}

/**
 * Bulletin d'entrée / de sortie · imprimé CNSS à une page A4 portrait.
 * Une seule case du couple ENTRÉE / SORTIE est cochée, et le bas de
 * l'imprimé (date et motif de sortie) ne se remplit qu'en sortie.
 */
export function bulletinCnssHtml(
  e: Employee,
  c: AppConfig,
  o: OptionsBulletinCnss
): string {
  const sortie = o.sens === 'sortie'
  const nomComplet = `${e.nom.toUpperCase()} ${e.prenom}`.trim()

  return `
  <div class="page form-cnss form-bulletin">
    <div class="bul-entete">
      <div class="bul-institution">
        <div class="bul-cnss-nom">
          Caisse Nationale de<br>Securite Sociale du<br>Burkina Faso
        </div>
        <div class="bul-cnss-coord">
          Siège social : OUAGADOUGOU<br>
          01 BP 562 - Tél. : 50 30 60 78 …81<br>
          Site web : www.cnss.bf
        </div>
      </div>
      <div class="bul-type">
        <span class="bul-mot">BULLETIN</span>
        <span class="bul-accolade">&#123;</span>
        <span class="bul-choix">
          <span class="bul-ligne-choix">ENTREE ${coche(!sortie)}</span>
          <span class="bul-ligne-choix">SORTIE ${coche(sortie)}</span>
        </span>
      </div>
    </div>

    <fieldset class="bul-cadre">
      <legend>IDENTIFICATION DE L'EMPLOYEUR</legend>
      <div class="bul-matricule">
        <span class="lib">N° MATRICULE DE L'EMPLOYEUR</span>
        ${cases(c.numero_employeur_cnss, 8)}
      </div>
      <div class="bul-employeur">
        <span class="bul-accolade-gauche">
          <em>NOM<br>PRENOM (S)</em>
          <em>OU</em>
          <em>RAISON<br>SOCIALE</em>
          <em>ADRESSE<br><small>(BP ; Tél ; e-mail)</small></em>
        </span>
        <span class="bul-lignes">
          ${ligne(c.entreprise_nom)}
          ${ligne(c.entreprise_activite)}
          ${ligne(adresseEmployeur(c))}
          ${ligne(c.entreprise_telephone ? `Tél. ${c.entreprise_telephone}` : '')}
          ${ligne(c.entreprise_email)}
        </span>
      </div>
    </fieldset>

    <fieldset class="bul-cadre">
      <legend>IDENTIFICATION DU TRAVAILLEUR</legend>
      <div class="bul-matricule">
        <span class="lib">N° MATRICULE DU TRAVAILLEUR :</span>
        ${cases(e.numero_cnss, 13)}
      </div>

      <div class="bul-champ">
        <span class="lib">NOM :</span>${ligne(e.nom.toUpperCase())}
        <span class="lib lib-court">SEXE :</span>${ligne(e.sexe ?? '', 'court')}
      </div>
      <div class="bul-champ">
        <span class="lib">PRENOM (S) :</span>${ligne(e.prenom)}
      </div>
      <div class="bul-champ">
        <span class="lib">ADRESSE :</span>${ligne(e.adresse)}
      </div>
      <div class="bul-champ">
        <span class="lib">TEL :</span>${ligne(e.telephone, 'moitie')}
        <span class="lib">E-MAIL :</span>${ligne(e.email, 'moitie')}
      </div>
      <div class="bul-champ">
        <span class="lib gras">DATE D'ENTREE :</span>${ligne(formatDate(o.date_entree))}
      </div>
      <div class="bul-champ">
        <span class="lib">PROFESSION :</span>${ligne(e.poste, 'moitie')}
        <span class="lib">TYPE EMPLOI :</span>${ligne(e.type_contrat, 'moitie')}
      </div>
      <div class="bul-champ">
        <span class="lib">SALAIRE BRUT MENSUEL :</span>
        ${ligne(
          e.salaire_mensuel ? `${Math.round(e.salaire_mensuel).toLocaleString('fr-FR')} ${c.devise}` : ''
        )}
      </div>
      <div class="bul-champ">
        <span class="lib gras">DATE DE SORTIE :</span>
        ${casesDate(sortie ? o.date_sortie : null)}
      </div>

      <div class="bul-motifs">
        <span class="lib souligne">MOTIF DE LA SORTIE :</span>
        <span class="bul-grille-motifs">
          ${MOTIFS_SORTIE.map(
            (m) => `<span class="mt">${esc(m)} ${coche(sortie && o.motif === m)}</span>`
          ).join('')}
        </span>
      </div>
    </fieldset>

    <div class="bul-signature">
      NOM &amp; PRENOM (S)<br>
      SIGNATURE &amp; CACHET
      <div class="bul-nom-signataire">${esc(c.representant || '')}</div>
    </div>

    <div class="bul-note">Cocher les cases et rayer les mentions inutiles.</div>
  </div>`
}

// =============================================== demande d'immatriculation

/** Correspondance catégorie CNSS → « type travailleur » de l'imprimé. */
function typeTravailleur(categorie: string): string {
  const table: Record<string, string> = { P: '1', T: '2', J: '3', S: '4', E: '5', N: '6', F: '1' }
  return table[categorie] ?? ''
}

/**
 * Demande d'immatriculation travailleur · imprimé CNSS, deux pages A4.
 *
 * Toutes les rubriques saisies dans la fiche du salarié sont reportées ; celles
 * qui sont laissées vides ressortent en cases blanches, à compléter à la main.
 * Les cadres « Réservé à la C.N.S.S. » ne sont jamais remplis.
 */
export function immatriculationHtml(e: Employee, c: AppConfig, dateDoc: string): string {
  // La qualification saisie fait foi. Sans elle, on retombe sur le statut
  // fiscal : « cadre » coche Cadre, sinon Employé · jamais les deux.
  const retenue: Qualification = e.qualification ?? (e.cadre ? 'Cadre' : 'Employé')
  const estQualifie = (q: Qualification): boolean => retenue === q

  return `
  <div class="page form-cnss form-immat">
    <div class="im-entete">
      <div class="im-titre-institution">
        CAISSE NATIONALE DE SECURITE SOCIALE DU BURKINA
      </div>
      <div class="im-titre">DEMANDE D'IMMATRICULATION<br>TRAVAILLEUR</div>
    </div>

    <fieldset class="im-cadre">
      <legend>EMPLOYEUR</legend>
      <div class="im-l"><span class="lib">Numéro employeur</span>${cases(
        c.numero_employeur_cnss,
        8
      )}</div>
      <div class="im-l"><span class="lib">Nom de l'employeur<br>ou Raison Sociale</span>${cases(
        c.entreprise_nom,
        30
      )}</div>
      <div class="im-l"><span class="lib">Adresse postale</span>${cases(
        adresseEmployeur(c),
        30
      )}</div>
      <div class="im-l">
        <span class="lib">Téléphone : Fixe</span>${cases(c.entreprise_telephone, 10)}
      </div>
      <div class="im-l"><span class="lib">E-mail :</span>${ligne(c.entreprise_email)}</div>
    </fieldset>

    <fieldset class="im-cadre">
      <legend>TRAVAILLEUR</legend>
      <div class="im-l im-reserve">
        <span class="lib">N° Travailleur <small>(réservé à la C.N.S.S.)</small></span>${cases(
          '',
          13
        )}
      </div>
      <div class="im-l"><span class="lib">Nature acte de naissance</span>${cases(
        e.acte_nature,
        16
      )}</div>
      <div class="im-l"><span class="lib">N° Acte de naissance</span>${cases(
        e.acte_numero,
        8
      )}</div>
      <div class="im-l"><span class="lib">Date d'établissement</span>${casesDate(
        e.acte_date
      )}</div>
      <div class="im-l"><span class="lib">Lieu d'établissement</span>${cases(
        e.acte_lieu,
        20
      )}</div>
      <div class="im-l"><span class="lib">Nom du travailleur</span>${cases(e.nom, 20)}</div>
      <div class="im-l"><span class="lib">Nom de jeune fille</span>${cases(
        e.nom_jeune_fille,
        20
      )}</div>
      <div class="im-l"><span class="lib">Prénom (s) du travailleur</span>${cases(
        e.prenom,
        20
      )}</div>
      <div class="im-l"><span class="lib">Date de naissance</span>${casesDate(
        e.date_naissance
      )}</div>
      <div class="im-l"><span class="lib">Village de naissance</span>${cases(
        e.lieu_naissance,
        20
      )}</div>
      <div class="im-l"><span class="lib">Département de naissance</span>${cases(
        e.departement_naissance,
        20
      )}</div>
      <div class="im-l"><span class="lib">Province de naissance</span>${cases(
        e.province_naissance,
        20
      )}</div>
      <div class="im-l"><span class="lib">Pays de naissance</span>${cases(
        e.pays_naissance ??
          (e.nationalite && e.nationalite.toLowerCase().startsWith('burkin')
            ? 'Burkina Faso'
            : null),
        20
      )}</div>

      <div class="im-l im-inline">
        <span class="lib">Sexe :</span>
        <span class="opt">Masculin ${coche(e.sexe === 'M')}</span>
        <span class="opt">Féminin ${coche(e.sexe === 'F')}</span>
      </div>
      <div class="im-l im-inline">
        <span class="lib">Situation matrimoniale :</span>
        <span class="opt">Célibataire ${coche(e.situation_famille === 'Célibataire')}</span>
        <span class="opt">Marié ${coche(e.situation_famille === 'Marié(e)')}</span>
        <span class="opt">Divorcé ${coche(e.situation_famille === 'Divorcé(e)')}</span>
        <span class="opt">Veuf ${coche(e.situation_famille === 'Veuf(ve)')}</span>
      </div>

      <div class="im-l"><span class="lib">Nationalité</span>${cases(e.nationalite, 18)}</div>
      <div class="im-l"><span class="lib">Adresse personnelle</span>${cases(e.adresse, 20)}</div>
      <div class="im-l">
        <span class="lib">Téléphone dle</span>${cases(e.telephone, 10)}
        <span class="lib">Groupe sanguin</span>${cases(e.groupe_sanguin, 3)}
      </div>
      <div class="im-l"><span class="lib">E-mail :</span>${ligne(e.email)}</div>
      <div class="im-l"><span class="lib">Banque</span>${cases(e.banque, 18)}</div>
      <div class="im-l"><span class="lib">Numéro compte bancaire</span>${cases(
        e.compte_bancaire,
        12
      )}</div>
      <div class="im-l"><span class="lib">Numéro compte CCP</span>${cases(
        e.compte_ccp,
        10
      )}</div>
      <div class="im-l"><span class="lib">Province</span>${cases(e.province, 12)}
        <span class="lib">Département</span>${cases(e.departement, 12)}</div>
      <div class="im-l"><span class="lib">Secteur</span>${cases(e.secteur, 3)}
        <span class="lib">Quartier</span>${cases(e.quartier, 14)}</div>
      <div class="im-l"><span class="lib">Numéro de rue</span>${cases(e.numero_rue, 4)}
        <span class="lib">Nom de rue</span>${cases(e.nom_rue, 14)}</div>
      <div class="im-l"><span class="lib">Numéro de lot</span>${cases(e.numero_lot, 4)}
        <span class="lib">Nom de l'immeuble</span>${cases(e.nom_immeuble, 12)}</div>
      <div class="im-l"><span class="lib">Numéro étage</span>${cases(e.numero_etage, 2)}
        <span class="lib">Numéro porte</span>${cases(e.numero_porte, 4)}
        <span class="lib">Type travailleur</span>${cases(
          typeTravailleur(e.categorie_cnss),
          1
        )} <small>(1)</small></div>

      <div class="im-nb">
        N.B. (1) 1 : Permanent &nbsp; 2 : Temporaire &nbsp; 3 : Occasionnel &nbsp;
        4 : Apprentis &nbsp; 5 : École technique &nbsp; 6 : Travailleur Indépendant
      </div>
    </fieldset>
  </div>

  <div class="page form-cnss form-immat">
    <fieldset class="im-cadre">
      <legend>AVANT-DROIT</legend>
      <div class="im-l"><span class="lib">Nom du père</span>${cases(e.nom_pere, 20)}</div>
      <div class="im-l"><span class="lib">Prénoms du père</span>${cases(
        e.prenoms_pere,
        20
      )}</div>
      <div class="im-l"><span class="lib">Nom de la mère</span>${cases(e.nom_mere, 20)}</div>
      <div class="im-l"><span class="lib">Prénoms mère</span>${cases(
        e.prenoms_mere,
        20
      )}</div>
      <div class="im-l"><span class="lib">Nom conjoint</span>${cases(e.nom_conjoint, 20)}</div>
      <div class="im-l"><span class="lib">Prénoms conjoint</span>${cases(
        e.prenoms_conjoint,
        20
      )}</div>
      <div class="im-l"><span class="lib">Adresse conjoint</span>${cases(
        e.adresse_conjoint,
        26
      )}</div>
    </fieldset>

    <fieldset class="im-cadre">
      <legend>EMPLOI</legend>
      <div class="im-l"><span class="lib">Date d'embauche</span>${casesDate(
        e.date_embauche
      )}</div>
      <div class="im-l im-inline">
        <span class="lib">Qualification professionnelle</span>
        <span class="opt">Cadre ${coche(estQualifie('Cadre'))}</span>
        <span class="opt">Agent de maîtrise ${coche(estQualifie('Agent de maîtrise'))}</span>
        <span class="opt">Employé ${coche(estQualifie('Employé'))}</span>
        <span class="opt">Ouvrier ${coche(estQualifie('Ouvrier'))}</span>
      </div>
      <div class="im-l im-inline">
        <span class="opt">Travailleur indépendant ${coche(
          estQualifie('Travailleur indépendant')
        )}</span>
        <span class="opt">Gens de maison ${coche(estQualifie('Gens de maison'))}</span>
        <span class="opt">Manœuvre ${coche(estQualifie('Manœuvre'))}</span>
      </div>
      <div class="im-l"><span class="lib">Profession</span>${cases(e.poste, 16)}</div>
      <div class="im-l">
        <span class="lib">Salaire brut</span>${cases(
          e.salaire_mensuel ? String(Math.round(e.salaire_mensuel)) : '',
          9
        )}
        <span class="lib">Catégorie</span>${cases(e.categorie_cnss, 4)}
      </div>
    </fieldset>

    <div class="im-certif">
      <div class="im-certif-titre">Certifié Exact</div>
      <div>À <strong>${esc(c.entreprise_ville || '……………')}</strong>, le
        <strong>${formatDate(dateDoc)}</strong></div>
      <div class="im-certif-signature">
        Nom &amp; Prénom (s)<br>
        Signature et cachet de l'employeur
        <div class="im-nom-signataire">${esc(c.representant || '')}</div>
      </div>
    </div>

    <div class="im-important">Important</div>
    <fieldset class="im-cadre im-pieces">
      <legend>PIECES A FOURNIR</legend>
      <p><strong>1<sup>er</sup> CAS :</strong> Le travailleur est immatriculé pour la première fois.<br>
        · Une copie de l'acte de naissance</p>
      <p><strong>2<sup>ème</sup> CAS :</strong> Le travailleur est déjà immatriculé et possède une
        carte bleue de 13 chiffres (01 64 12 1105 030).<br>
        · Une copie de l'acte de naissance<br>
        · Une photocopie recto-verso de la carte de 13 chiffres<br>
        · Le (s) éventuel (s) certificat (s) de travail.</p>
      <p><strong>3<sup>ème</sup> CAS :</strong> Si le travailleur est déjà immatriculé et possède une
        carte bleue ou rose de douze [12] chiffres plus une lettre (1.64.12.1105.030.S)<br>
        · Produire un bulletin d'entrée dûment rempli, signé et cacheté par l'employeur
        (imprimé à retirer à la CNSS)</p>
    </fieldset>

    <div class="im-loi">
      <strong>Article 7 &amp; 2 de la loi n° 015-2006/AN du 11 mai 2006 :</strong> L'employeur est tenu
      d'adresser une demande d'immatriculation au dit établissement dans les huit jours qui suivent,
      soit l'ouverture ou l'acquisition de l'entreprise, soit le premier embauchage d'un salarié
      lorsque cette embauche n'est pas concomitante au début de l'activité.
    </div>
  </div>`
}
