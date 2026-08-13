// Types partagés entre le process principal (Electron) et l'interface (React).

export type ContractType = 'CDI' | 'CDD' | 'Extra' | 'Apprentissage' | 'Stage' | 'Interim'

export type EmployeeStatus = 'actif' | 'inactif'

export type SituationFamille = 'Célibataire' | 'Marié(e)' | 'Divorcé(e)' | 'Veuf(ve)' | 'Concubinage'

/** Nature de l'acte d'état civil, telle que la CNSS l'attend. */
export type NatureActe =
  | "Extrait d'acte de naissance"
  | 'Copie intégrale'
  | 'Jugement supplétif'
  | 'Certificat de nationalité'

export const NATURES_ACTE: NatureActe[] = [
  "Extrait d'acte de naissance",
  'Copie intégrale',
  'Jugement supplétif',
  'Certificat de nationalité'
]

/** Qualification professionnelle de l'imprimé d'immatriculation CNSS. */
export type Qualification =
  | 'Cadre'
  | 'Agent de maîtrise'
  | 'Employé'
  | 'Ouvrier'
  | 'Travailleur indépendant'
  | 'Gens de maison'
  | 'Manœuvre'

export const QUALIFICATIONS: Qualification[] = [
  'Cadre',
  'Agent de maîtrise',
  'Employé',
  'Ouvrier',
  'Travailleur indépendant',
  'Gens de maison',
  'Manœuvre'
]

export const GROUPES_SANGUINS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const

export const SITUATIONS_FAMILLE: SituationFamille[] = [
  'Célibataire',
  'Marié(e)',
  'Divorcé(e)',
  'Veuf(ve)',
  'Concubinage'
]

export interface Employee {
  id: number
  matricule: string | null // matricule interne à l'entreprise (colonne 1 du BNTS)
  numero_cnss: string | null // n° d'immatriculation CNSS (colonne 2 du BNTS)
  categorie_cnss: CategorieCnss // colonne 9 du BNTS : détermine les branches cotisées
  cadre: boolean // cadre moyen ou supérieur : abattement IUTS de 20 % au lieu de 25 %
  sexe: 'M' | 'F' | null
  date_naissance: string | null
  personnes_a_charge: number // pour la réduction d'impôt (IUTS)
  photo: string | null // portrait en data URI, redimensionné à l'import
  lieu_naissance: string | null // village de naissance sur l'imprimé CNSS
  nationalite: string | null
  cnib: string | null
  // --- Acte d'état civil (demande d'immatriculation CNSS) ---
  acte_nature: NatureActe | null
  acte_numero: string | null
  acte_date: string | null // date d'établissement, ISO
  acte_lieu: string | null // lieu d'établissement
  nom_jeune_fille: string | null
  departement_naissance: string | null
  province_naissance: string | null
  pays_naissance: string | null
  groupe_sanguin: string | null // n° de la carte nationale d'identité burkinabè
  // Filiation, telle qu'elle figure à l'état civil
  nom_pere: string | null
  prenoms_pere: string | null
  nom_mere: string | null
  prenoms_mere: string | null
  // Situation matrimoniale
  situation_famille: SituationFamille | null
  nom_conjoint: string | null
  prenoms_conjoint: string | null
  adresse_conjoint: string | null
  nombre_enfants: number
  contact_urgence: string | null
  nom: string
  prenom: string
  poste: string
  type_contrat: ContractType
  date_embauche: string | null // ISO date (YYYY-MM-DD)
  date_fin_contrat: string | null
  salaire_horaire: number | null
  salaire_mensuel: number | null // salaire mensuel brut (contrats mensualisés)
  heures_hebdo: number | null // heures contractuelles par semaine
  telephone: string | null
  email: string | null
  adresse: string | null
  // --- Coordonnées bancaires (demande d'immatriculation CNSS) ---
  banque: string | null
  compte_bancaire: string | null
  compte_ccp: string | null
  // --- Domicile, découpage administratif de l'imprimé CNSS ---
  province: string | null
  departement: string | null
  secteur: string | null
  quartier: string | null
  numero_rue: string | null
  nom_rue: string | null
  numero_lot: string | null
  nom_immeuble: string | null
  numero_etage: string | null
  numero_porte: string | null
  /** Qualification portée sur l'imprimé d'immatriculation. */
  qualification: Qualification | null
  statut: EmployeeStatus
  notes: string | null
  created_at: string
  updated_at: string
}

// Champs modifiables lors d'une création/édition (l'id et timestamps sont gérés par la DB).
export type EmployeeInput = Omit<Employee, 'id' | 'created_at' | 'updated_at'>

// --- Planning / Shifts ---
export interface Shift {
  id: number
  employee_id: number
  date: string // YYYY-MM-DD
  heure_debut: string // HH:MM
  heure_fin: string // HH:MM
  poste: string | null
  pause_minutes: number
  notes: string | null
  created_at: string
}

export type ShiftInput = Omit<Shift, 'id' | 'created_at'>

// Shift enrichi du nom de l'employé pour l'affichage.
export interface ShiftWithEmployee extends Shift {
  employee_nom: string
  employee_prenom: string
}

// --- Congés / Absences ---
export type LeaveType =
  | 'Congé payé'
  | 'RTT'
  | 'Maladie'
  | 'Absence injustifiée'
  | 'Congé sans solde'
  | 'Congé maternité/paternité'
  | 'Formation'
  | 'Autre'

export type LeaveStatus = 'En attente' | 'Approuvé' | 'Refusé'

export interface Leave {
  id: number
  employee_id: number
  type: LeaveType
  date_debut: string // YYYY-MM-DD
  date_fin: string // YYYY-MM-DD
  statut: LeaveStatus
  motif: string | null
  created_at: string
}

