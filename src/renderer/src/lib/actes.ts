import type { AppConfig, Contract, Employee, MotifSortie } from '../../../shared/types'
import type { Orientation } from './print'
import { todayISO } from './format'
import {
  attestationTravailHtml,
  autorisationCongeHtml,
  certificatTravailHtml,
  fichePersonnelHtml,
  ordreMissionHtml,
  referenceActe
} from './documentsRh'
import { bulletinCnssHtml, immatriculationHtml } from './documentsCnss'
import { contratHtml, donneesContrat } from './documents'
import { determinerCas } from '../components/FormalitesCnssModal'

export type CategorieActe = 'cnss' | 'contrat' | 'attestation' | 'interne'

export const CATEGORIES_ACTE: { cle: CategorieActe; libelle: string; description: string }[] = [
  {
    cle: 'cnss',
    libelle: 'Formalités CNSS',
    description: 'Déclarations obligatoires à la Caisse nationale de sécurité sociale'
  },
  {
    cle: 'contrat',
    libelle: 'Actes contractuels',
    description: 'Contrat de travail et avenants signés avec le salarié'
  },
  {
    cle: 'attestation',
    libelle: 'Attestations & certificats',
    description: 'Documents remis au salarié ou à un tiers sur sa demande'
  },
  {
    cle: 'interne',
    libelle: 'Pièces internes',
    description: "Documents de gestion, à classer au dossier de l'établissement"
  }
]

/** Options communes à tous les actes ; chaque acte lit ce dont il a besoin. */
export interface OptionsActe {
  lieu: string
  date: string
  objet: string
  date_debut: string
  date_fin: string
  motif: MotifSortie
}

/** Un champ éditable d'un acte, affiché dans l'éditeur avant impression. */
export interface ChampActe {
  cle: keyof OptionsActe
  label: string
  type: 'date' | 'texte' | 'motif'
  aire?: boolean
  placeholder?: string
}

/** Ce qui manque dans la fiche pour que l'acte soit complet. */
export interface Reserve {
  champ: string
  message: string
}

export interface Acte {
  cle: string
  libelle: string
  description: string
  categorie: CategorieActe
  reference: string
  orientation: Orientation
  /** Vrai si l'acte est attendu pour ce salarié dans sa situation actuelle. */
  attendu: boolean
  /** Ce qui manque dans la fiche pour que l'acte soit complet. */
  reserves: Reserve[]
  /** Champs que l'utilisateur peut ajuster avant d'établir l'acte. */
  champs: ChampActe[]
  /** Produit le corps HTML de l'acte à partir des options courantes. */
  rendre: (o: OptionsActe) => string
}

/** Options par défaut d'un acte : ici et maintenant, d'après la fiche. */
export function optionsDefaut(config: AppConfig, e: Employee): OptionsActe {
  return {
    lieu: config.entreprise_ville,
    date: todayISO(),
    objet: '',
    date_debut: e.date_embauche ?? todayISO(),
    date_fin: e.date_fin_contrat ?? todayISO(),
    motif: 'Fin de contrat'
  }
}

/** Signale un champ vide de la fiche, sous forme de réserve. */
function siVide(valeur: unknown, champ: string, message: string): Reserve[] {
  return valeur === null || valeur === undefined || valeur === '' ? [{ champ, message }] : []
}

/**
 * Catalogue des actes d'un salarié.
 *
 * L'ordre suit celui d'un dossier papier : ce que la loi impose d'abord
 * (immatriculation, contrat), ce qui se délivre ensuite. Chaque acte porte
 * ses réserves · les champs manquants qui sortiront en blanc sur l'imprimé —,
 * ses champs éditables et un rendu paramétré : on peut donc ajuster puis
 * établir sans quitter le dossier.
 */