export type LeaveInput = Omit<Leave, 'id' | 'created_at'>

export interface LeaveWithEmployee extends Leave {
  employee_nom: string
  employee_prenom: string
}

// --- Pointage / Heures travaillées ---
export interface TimeEntry {
  id: number
  employee_id: number
  date: string // YYYY-MM-DD
  arrivee: string // HH:MM
  depart: string | null // HH:MM (null tant que non pointé sortie)
  pause_minutes: number
  notes: string | null
  created_at: string
}

export type TimeEntryInput = Omit<TimeEntry, 'id' | 'created_at'>

export interface TimeEntryWithEmployee extends TimeEntry {
  employee_nom: string
  employee_prenom: string
  heures_travaillees: number // calculé
}

// --- Tableau de bord ---

/** Un mois de masse salariale, reconstitué depuis les bulletins archivés. */
export interface MoisPaie {
  mois: string // 'YYYY-MM'
  libelle: string // 'août 26'
  brut: number
  net: number
  retenues: number
  cout_employeur: number
  bulletins: number
}

/** Une part dans une répartition (par poste, par catégorie, par sexe…). */
export interface Part {
  cle: string
  libelle: string
  valeur: number
}

/** Le pointage du jour d'un salarié ; `code` vaut null s'il n'est pas saisi. */
export interface PointageJour {
  nom: string
  poste: string
  code: PresenceCode | null
}

/** Une demande de congé, telle qu'elle attend d'être traitée. */
export interface CongeAttente {
  nom: string
  type: string
  date_debut: string
  date_fin: string
  jours: number
  statut: string
}

/** Une absence relevée au registre de pointage. */
export interface AbsenceRelevee {
  nom: string
  date: string
  code: PresenceCode
  commentaire: string | null
}

/** Rappel d'une déclaration CNSS restant à déposer. */
export interface RappelDeclaration {
  reference: string
  periode: string
  date_limite: string
  jours: number // négatif si l'échéance est dépassée
  statut: string
  montant: number
  /** Majoration de retard estimée à ce jour (0 tant que le délai court). */
  majoration_estimee: number
}

/**
 * Panorama complet du tableau de bord. Tout est calculé côté principal en une
 * seule requête IPC : le rendu n'a plus qu'à afficher, et l'écran ne clignote
 * pas au fil de huit chargements indépendants.
 */
export interface DashboardPanorama {
  genere_le: string
  mois_courant: string // 'YYYY-MM'

  effectif: {
    actifs: number
    total: number
    entrees_12m: number
    sorties_12m: number
    par_poste: Part[]
    par_categorie: Part[]
    par_sexe: Part[]
    anciennete_moyenne_mois: number
    masse_contractuelle: number // somme des salaires mensuels des actifs
  }

  masse: MoisPaie[] // 12 derniers mois, du plus ancien au plus récent

  paie: {
    dernier_mois: MoisPaie | null
    variation_pct: number | null // par rapport au mois précédent
    bulletins_total: number
    bulletins_payes: number
    net_moyen: number
    net_du: number // bulletins non encore payés
  }

  presences: {
    presents: number
    absents: number
    conges: number
    repos: number
    saisies: number
    taux_presence: number // en %, sur les jours ouvrés saisis
  }

  cotisations: {
    declarations: number
    deposees: number
    en_attente: number
    total_annee: number
    prochaine_echeance: {
      reference: string
      date_limite: string
      jours: number // négatif si dépassée
      montant: number
          /** Majoration de retard estimée à ce jour (0 si le délai court encore). */
      majoration_estimee: number
    } | null
  }

  ajustements: { primes: number; retenues: number; lignes: number }

  contrats: {
    actifs: number
    a_echeance: number
    expires: number
    echeances: { nom: string; poste: string; date_fin: string; jours: number }[]
  }

  /** Pointage du jour, un salarié actif par ligne. */
  pointage_jour: PointageJour[]
  /** Demandes de congés en attente de décision. */
  conges_attente: CongeAttente[]
  /** Absences et maladies relevées sur le mois en cours. */
  absences_mois: AbsenceRelevee[]
  /** BNTS / DRS restant à déposer, par échéance croissante. */
  rappels: RappelDeclaration[]

  jour: {
    services: number
    heures_semaine: number
    conges_en_attente: number
  }
}

// --- Éléments de paie ajoutés à la main (primes, indemnités, retenues) ---
export type SensElement = 'gain' | 'retenue'

/**
 * Ligne ajoutée au bulletin d'un salarié. Chaque élément précise s'il entre
 * dans l'assiette des cotisations et dans celle de l'impôt : une prime de
 * rendement y entre, un remboursement de frais non.
 */
export interface ElementPaie {
  id: number
  employee_id: number
  libelle: string
  sens: SensElement
  base: number | null // quantité (heures, jours, unités) ; null si montant direct
  taux: number | null // valeur unitaire ; null si montant direct
  montant: number // montant retenu au bulletin
  soumis_cnss: boolean
  soumis_iuts: boolean
  /** Période d'application ; null = élément permanent, repris chaque mois. */
  periode_debut: string | null
  periode_fin: string | null
  notes: string | null
  created_at: string
}

export type ElementPaieInput = Omit<ElementPaie, 'id' | 'created_at'>

export interface ElementPaieWithEmployee extends ElementPaie {
  employee_nom: string
  employee_prenom: string
}

/** Modèles courants, proposés à la saisie. */
export const MODELES_ELEMENTS: {
  libelle: string
  sens: SensElement
  soumis_cnss: boolean
  soumis_iuts: boolean
}[] = [
  { libelle: 'Prime de rendement', sens: 'gain', soumis_cnss: true, soumis_iuts: true },
  { libelle: 'Prime d’ancienneté', sens: 'gain', soumis_cnss: true, soumis_iuts: true },
  { libelle: 'Prime de responsabilité', sens: 'gain', soumis_cnss: true, soumis_iuts: true },
  { libelle: 'Heures supplémentaires', sens: 'gain', soumis_cnss: true, soumis_iuts: true },
  { libelle: 'Indemnité de transport', sens: 'gain', soumis_cnss: false, soumis_iuts: false },
  { libelle: 'Indemnité de logement', sens: 'gain', soumis_cnss: true, soumis_iuts: true },
  { libelle: 'Indemnité de caisse', sens: 'gain', soumis_cnss: true, soumis_iuts: true },
  { libelle: 'Remboursement de frais', sens: 'gain', soumis_cnss: false, soumis_iuts: false },
  { libelle: 'Avance sur salaire', sens: 'retenue', soumis_cnss: false, soumis_iuts: false },
  { libelle: 'Prêt du personnel', sens: 'retenue', soumis_cnss: false, soumis_iuts: false },
  { libelle: 'Retenue pour dégât', sens: 'retenue', soumis_cnss: false, soumis_iuts: false }
]

// --- Paie ---
// Types de congés/absences qui entraînent une retenue sur salaire (1 jour = 1 jour coupé).
export const TYPES_DEDUITS: LeaveType[] = ['Absence injustifiée', 'Congé sans solde']

/**
 * Paramètres sociaux et fiscaux (Burkina Faso par défaut).
 * Tous les taux sont configurables : la réglementation évolue et doit être
 * validée avec le comptable de l'établissement.
 */
export interface TrancheIUTS {
  plafond: number | null // borne haute de la tranche (null = tranche illimitée)
  taux: number // ex. 0.121 pour 12,1 %
}

export interface PayrollSettings {
  // --- Cotisations sociales (CNSS) ---
  cnss_salarie: number // part salariale de la branche pension, ex. 0.055
  cnss_plafond: number // plafond mensuel cotisable (arrêté n° 2022-067)
  smig: number // salaire minimum interprofessionnel garanti
  cnss_employeur_pension: number // part patronale de la branche pension, ex. 0.085
  cnss_employeur_familiales: number // prestations familiales, ex. 0.06
  cnss_employeur_risques: number // risques professionnels, ex. 0.015
  taxe_patronale: number // TPA, ex. 0.03
  // --- Impôt sur les salaires (IUTS) ---
  iuts_abattement: number // abattement forfaitaire, non-cadres (art. 111 CGI), ex. 0.25
  iuts_abattement_cadre: number // abattement des cadres moyens et supérieurs, ex. 0.20
  iuts_bareme: TrancheIUTS[]
  iuts_reduction_charge: number[] // réduction selon le nb de personnes à charge (index 0 = 1 charge)
  iuts_charges_max: number // nombre de charges admises (4 depuis 2018)
  // --- Heures supplémentaires ---
  seuil_heures_sup: number // seuil hebdomadaire, ex. 40
  majoration_sup: number // ex. 0.15
  // --- Obligations déclaratives ---
  seuil_effectif_mensuel: number // à partir de cet effectif, déclaration mensuelle (20)
  // --- Pénalités de retard (loi n° 004-2021/AN, articles 17 à 19) ---
  majoration_retard_mois: number // par mois ou fraction de mois, ex. 0.015
  taxation_office: number // en l'absence totale de déclaration, ex. 0.25
  non_production_smig: number // par salarié non déclaré, en part du SMIG, ex. 0.02
}

/** Estimation des pénalités encourues sur une déclaration en retard. */
export interface EstimationPenalites {
  en_retard: boolean
  jours_retard: number
  mois_retard: number // mois entamés
  majoration_retard: number
  total_estime: number // cotisations + majoration
}

/**
 * Taux et barèmes en vigueur au Burkina Faso.
 *
 * Sources : arrêté n° 2022-067 (plafond de cotisation), taux de cotisation
 * publiés par la CNSS (part salariale 5,5 % ; part patronale 16 % = 6 % de
 * prestations familiales + 1,5 % de risques professionnels + 8,5 % de pension),
 * barème IUTS du Code général des impôts et abattement forfaitaire de
 * l'article 111 du CGI (25 %, ramené à 20 % pour les cadres moyens et supérieurs).
 * Le nombre de charges de famille admises est limité à quatre depuis 2018.
 *
 * Tous ces paramètres restent modifiables dans l'application.
 */
export const PARAMS_PAIE_DEFAUT: PayrollSettings = {
  cnss_salarie: 0.055,
  cnss_plafond: 800000,
  smig: 45000,
  cnss_employeur_pension: 0.085,
  cnss_employeur_familiales: 0.06,
  cnss_employeur_risques: 0.015,
  taxe_patronale: 0.03,
  iuts_abattement: 0.25,
  iuts_abattement_cadre: 0.2,
  iuts_bareme: [
    { plafond: 30000, taux: 0 },
    { plafond: 50000, taux: 0.121 },
    { plafond: 80000, taux: 0.139 },
    { plafond: 120000, taux: 0.157 },
    { plafond: 170000, taux: 0.184 },
    { plafond: 250000, taux: 0.217 },
    { plafond: null, taux: 0.25 }
  ],
  iuts_reduction_charge: [0.08, 0.1, 0.12, 0.14],
  iuts_charges_max: 4,
  seuil_heures_sup: 40,
  majoration_sup: 0.15,
  seuil_effectif_mensuel: 20,
  majoration_retard_mois: 0.015,
  taxation_office: 0.25,
  non_production_smig: 0.02
}