export function actesDuSalarie(e: Employee, config: AppConfig, contrats: Contract[] = []): Acte[] {
  const cas = determinerCas(e)
  const sortant = cas.formalites.includes('sortie')

  const reservesEtatCivil: Reserve[] = [
    ...siVide(e.date_naissance, 'Date de naissance', "l'imprimé la demande en cases"),
    ...siVide(e.acte_nature, "Nature de l'acte de naissance", 'onglet État civil CNSS'),
    ...siVide(e.acte_numero, "N° de l'acte de naissance", 'onglet État civil CNSS'),
    ...siVide(e.province_naissance, 'Province de naissance', 'onglet État civil CNSS'),
    ...siVide(e.prenoms_pere, 'Prénoms du père', 'onglet Filiation & famille'),
    ...siVide(e.prenoms_mere, 'Prénoms de la mère', 'onglet Filiation & famille')
  ]

  const actes: Acte[] = [
    {
      cle: 'immatriculation',
      libelle: "Demande d'immatriculation",
      description:
        "Imprimé CNSS en deux pages, à adresser dans les huit jours suivant l'embauche d'un travailleur non immatriculé.",
      categorie: 'cnss',
      reference: referenceActe('IMM', e, todayISO()),
      orientation: 'portrait',
      attendu: !e.numero_cnss,
      reserves: e.numero_cnss ? [] : reservesEtatCivil,
      champs: [{ cle: 'date', label: "Date d'établissement", type: 'date' }],
      rendre: (o) => immatriculationHtml(e, config, o.date)
    },
    {
      cle: 'bulletin_entree',
      libelle: "Bulletin d'entrée",
      description: "Déclare à la CNSS l'embauche d'un salarié déjà immatriculé.",
      categorie: 'cnss',
      reference: referenceActe('BE', e, todayISO()),
      orientation: 'portrait',
      attendu: Boolean(e.numero_cnss) && !sortant,
      reserves: [
        ...siVide(e.numero_cnss, 'N° CNSS', 'sans lui, le bulletin ne peut pas être déposé'),
        ...siVide(e.date_embauche, "Date d'embauche", 'onglet Emploi & paie')
      ],
      champs: [{ cle: 'date_debut', label: "Date d'entrée", type: 'date' }],
      rendre: (o) =>
        bulletinCnssHtml(e, config, {
          sens: 'entree',
          date_entree: o.date_debut,
          date_sortie: '',
          motif: null
        })
    },
    {
      cle: 'bulletin_sortie',
      libelle: 'Bulletin de sortie',
      description: 'Déclare à la CNSS la fin de la relation de travail.',
      categorie: 'cnss',
      reference: referenceActe('BS', e, todayISO()),
      orientation: 'portrait',
      attendu: sortant,
      reserves: [
        ...siVide(e.numero_cnss, 'N° CNSS', 'sans lui, le bulletin ne peut pas être déposé'),
        ...siVide(e.date_fin_contrat, 'Date de fin de contrat', 'onglet Emploi & paie')
      ],
      champs: [
        { cle: 'date_fin', label: 'Date de sortie', type: 'date' },
        { cle: 'motif', label: 'Motif de la sortie', type: 'motif' }
      ],
      rendre: (o) =>
        bulletinCnssHtml(e, config, {
          sens: 'sortie',
          date_entree: e.date_embauche ?? '',
          date_sortie: o.date_fin,
          motif: o.motif
        })
    },
    {
      cle: 'attestation_travail',
      libelle: 'Attestation de travail',
      description:
        'Atteste que le salarié est en poste · pour une banque, un bailleur, une demande de visa.',
      categorie: 'attestation',
      reference: referenceActe('ATT', e, todayISO()),
      orientation: 'portrait',
      attendu: e.statut === 'actif',
      reserves: siVide(e.date_embauche, "Date d'embauche", 'onglet Emploi & paie'),
      champs: [
        {
          cle: 'objet',
          label: 'Mention complémentaire',
          type: 'texte',
          aire: true,
          placeholder: "ex. Délivrée à la demande de l'intéressé."
        },
        { cle: 'lieu', label: 'Fait à', type: 'texte' },
        { cle: 'date', label: 'Le', type: 'date' }
      ],
      rendre: (o) => attestationTravailHtml(e, config, o)
    },
    {
      cle: 'certificat_travail',
      libelle: 'Certificat de travail',
      description:
        'Remis au salarié à la fin du contrat. Sa délivrance est une obligation du Code du travail.',
      categorie: 'attestation',
      reference: referenceActe('CT', e, todayISO()),
      orientation: 'portrait',
      attendu: sortant,
      reserves: siVide(e.date_embauche, "Date d'embauche", 'onglet Emploi & paie'),
      champs: [
        { cle: 'date_debut', label: 'Du', type: 'date' },
        { cle: 'date_fin', label: 'Au', type: 'date' },
        {
          cle: 'objet',
          label: 'Appréciation',
          type: 'texte',
          aire: true,
          placeholder: 'ex. Il a fait preuve de sérieux et de ponctualité.'
        },
        { cle: 'lieu', label: 'Fait à', type: 'texte' },
        { cle: 'date', label: 'Le', type: 'date' }
      ],
      rendre: (o) => certificatTravailHtml(e, config, o)
    },
    {
      cle: 'ordre_mission',
      libelle: 'Ordre de mission',
      description: 'Autorise un déplacement professionnel et facilite les contrôles en route.',
      categorie: 'attestation',
      reference: referenceActe('OM', e, todayISO()),
      orientation: 'portrait',
      attendu: false,
      reserves: [],
      champs: [
        {
          cle: 'objet',
          label: 'Objet de la mission',
          type: 'texte',
          aire: true,
          placeholder: 'ex. Approvisionnement au marché de Bobo-Dioulasso'
        },
        { cle: 'date_debut', label: 'Du', type: 'date' },
        { cle: 'date_fin', label: 'Au', type: 'date' },
        { cle: 'lieu', label: 'Fait à', type: 'texte' },
        { cle: 'date', label: 'Le', type: 'date' }
      ],
      rendre: (o) => ordreMissionHtml(e, config, o)
    },
    {
      cle: 'autorisation_absence',
      libelle: "Autorisation d'absence",
      description: 'Formalise un congé ou une absence autorisée et vaut justificatif.',
      categorie: 'attestation',
      reference: referenceActe('AA', e, todayISO()),
      orientation: 'portrait',
      attendu: false,
      reserves: [],
      champs: [
        {
          cle: 'objet',
          label: "Motif de l'absence",
          type: 'texte',
          aire: true,
          placeholder: 'ex. Congé annuel'
        },
        { cle: 'date_debut', label: 'Du', type: 'date' },
        { cle: 'date_fin', label: 'Au', type: 'date' },
        { cle: 'lieu', label: 'Fait à', type: 'texte' },
        { cle: 'date', label: 'Le', type: 'date' }
      ],
      rendre: (o) => autorisationCongeHtml(e, config, o)
    },
    {
      cle: 'fiche_individuelle',
      libelle: 'Fiche individuelle',
      description: 'État civil, filiation, situation professionnelle et historique contractuel.',
      categorie: 'interne',
      reference: referenceActe('FI', e, todayISO()),
      orientation: 'portrait',
      attendu: true,
      reserves: [],
      champs: [],
      rendre: () => fichePersonnelHtml(e, config, contrats)
    }
  ]

  // Les contrats signés viennent du registre : un acte par contrat.
  for (const c of contrats) {
    actes.splice(3, 0, {
      cle: `contrat_${c.id}`,
      libelle: `Contrat ${c.type_contrat} · ${c.reference}`,
      description: `Signé le ${c.date_signature ?? 'Non renseigné'}, statut « ${c.statut} ».`,
      categorie: 'contrat',
      reference: c.reference,
      orientation: 'portrait',
      attendu: true,
      reserves: siVide(c.date_signature, 'Date de signature', 'onglet Contrats de la fiche'),
      champs: [],
      rendre: () => contratHtml(donneesContrat(c, e, config), config)
    })
  }

  return actes
}

/** Part des actes attendus qui ne portent aucune réserve. */
export function completude(actes: Acte[]): { faits: number; total: number; pct: number } {
  const attendus = actes.filter((a) => a.attendu)
  const faits = attendus.filter((a) => a.reserves.length === 0).length
  return {
    faits,
    total: attendus.length,
    pct: attendus.length === 0 ? 100 : Math.round((faits / attendus.length) * 100)
  }
}

/**
 * Prochaine action attendue sur le dossier, en une phrase · ce qu'il faut
 * établir en priorité au vu de la situation du salarié.
 */
export function prochaineAction(actes: Acte[]): string {
  const requis = actes.find((a) => a.attendu && a.reserves.length > 0)
  if (requis) return `À établir : ${requis.libelle}`
  const attendus = actes.filter((a) => a.attendu)
  const restant = attendus.find((a) => a.categorie === 'cnss')
  if (restant) return `Formalité CNSS : ${restant.libelle}`
  return 'Dossier complet'
}