// --- Catégories CNSS (colonne 9 du BNTS) ---
export type CategorieCnss = 'P' | 'T' | 'J' | 'F' | 'S' | 'E' | 'N'

export interface CategorieCnssInfo {
  code: CategorieCnss
  libelle: string
  prestations_familiales: boolean
  risques_professionnels: boolean
  pensions: boolean
}

export const CATEGORIES_CNSS: CategorieCnssInfo[] = [
  { code: 'P', libelle: 'Permanent', prestations_familiales: true, risques_professionnels: true, pensions: true },
  { code: 'T', libelle: 'Temporaire', prestations_familiales: true, risques_professionnels: true, pensions: true },
  { code: 'J', libelle: 'Journalier / Occasionnel / Temps partiel', prestations_familiales: true, risques_professionnels: true, pensions: true },
  { code: 'F', libelle: 'Fonctionnaire détaché', prestations_familiales: true, risques_professionnels: false, pensions: false },
  { code: 'S', libelle: 'Stagiaire / Apprenti', prestations_familiales: false, risques_professionnels: true, pensions: true },
  { code: 'E', libelle: 'Élève / Étudiant', prestations_familiales: false, risques_professionnels: true, pensions: false },
  { code: 'N', libelle: 'Volontaire national', prestations_familiales: true, risques_professionnels: true, pensions: true }
]

/** Un mois du rappel : ce qu'il coûte et ce qui en est déjà archivé. */
export interface MoisRappel {
  cle: string
  debut: string
  fin: string
  effectif: number
  brut: number
  net: number
  cotisations: number
  deja_archives: number
}

export interface ResultatRappel {
  mois: number
  emis: number
  existants: number
  detail: { cle: string; debut: string; fin: string; emis: number; existants: number }[]
}

/** Ce que la suppression d'un contrat a changé sur la fiche du salarié. */
export interface SuppressionContrat {
  fiche: 'inchangee' | 'reprise' | 'effacee'
  message: string
}

export interface PayrollParams {
  start: string // YYYY-MM-DD
  end: string // YYYY-MM-DD
  settings: PayrollSettings
}

/** Une ligne de gain ou de retenue affichée sur le bulletin. */
export interface LignePaie {
  libelle: string
  base: string // texte affiché en colonne « base » (ex. « 12,00 h × 1 500 »)
  taux: string // texte affiché en colonne « taux » (ex. « 5,50 % »)
  montant: number
}

export interface PayrollRow {
  employee_id: number
  matricule: string
  numero_cnss: string
  categorie_cnss: CategorieCnss
  cadre: boolean
  nom: string
  prenom: string
  poste: string
  telephone: string | null
  adresse: string | null
  type_contrat: string
  date_embauche: string | null
  personnes_a_charge: number
  taux_abattement: number // abattement IUTS appliqué (20 % ou 25 %)
  mois_couverts: number // nombre de mois de la période (3 pour un trimestre)
  elements: ElementPaie[] // primes et retenues ajoutées à la main

  taux_horaire: number
  salaire_mensuel: number // 0 si l'employé est payé à l'heure
  heures_normales: number
  heures_sup: number
  heures_total: number
  jours_absence: number
  jours_travailles: number

  gains: LignePaie[]
  retenues: LignePaie[]

  salaire_base: number // base avant heures sup et retenues
  prime_heures_sup: number
  retenue_absences: number
  brut_imposable: number // total des gains
  base_cotisable: number // brut plafonné pour la CNSS
  cnss_salarie: number
  base_iuts: number
  iuts: number
  total_retenues: number
  net_a_payer: number

  cnss_employeur: number
  taxe_patronale: number
  cout_employeur: number
}

// --- Déclarations CNSS (BNTS / DRS) ---

/** Nature du revenu, colonne 10 du BNTS. */
export type NatureRevenu = 'S' | 'C' | 'R' | 'A'

export const NATURES_REVENU: { code: NatureRevenu; libelle: string }[] = [
  { code: 'S', libelle: 'Salaire' },
  { code: 'C', libelle: 'Congé' },
  { code: 'R', libelle: 'Rappel' },
  { code: 'A', libelle: 'Autres' }
]

/** Une ligne du bordereau nominatif (BNTS). */
export interface LigneBntsDto {
  numero: number
  matricule: string
  numero_cnss: string
  nom: string
  prenom: string
  periode_debut: string
  periode_fin: string
  salaire_brut: number
  base_cnss: number
  categorie: CategorieCnss
  nature: NatureRevenu
}

/** Décompte d'une branche de cotisation dans la DRS. */
export interface BrancheDrs {
  nom: string
  base: number
  taux: number
  cotisation: number
  effectifs: Record<CategorieCnss, number>
}

/** Résultat complet d'une déclaration : alimente le BNTS et la DRS. */
export interface DeclarationDto {
  periode_debut: string
  periode_fin: string
  mois_couverts: number
  mensuelle: boolean // true si effectif >= seuil (déclaration mensuelle)
  date_limite: string
  effectif: number
  lignes: LigneBntsDto[]
  total_salaires_bruts: number
  total_base_cnss: number
  branches: BrancheDrs[]
  total_cotisations: number
}

// --- Registre de pointage (présences / absences) ---
export type PresenceCode = 'P' | 'A' | 'C' | 'R' | 'M' | 'F'

export interface PresenceType {
  code: PresenceCode
  label: string
  couleur: string // nom de la variable CSS de teinte (sans le préfixe --)
  deduit: boolean // entraîne une retenue de salaire
  travaille: boolean // compte comme jour travaillé
}

export const TYPES_PRESENCE: PresenceType[] = [
  { code: 'P', label: 'Présent', couleur: 'succes', deduit: false, travaille: true },
  { code: 'A', label: 'Absent (non justifié)', couleur: 'erreur', deduit: true, travaille: false },
  { code: 'C', label: 'Congé payé', couleur: 'info', deduit: false, travaille: false },
  { code: 'R', label: 'Repos hebdomadaire', couleur: 'neutre', deduit: false, travaille: false },
  { code: 'M', label: 'Maladie', couleur: 'alerte', deduit: false, travaille: false },
  { code: 'F', label: 'Congé sans solde', couleur: 'erreur', deduit: true, travaille: false }
]

export interface Presence {
  id: number
  employee_id: number
  date: string // YYYY-MM-DD
  code: PresenceCode
  commentaire: string | null
}

export interface PresenceInput {
  employee_id: number
  date: string
  code: PresenceCode
  commentaire: string | null
}

/** Totaux mensuels d'un employé dans le registre. */
export interface PresenceResume {
  employee_id: number
  presents: number
  absents: number
  conges: number
  repos: number
  maladie: number
  sans_solde: number
  jours_deduits: number
}

// --- Registre des bulletins de paie ---
export type StatutBulletin = 'Émis' | 'Payé' | 'Annulé'

/**
 * Bulletin archivé. Le détail du calcul est figé au moment de l'émission
 * (`donnees`) : un bulletin remis au salarié ne doit jamais changer, même si
 * les taux, les pointages ou la fiche de l'employé évoluent ensuite.
 */
/**
 * Un acte établi, figé dans le registre. `corps` est la copie exacte du
 * document imprimé au moment où il a été établi : la réimpression reste
 * fidèle même si la fiche du salarié change ensuite.
 */
export interface ActeDocument {
  id: number
  reference: string // code de l'acte, ex. « ATT-2026-KS004 »
  employee_id: number
  employee_nom: string
  type_acte: string // clé de l'acte, ex. « attestation_travail »
  libelle: string
  categorie: string
  orientation: 'portrait' | 'paysage'
  corps: string // HTML figé du document
  options: string | null // JSON des options utilisées
  created_at: string
  updated_at: string
}

/** Données pour ranger un acte dans le registre (le code est fourni par l'appelant). */
export interface ActeDocumentInput {
  reference: string
  employee_id: number
  employee_nom: string
  type_acte: string
  libelle: string
  categorie: string
  orientation: 'portrait' | 'paysage'
  corps: string
  options: string | null
}

export interface Payslip {
  id: number
  reference: string // ex. « BP-2026-08-0003 »
  employee_id: number
  periode_debut: string
  periode_fin: string
  brut: number
  total_retenues: number
  net_a_payer: number
  cout_employeur: number
  donnees: PayrollRow // instantané complet du calcul
  parametres: PayrollSettings // barème appliqué ce mois-là
  statut: StatutBulletin
  date_paiement: string | null
  created_at: string
}

export interface PayslipWithEmployee extends Payslip {
  employee_nom: string
  employee_prenom: string
  employee_matricule: string | null
}

// --- Comparaison entre une archive et un nouveau calcul ---
export type EtatComparaison = 'identique' | 'modifie' | 'nouveau' | 'retire'

export interface EcartChamp {
  libelle: string
  avant: number
  apres: number
}

/** Ce qui a changé pour un salarié entre le bulletin archivé et le calcul actuel. */
export interface ComparaisonBulletin {
  employee_id: number
  reference: string | null
  nom: string
  prenom: string
  etat: EtatComparaison
  ecarts: EcartChamp[]
}

/** Bilan d'une période déjà clôturée. */
export interface BilanPeriode {
  existe: boolean
  nb_archives: number
  nb_identiques: number
  nb_modifies: number
  nb_nouveaux: number
  nb_retires: number
  comparaisons: ComparaisonBulletin[]
}

// --- Registre des déclarations CNSS ---
export type StatutDeclaration = 'Brouillon' | 'Déposée' | 'Payée'

export const STATUTS_DECLARATION: StatutDeclaration[] = ['Brouillon', 'Déposée', 'Payée']

/** Déclaration archivée : le BNTS et la DRS se réimpriment à l'identique. */
export interface DeclarationRecord {
  id: number
  reference: string // ex. « DRS-2026-T3-0001 »
  periode_debut: string
  periode_fin: string
  mensuelle: boolean
  date_limite: string
  effectif: number
  total_salaires_bruts: number
  total_base_cnss: number
  total_cotisations: number
  donnees: DeclarationDto // instantané du bordereau et du décompte
  statut: StatutDeclaration
  date_depot: string | null
  created_at: string
}

// --- Génération de planning ---
export interface GenerateWeekOptions {
  week_start: string // lundi YYYY-MM-DD
  jours: number[] // index 0=lundi … 6=dimanche
  heure_debut: string // HH:MM
  pause_minutes: number
  remplacer: boolean // supprimer les services existants de la semaine avant de générer
}

// --- Authentification ---
// ---------------------------------------------- Employeurs (multi-dossiers)

/**
 * Un employeur du portefeuille. Chaque employeur possède sa propre base de
 * données : `fichier` en donne le nom. Le registre ne contient aucune donnée
 * de paie, seulement l'annuaire.
 */
/** Forme juridique de l'employeur — détermine l'en-tête des actes. */
export type FormeJuridique =
  | 'Entreprise individuelle'
  | 'SARL'
  | 'SARL unipersonnelle'
  | 'SA'
  | 'SAS'
  | 'GIE'
  | 'Association'
  | 'ONG'
  | 'Établissement public'
  | 'Autre'

export const FORMES_JURIDIQUES: FormeJuridique[] = [
  'Entreprise individuelle',
  'SARL',
  'SARL unipersonnelle',
  'SA',
  'SAS',
  'GIE',
  'Association',
  'ONG',
  'Établissement public',
  'Autre'
]

/**
 * État du dossier dans le portefeuille du cabinet.
 * Distinct de `archive` : un dossier suspendu reste visible et compté, un
 * dossier archivé sort du portefeuille courant.
 */
export type EtatDossier = 'prospect' | 'actif' | 'suspendu' | 'clos'

export const ETATS_DOSSIER: { etat: EtatDossier; libelle: string; ton: string }[] = [
  { etat: 'prospect', libelle: 'Prospect', ton: 'info' },
  { etat: 'actif', libelle: 'Actif', ton: 'succes' },
  { etat: 'suspendu', libelle: 'Suspendu', ton: 'alerte' },
  { etat: 'clos', libelle: 'Clos', ton: 'neutre' }
]

/** Périodicité de déclaration CNSS : dépend de l'effectif. */
export type PeriodiciteDeclaration = 'mensuelle' | 'trimestrielle'

/**
 * Fiche complète d'un employeur suivi.
 *
 * Elle vit dans le REGISTRE (annuaire du cabinet) et non dans la base du
 * client : c'est ce qui permet d'afficher le portefeuille sans ouvrir vingt
 * bases, et de retrouver un dossier même si sa base est momentanément
 * illisible.
 */
export interface EmployeurRegistre {
  id: number
  nom: string
  fichier: string
  // --- Identité juridique ---
  sigle: string | null
  forme_juridique: string | null
  rccm: string | null
  ifu: string | null
  numero_cnss: string | null
  secteur_activite: string | null
  date_creation: string | null
  // --- Adresse & contact ---
  ville: string | null
  quartier: string | null
  adresse: string | null
  boite_postale: string | null
  telephone: string | null
  email: string | null
  // --- Représentant légal ---
  representant_nom: string | null
  representant_qualite: string | null
  representant_telephone: string | null
  // --- Suivi de la mission ---
  etat: EtatDossier
  periodicite: PeriodiciteDeclaration
  contact_cabinet: string | null
  honoraires: number | null
  notes: string | null
  // --- Repérage & cycle de vie ---
  logo: string | null
  couleur: string | null
  archive: boolean
  cree_le: string
  ouvert_le: string | null
}

/** Champs modifiables d'un employeur. `nom` seul est obligatoire. */
export type EmployeurInput = Partial<Omit<EmployeurRegistre, 'id' | 'fichier' | 'cree_le' | 'ouvert_le' | 'archive'>> & {
  nom: string
}

/** Indicateurs d'un employeur, pour la vue portefeuille du cabinet. */
export interface BilanEmployeur {
  id: number
  nom: string
  ville: string | null
  numero_cnss: string | null
  couleur: string | null
  logo: string | null
  effectif: number
  masse_mois: number
  bulletins_attente: number
  net_du: number
  declaration_retard: boolean
  jours_echeance: number | null
  contrats_echeance: number
  alertes: number
  /** Ce que coûte le retard du client, estimé — pour prioriser les dépôts. */
  majoration_estimee: number
  erreur?: string
}

/**
 * Mode d'exploitation de l'installation.
 * « auto » = pas encore tranché : on déduit du nombre d'employeurs enregistrés.
 */
export type ModePortefeuille = 'mono' | 'cabinet' | 'auto'

/** Un dossier employeur, tel que décrit dans le manifeste d'une sauvegarde. */
export interface ManifesteEmployeur {
  id: number
  nom: string
  ville: string | null
  numero_cnss: string | null
  couleur: string | null
  fichier: string
  taille: number
  effectif: number
  bulletins: number
}

/**
 * Fiche d'identité d'une sauvegarde, écrite en clair à côté des bases.
 * Elle permet de savoir ce qu'on s'apprête a restaurer AVANT de l'ouvrir.
 */
export interface Manifeste {
  produit: 'Nafasoft'
  version: string
  format: number
  type: 'portefeuille' | 'employeur'
  cree_le: string
  employeurs: ManifesteEmployeur[]
  pieces: number
}

export interface ResultatSauvegarde {
  dossier: string
  manifeste: Manifeste
  octets: number
}

/** Rôles des comptes. « concepteur » n'existe que via le compte maître universel. */
export type RoleUtilisateur = 'concepteur' | 'administrateur' | 'utilisateur'

export const ROLES_UTILISATEUR: { role: RoleUtilisateur; libelle: string; description: string }[] = [
  {
    role: 'administrateur',
    libelle: 'Administrateur',
    description: 'Accès complet : gère l’entreprise, les réglages et les comptes utilisateurs.'
  },
  {
    role: 'utilisateur',
    libelle: 'Utilisateur',
    description: 'Usage quotidien (personnel, paie, documents) — sans les réglages ni la gestion des comptes.'
  }
]

/** Un compte, tel qu'exposé au renderer — sans aucun secret (hash, réponse). */
export interface Utilisateur {
  id: number
  username: string
  nom: string
  role: RoleUtilisateur
  must_change: boolean // doit changer son mot de passe à la prochaine connexion
  question: string | null // question de secours (la réponse n'est jamais renvoyée)
  a_recuperation: boolean // une réponse de secours est définie
  created_at: string
  updated_at: string
}

/** Session ouverte après connexion. */
export interface SessionUtilisateur {
  username: string
  nom: string
  role: RoleUtilisateur
  must_change: boolean
  concepteur: boolean // connecté via le compte maître universel
}

export interface ResultatLogin {
  ok: boolean
  erreur?: string
  session?: SessionUtilisateur
}

export interface NouvelUtilisateur {
  username: string
  nom: string
  role: RoleUtilisateur
  motDePasse: string
}

export interface AuthStatus {
  configure: boolean // au moins un administrateur existe (installation initialisée)
}

// --- Réglages de l'entreprise & modèles de documents ---
export interface AppConfig {
  entreprise_nom: string
  entreprise_activite: string
  logo: string | null // logo de l'entreprise en data URI (barre latérale, connexion, documents)
  doc_couleur: string // couleur d'accent des documents (#rrggbb) ; '' = neutre par défaut
  entreprise_adresse: string
  entreprise_ville: string
  entreprise_telephone: string
  entreprise_email: string
  numero_employeur_cnss: string // n° employeur CNSS, obligatoire sur la DRS
  ifu: string // Identifiant Financier Unique
  rccm: string // registre du commerce
  representant: string // signataire côté employeur
  devise: string // ex. « FCFA »
  // Valeurs par défaut du modèle de contrat
  contrat_duree_mois: number // ex. 3
  contrat_jours_repos: number // jours de repos hebdomadaire, ex. 1
  contrat_periode_essai: string // ex. « 1 mois »
  contrat_clauses: string // clauses additionnelles par défaut (texte libre)
}

// Valeurs par défaut NEUTRES : un nouvel acheteur ne doit hériter d'aucune
// identité — il renseigne la sienne à la première configuration. Seuls
// restent des repères raisonnables pour le Burkina Faso (ville, devise).
export const CONFIG_DEFAUT: AppConfig = {
  entreprise_nom: '',
  entreprise_activite: '',
  logo: null,
  doc_couleur: '',
  entreprise_adresse: '',
  entreprise_ville: 'Ouagadougou',
  entreprise_telephone: '',
  entreprise_email: '',
  numero_employeur_cnss: '',
  ifu: '',
  rccm: '',
  representant: '',
  devise: 'FCFA',
  contrat_duree_mois: 3,
  contrat_jours_repos: 1,
  contrat_periode_essai: '1 mois',
  contrat_clauses:
    "Le salarié s'engage à respecter le règlement intérieur ainsi que les règles d'hygiène et de sécurité en vigueur dans l'établissement."
}

export type ModeSalaire = 'mensuel' | 'horaire'

// --- Pièces jointes du dossier salarié ---
export const TYPES_PIECE = [
  'CNIB / Pièce d’identité',
  'Diplôme',
  'Certificat médical',
  'Attestation',
  'Curriculum vitae',
  'Contrat signé',
  'Autre'
] as const

export type TypePiece = (typeof TYPES_PIECE)[number]

export interface EmployeeDocument {
  id: number
  employee_id: number
  type: TypePiece
  nom: string // libellé lisible
  fichier: string // chemin du fichier copié dans le dossier de l'application
  taille: number // en octets
  notes: string | null
  created_at: string
}

// --- Documents RH générés ---
/** Motifs de sortie de l'imprimé CNSS « bulletin d'entrée / sortie ». */
export type MotifSortie =
  | 'Suspension'
  | 'Démission'
  | 'Licenciement'
  | 'Fin de contrat'
  | 'Retraite'
  | 'Décès'
  | 'Affectation'

export const MOTIFS_SORTIE: MotifSortie[] = [
  'Suspension',
  'Démission',
  'Licenciement',
  'Fin de contrat',
  'Retraite',
  'Décès',
  'Affectation'
]

export type TypeDocumentRh =
  | 'attestation_travail'
  | 'certificat_travail'
  | 'ordre_mission'
  | 'autorisation_conge'

export interface DocumentRhOptions {
  type: TypeDocumentRh
  // Champs communs
  lieu: string
  date: string
  objet: string // motif, destination ou observation selon le document
  date_debut: string
  date_fin: string
}

// --- Articles du contrat ---

/**
 * Un article du contrat. Le contenu peut contenir des variables entre doubles
 * accolades, remplacées à l'impression par les valeurs réelles du contrat :
 * le texte reste ainsi juste même si le salaire ou les dates changent ensuite.
 */
export interface ArticleContrat {
  titre: string
  contenu: string
}

/** Variables utilisables dans le corps d'un article. */
export const VARIABLES_CONTRAT: { cle: string; description: string }[] = [
  { cle: 'salarie', description: 'Nom et prénom du salarié' },
  { cle: 'entreprise', description: "Nom de l'établissement" },
  { cle: 'poste', description: 'Poste occupé' },
  { cle: 'type_contrat', description: 'Type de contrat (CDI, CDD…)' },
  { cle: 'date_debut', description: 'Date de prise d’effet' },
  { cle: 'date_fin', description: 'Date de fin (ou « indéterminée »)' },
  { cle: 'duree_mois', description: 'Durée en mois' },
  { cle: 'salaire', description: 'Rémunération avec la devise' },
  { cle: 'periodicite', description: '« mensuel » ou « horaire »' },
  { cle: 'heures_hebdo', description: 'Heures par semaine' },
  { cle: 'jours_repos', description: 'Jours de repos hebdomadaire' },
  { cle: 'periode_essai', description: "Durée de la période d'essai" },
  { cle: 'ville', description: "Ville de l'établissement" },
  { cle: 'representant', description: "Représentant de l'employeur" }
]

/** Trame par défaut, conforme au Code du travail burkinabè (loi n° 028-2008/AN). */
export const ARTICLES_DEFAUT: ArticleContrat[] = [
  {
    titre: 'Engagement et fonctions',
    contenu:
      "L'Employeur engage le Salarié qui accepte, en qualité de {{poste}}. Le Salarié exécutera son travail sous l'autorité et selon les directives de l'Employeur, dans le respect du règlement intérieur de l'établissement."
  },
  {
    titre: 'Nature et durée du contrat',
    contenu:
      'Le présent contrat est conclu sous la forme d’un {{type_contrat}} prenant effet le {{date_debut}}, pour une durée de {{duree_mois}} mois et prenant fin le {{date_fin}}.\nUne période d’essai de {{periode_essai}} est prévue, durant laquelle chacune des parties peut rompre le contrat sans préavis ni indemnité.'
  },
  {
    titre: "Lieu d'exécution du travail",
    contenu:
      "Le Salarié exercera ses fonctions au sein de l'établissement {{entreprise}}, situé à {{ville}}. Il pourra être affecté ponctuellement sur tout autre site de l'établissement selon les nécessités du service."
  },
  {
    titre: 'Durée du travail et repos',
    contenu:
      "La durée hebdomadaire de travail est fixée à {{heures_hebdo}} heures, réparties selon le planning établi par l'Employeur. Compte tenu de l'activité de restauration, les horaires peuvent inclure les soirées, week-ends et jours fériés.\nLe Salarié bénéficie d'un repos hebdomadaire de {{jours_repos}} jour(s). Les heures effectuées au-delà de la durée légale ouvrent droit aux majorations prévues par la réglementation."
  },
  {
    titre: 'Rémunération',
    contenu:
      'En contrepartie de son travail, le Salarié perçoit un salaire {{periodicite}} brut de {{salaire}}, payable à terme échu. Cette rémunération est soumise aux retenues sociales et fiscales légales (CNSS, IUTS), qui figurent sur le bulletin de paie remis au Salarié.'
  },
  {
    titre: 'Congés payés',
    contenu:
      "Le Salarié a droit à un congé payé calculé conformément aux dispositions du Code du travail, soit deux jours et demi ouvrables par mois de service effectif. La période de prise des congés est fixée par l'Employeur en fonction des nécessités du service."
  },
  {
    titre: 'Protection sociale',
    contenu:
      "L'Employeur procède à l'immatriculation du Salarié auprès de la Caisse Nationale de Sécurité Sociale (CNSS) et verse les cotisations correspondantes. Le Salarié s'engage à fournir toutes les pièces nécessaires à son immatriculation et à signaler tout changement de sa situation familiale."
  },
  {
    titre: 'Obligations du salarié',
    contenu:
      "Le Salarié s'engage à exécuter avec soin et loyauté les tâches qui lui sont confiées, à respecter les règles d'hygiène, de sécurité alimentaire et de propreté en vigueur, à observer les horaires de travail et signaler sans délai toute absence, à prendre soin du matériel mis à sa disposition, et à observer la discrétion la plus stricte sur les informations de l'établissement."
  },
  {
    titre: 'Rupture du contrat',
    contenu:
      "Le présent contrat peut être rompu dans les conditions prévues par le Code du travail et la convention collective applicable. Toute rupture donne lieu à l'établissement d'un certificat de travail et au règlement des sommes restant dues."
  },
  {
    titre: 'Règlement des différends',
    contenu:
      "Les parties s'engagent à rechercher une solution amiable à tout différend né de l'exécution du présent contrat. À défaut, le litige sera porté devant l'inspection du travail puis, le cas échéant, devant le tribunal du travail compétent."
  }
]

// --- Contrats enregistrés ---
export type StatutContrat = 'Brouillon' | 'Signé' | 'Terminé' | 'Rompu'

export const STATUTS_CONTRAT: StatutContrat[] = ['Brouillon', 'Signé', 'Terminé', 'Rompu']

/**
 * Contrat conservé en base. Les conditions (poste, salaire, durée) y sont
 * recopiées et non simplement référencées : un contrat signé doit rester fidèle
 * même si la fiche du salarié évolue ensuite.
 */
export interface Contract {
  id: number
  employee_id: number
  reference: string // ex. « CDD-2026-0003 »
  type_contrat: ContractType
  poste: string
  date_debut: string
  date_fin: string | null
  duree_mois: number | null
  mode_salaire: ModeSalaire
  salaire_montant: number
  heures_hebdo: number
  jours_repos: number
  periode_essai: string
  clauses: string
  articles: ArticleContrat[] // corps du contrat, entièrement personnalisable
  lieu_signature: string
  statut: StatutContrat
  date_signature: string | null
  /** Contrat que celui-ci prolonge ou modifie (avenant / renouvellement). */
  parent_id: number | null
  motif_rupture: string | null
  created_at: string
}

export type ContractInput = Omit<Contract, 'id' | 'created_at'>

export interface ContractWithEmployee extends Contract {
  employee_nom: string
  employee_prenom: string
  employee_matricule: string | null
}

// Données d'un contrat à générer (pré-remplies puis personnalisables avant impression).
export interface ContractData {
  entreprise_nom: string
  entreprise_activite: string
  entreprise_adresse: string
  entreprise_ville: string
  representant: string
  salarie_nom: string
  salarie_prenom: string
  salarie_adresse: string
  salarie_tel: string
  salarie_secu: string
  type_contrat: string
  poste: string
  date_debut: string
  duree_mois: number
  date_fin: string
  mode_salaire: ModeSalaire
  salaire_montant: number
  heures_hebdo: number
  jours_repos: number
  periode_essai: string
  clauses: string
  articles: ArticleContrat[]
  lieu_signature: string
  devise: string
}
