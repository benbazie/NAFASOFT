import { getDb } from './index'
import type {
  Employee,
  EmployeeInput,
  Shift,
  ShiftInput,
  ShiftWithEmployee,
  Leave,
  LeaveInput,
  LeaveWithEmployee,
  TimeEntry,
  TimeEntryInput,
  TimeEntryWithEmployee,
  DashboardPanorama,
  MoisPaie,
  PresenceCode,
  GenerateWeekOptions,
  MoisRappel,
  PayrollParams,
  PayrollRow,
  ResultatRappel,
  SuppressionContrat,
  PayrollSettings,
  LignePaie,
  Presence,
  PresenceInput,
  CategorieCnss,
  DeclarationDto,
  LigneBntsDto,
  BrancheDrs,
  Contract,
  ContractInput,
  ContractWithEmployee,
  ArticleContrat,
  EmployeeDocument,
  PayslipWithEmployee,
  DeclarationRecord,
  BilanPeriode,
  ComparaisonBulletin,
  EcartChamp,
  EtatComparaison,
  ElementPaie,
  ElementPaieInput,
  ActeDocument,
  ActeDocumentInput
} from '../../shared/types'
import {
  TYPES_DEDUITS,
  TYPES_PRESENCE,
  CATEGORIES_CNSS,
  ARTICLES_DEFAUT
} from '../../shared/types'
import { PARAMS_PAIE_DEFAUT } from '../../shared/types'
import { estimerPenalites } from '../../shared/penalites'

// ============================ EMPLOYÉS ============================

/** SQLite renvoie les booléens sous forme de 0/1 : on rétablit le type attendu. */
function mapEmployee(row: Record<string, unknown>): Employee {
  return { ...row, cadre: Boolean(row.cadre) } as Employee
}

export const employeesRepo = {
  list(includeInactive = true): Employee[] {
    const where = includeInactive ? '' : `WHERE statut = 'actif'`
    const rows = getDb()
      .prepare(`SELECT * FROM employees ${where} ORDER BY nom, prenom`)
      .all() as Record<string, unknown>[]
    return rows.map(mapEmployee)
  },

  get(id: number): Employee | undefined {
    const row = getDb().prepare('SELECT * FROM employees WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined
    return row ? mapEmployee(row) : undefined
  },

  create(data: EmployeeInput): Employee {
    const stmt = getDb().prepare(`
      INSERT INTO employees
        (matricule, numero_cnss, categorie_cnss, cadre, sexe, date_naissance, personnes_a_charge,
         photo, lieu_naissance, nationalite, cnib, nom_pere, nom_mere,
         situation_famille, nom_conjoint, nombre_enfants, contact_urgence,
         nom, prenom, poste, type_contrat, date_embauche, date_fin_contrat,
         salaire_horaire, salaire_mensuel, heures_hebdo, telephone, email, adresse, statut, notes,
         acte_nature, acte_numero, acte_date, acte_lieu, nom_jeune_fille,
         departement_naissance, province_naissance, pays_naissance, groupe_sanguin,
         prenoms_pere, prenoms_mere, prenoms_conjoint, adresse_conjoint, banque,
         compte_bancaire, compte_ccp, province, departement, secteur, quartier,
         numero_rue, nom_rue, numero_lot, nom_immeuble, numero_etage, numero_porte,
         qualification)
      VALUES
        (@matricule, @numero_cnss, @categorie_cnss, @cadre, @sexe, @date_naissance, @personnes_a_charge,
         @photo, @lieu_naissance, @nationalite, @cnib, @nom_pere, @nom_mere,
         @situation_famille, @nom_conjoint, @nombre_enfants, @contact_urgence,
         @nom, @prenom, @poste, @type_contrat, @date_embauche, @date_fin_contrat,
         @salaire_horaire, @salaire_mensuel, @heures_hebdo, @telephone, @email, @adresse, @statut, @notes,
         @acte_nature, @acte_numero, @acte_date, @acte_lieu, @nom_jeune_fille,
         @departement_naissance, @province_naissance, @pays_naissance, @groupe_sanguin,
         @prenoms_pere, @prenoms_mere, @prenoms_conjoint, @adresse_conjoint, @banque,
         @compte_bancaire, @compte_ccp, @province, @departement, @secteur, @quartier,
         @numero_rue, @nom_rue, @numero_lot, @nom_immeuble, @numero_etage, @numero_porte,
         @qualification)
    `)
    const info = stmt.run(normalizeEmployee(data))
    return this.get(Number(info.lastInsertRowid))!
  },

  update(id: number, data: EmployeeInput): Employee {
    const stmt = getDb().prepare(`
      UPDATE employees SET
        matricule = @matricule, numero_cnss = @numero_cnss, categorie_cnss = @categorie_cnss,
        cadre = @cadre, sexe = @sexe, date_naissance = @date_naissance,
        personnes_a_charge = @personnes_a_charge, photo = @photo,
        lieu_naissance = @lieu_naissance, nationalite = @nationalite, cnib = @cnib,
        nom_pere = @nom_pere, nom_mere = @nom_mere,
        situation_famille = @situation_famille, nom_conjoint = @nom_conjoint,
        nombre_enfants = @nombre_enfants, contact_urgence = @contact_urgence,
        nom = @nom, prenom = @prenom, poste = @poste, type_contrat = @type_contrat,
        date_embauche = @date_embauche, date_fin_contrat = @date_fin_contrat,
        salaire_horaire = @salaire_horaire, salaire_mensuel = @salaire_mensuel,
        heures_hebdo = @heures_hebdo,
        telephone = @telephone, email = @email, adresse = @adresse,
        statut = @statut, notes = @notes,
        acte_nature = @acte_nature, acte_numero = @acte_numero, acte_date = @acte_date,
        acte_lieu = @acte_lieu, nom_jeune_fille = @nom_jeune_fille,
        departement_naissance = @departement_naissance,
        province_naissance = @province_naissance, pays_naissance = @pays_naissance,
        groupe_sanguin = @groupe_sanguin, prenoms_pere = @prenoms_pere,
        prenoms_mere = @prenoms_mere, prenoms_conjoint = @prenoms_conjoint,
        adresse_conjoint = @adresse_conjoint, banque = @banque,
        compte_bancaire = @compte_bancaire, compte_ccp = @compte_ccp,
        province = @province, departement = @departement, secteur = @secteur,
        quartier = @quartier, numero_rue = @numero_rue, nom_rue = @nom_rue,
        numero_lot = @numero_lot, nom_immeuble = @nom_immeuble,
        numero_etage = @numero_etage, numero_porte = @numero_porte,
        qualification = @qualification,
        updated_at = datetime('now')
      WHERE id = @id
    `)
    stmt.run({ ...normalizeEmployee(data), id })
    return this.get(id)!
  },

  remove(id: number): void {
    getDb().prepare('DELETE FROM employees WHERE id = ?').run(id)
  }
}

// Assure que les champs optionnels absents deviennent null (better-sqlite3 refuse undefined).
function normalizeEmployee(data: EmployeeInput): Record<string, unknown> {
  return {
    matricule: data.matricule ?? null,
    numero_cnss: data.numero_cnss ?? null,
    categorie_cnss: data.categorie_cnss ?? 'P',
    // SQLite ne connaît pas le type booléen : on stocke 0 / 1.
    cadre: data.cadre ? 1 : 0,
    sexe: data.sexe ?? null,
    date_naissance: data.date_naissance ?? null,
    personnes_a_charge: data.personnes_a_charge ?? 0,
    photo: data.photo ?? null,
    lieu_naissance: data.lieu_naissance ?? null,
    nationalite: data.nationalite ?? null,
    cnib: data.cnib ?? null,
    nom_pere: data.nom_pere ?? null,
    nom_mere: data.nom_mere ?? null,
    nom_conjoint: data.nom_conjoint ?? null,
    nombre_enfants: data.nombre_enfants ?? 0,
    situation_famille: data.situation_famille ?? null,
    contact_urgence: data.contact_urgence ?? null,
    nom: data.nom,
    prenom: data.prenom,
    poste: data.poste ?? '',
    type_contrat: data.type_contrat ?? 'CDI',
    date_embauche: data.date_embauche ?? null,
    date_fin_contrat: data.date_fin_contrat ?? null,
    salaire_horaire: data.salaire_horaire ?? null,
    salaire_mensuel: data.salaire_mensuel ?? null,
    heures_hebdo: data.heures_hebdo ?? null,
    telephone: data.telephone ?? null,
    email: data.email ?? null,
    adresse: data.adresse ?? null,
    statut: data.statut ?? 'actif',
    notes: data.notes ?? null,
    // Rubriques de l'imprimé d'immatriculation CNSS : toutes facultatives.
    acte_nature: data.acte_nature ?? null,
    acte_numero: data.acte_numero ?? null,
    acte_date: data.acte_date ?? null,
    acte_lieu: data.acte_lieu ?? null,
    nom_jeune_fille: data.nom_jeune_fille ?? null,
    departement_naissance: data.departement_naissance ?? null,
    province_naissance: data.province_naissance ?? null,
    pays_naissance: data.pays_naissance ?? null,
    groupe_sanguin: data.groupe_sanguin ?? null,
    prenoms_pere: data.prenoms_pere ?? null,
    prenoms_mere: data.prenoms_mere ?? null,
    prenoms_conjoint: data.prenoms_conjoint ?? null,
    adresse_conjoint: data.adresse_conjoint ?? null,
    banque: data.banque ?? null,
    compte_bancaire: data.compte_bancaire ?? null,
    compte_ccp: data.compte_ccp ?? null,
    province: data.province ?? null,
    departement: data.departement ?? null,
    secteur: data.secteur ?? null,
    quartier: data.quartier ?? null,
    numero_rue: data.numero_rue ?? null,
    nom_rue: data.nom_rue ?? null,
    numero_lot: data.numero_lot ?? null,
    nom_immeuble: data.nom_immeuble ?? null,
    numero_etage: data.numero_etage ?? null,
    numero_porte: data.numero_porte ?? null,
    qualification: data.qualification ?? null
  }
}

// ============================ RÉGLAGES (SETTINGS) ============================

/**
 * Paramètres de paie enregistrés, ou les valeurs par défaut.
 * Même clé que celle lue par le renderer : une majoration affichée dans le
 * tableau de bord et une autre dans l'écran de calcul seraient impossibles à
 * départager.
 */
export function lireParamsPaie(): PayrollSettings {
  try {
    const brut = getDb().prepare(`SELECT valeur FROM settings WHERE cle = 'params_paie'`).get() as
      | { valeur: string | null }
      | undefined
    if (!brut?.valeur) return { ...PARAMS_PAIE_DEFAUT }
    return { ...PARAMS_PAIE_DEFAUT, ...(JSON.parse(brut.valeur) as Partial<PayrollSettings>) }
  } catch {
    return { ...PARAMS_PAIE_DEFAUT }
  }
}

export const settingsRepo = {
  get(cle: string): string | null {
    const row = getDb().prepare('SELECT valeur FROM settings WHERE cle = ?').get(cle) as
      | { valeur: string | null }
      | undefined
    return row?.valeur ?? null
  },

  set(cle: string, valeur: string): void {
    getDb()
      .prepare(
        `INSERT INTO settings (cle, valeur) VALUES (?, ?)
         ON CONFLICT(cle) DO UPDATE SET valeur = excluded.valeur`
      )
      .run(cle, valeur)
  }
}

// ============================ PLANNING (SHIFTS) ============================

const SHIFT_SELECT = `
  SELECT s.*, e.nom AS employee_nom, e.prenom AS employee_prenom
  FROM shifts s
  JOIN employees e ON e.id = s.employee_id
`

export const shiftsRepo = {
  listByRange(start: string, end: string): ShiftWithEmployee[] {
    return getDb()
      .prepare(`${SHIFT_SELECT} WHERE s.date BETWEEN ? AND ? ORDER BY s.date, s.heure_debut`)
      .all(start, end) as ShiftWithEmployee[]
  },

  listByDate(date: string): ShiftWithEmployee[] {
    return getDb()
      .prepare(`${SHIFT_SELECT} WHERE s.date = ? ORDER BY s.heure_debut`)
      .all(date) as ShiftWithEmployee[]
  },

  create(data: ShiftInput): Shift {
    const stmt = getDb().prepare(`
      INSERT INTO shifts (employee_id, date, heure_debut, heure_fin, poste, pause_minutes, notes)
      VALUES (@employee_id, @date, @heure_debut, @heure_fin, @poste, @pause_minutes, @notes)
    `)
    const info = stmt.run({
      employee_id: data.employee_id,
      date: data.date,
      heure_debut: data.heure_debut,
      heure_fin: data.heure_fin,
      poste: data.poste ?? null,
      pause_minutes: data.pause_minutes ?? 0,
      notes: data.notes ?? null
    })
    return getDb().prepare('SELECT * FROM shifts WHERE id = ?').get(info.lastInsertRowid) as Shift
  },

  update(id: number, data: ShiftInput): Shift {
    getDb()
      .prepare(`
        UPDATE shifts SET
          employee_id = @employee_id, date = @date, heure_debut = @heure_debut,
          heure_fin = @heure_fin, poste = @poste, pause_minutes = @pause_minutes, notes = @notes
        WHERE id = @id
      `)
      .run({
        employee_id: data.employee_id,
        date: data.date,
        heure_debut: data.heure_debut,
        heure_fin: data.heure_fin,
        poste: data.poste ?? null,
        pause_minutes: data.pause_minutes ?? 0,
        notes: data.notes ?? null,
        id
      })
    return getDb().prepare('SELECT * FROM shifts WHERE id = ?').get(id) as Shift
  },

  remove(id: number): void {
    getDb().prepare('DELETE FROM shifts WHERE id = ?').run(id)
  },

  /**
   * Génère automatiquement les services d'une semaine à partir des heures
   * contractuelles de chaque employé actif, réparties sur les jours choisis.
   * Les jours où l'employé a un congé approuvé sont ignorés.
   */
  generateWeek(opts: GenerateWeekOptions): number {
    const db = getDb()
    const actifs = employeesRepo.list(false).filter((e) => (e.heures_hebdo ?? 0) > 0)
    const jours = [...opts.jours].sort((a, b) => a - b)
    if (jours.length === 0) return 0

    const weekEnd = addDaysISO(opts.week_start, 6)
    const approuves = db
      .prepare(
        `SELECT employee_id, date_debut, date_fin FROM leaves
         WHERE statut = 'Approuvé' AND date_debut <= ? AND date_fin >= ?`
      )
      .all(weekEnd, opts.week_start) as { employee_id: number; date_debut: string; date_fin: string }[]

    const insert = db.prepare(`
      INSERT INTO shifts (employee_id, date, heure_debut, heure_fin, poste, pause_minutes, notes)
      VALUES (@employee_id, @date, @heure_debut, @heure_fin, @poste, @pause_minutes, @notes)
    `)

    const run = db.transaction(() => {
      if (opts.remplacer) {
        db.prepare('DELETE FROM shifts WHERE date BETWEEN ? AND ?').run(opts.week_start, weekEnd)
      }
      let n = 0
      for (const e of actifs) {
        const heuresParJour = (e.heures_hebdo as number) / jours.length
        for (const idxJour of jours) {
          const date = addDaysISO(opts.week_start, idxJour)
          const enConge = approuves.some(
            (l) => l.employee_id === e.id && l.date_debut <= date && l.date_fin >= date
          )
          if (enConge) continue
          const fin = ajouterHeures(opts.heure_debut, heuresParJour, opts.pause_minutes)
          insert.run({
            employee_id: e.id,
            date,
            heure_debut: opts.heure_debut,
            heure_fin: fin,
            poste: e.poste || null,
            pause_minutes: opts.pause_minutes,
            notes: 'Généré automatiquement'
          })
          n++
        }
      }
      return n
    })
    return run()
  }
}

// ============================ CONGÉS / ABSENCES ============================

const LEAVE_SELECT = `
  SELECT l.*, e.nom AS employee_nom, e.prenom AS employee_prenom
  FROM leaves l
  JOIN employees e ON e.id = l.employee_id
`

export const leavesRepo = {
  list(): LeaveWithEmployee[] {
    return getDb()
      .prepare(`${LEAVE_SELECT} ORDER BY l.date_debut DESC`)
      .all() as LeaveWithEmployee[]
  },

  create(data: LeaveInput): Leave {
    const stmt = getDb().prepare(`
      INSERT INTO leaves (employee_id, type, date_debut, date_fin, statut, motif)
      VALUES (@employee_id, @type, @date_debut, @date_fin, @statut, @motif)
    `)
    const info = stmt.run({
      employee_id: data.employee_id,
      type: data.type,
      date_debut: data.date_debut,
      date_fin: data.date_fin,
      statut: data.statut ?? 'En attente',
      motif: data.motif ?? null
    })
    return getDb().prepare('SELECT * FROM leaves WHERE id = ?').get(info.lastInsertRowid) as Leave
  },

  update(id: number, data: LeaveInput): Leave {
    getDb()
      .prepare(`
        UPDATE leaves SET
          employee_id = @employee_id, type = @type, date_debut = @date_debut,
          date_fin = @date_fin, statut = @statut, motif = @motif
        WHERE id = @id
      `)
      .run({
        employee_id: data.employee_id,
        type: data.type,
        date_debut: data.date_debut,
        date_fin: data.date_fin,
        statut: data.statut ?? 'En attente',
        motif: data.motif ?? null,
        id
      })
    return getDb().prepare('SELECT * FROM leaves WHERE id = ?').get(id) as Leave
  },

  setStatus(id: number, statut: string): Leave {
    getDb().prepare('UPDATE leaves SET statut = ? WHERE id = ?').run(statut, id)
    return getDb().prepare('SELECT * FROM leaves WHERE id = ?').get(id) as Leave
  },

  remove(id: number): void {
    getDb().prepare('DELETE FROM leaves WHERE id = ?').run(id)
  }
}

// ============================ POINTAGE ============================

const TIME_SELECT = `
  SELECT t.*, e.nom AS employee_nom, e.prenom AS employee_prenom
  FROM time_entries t
  JOIN employees e ON e.id = t.employee_id
`

/** Calcule les heures travaillées (décimal) à partir des heures d'arrivée/départ et de la pause. */
export function computeHours(arrivee: string, depart: string | null, pauseMinutes: number): number {
  if (!depart) return 0
  const [ah, am] = arrivee.split(':').map(Number)
  const [dh, dm] = depart.split(':').map(Number)
  let minutes = dh * 60 + dm - (ah * 60 + am)
  if (minutes < 0) minutes += 24 * 60 // service passant minuit
  minutes -= pauseMinutes
  return Math.max(0, Math.round((minutes / 60) * 100) / 100)
}

function withHours(entry: TimeEntry & { employee_nom: string; employee_prenom: string }): TimeEntryWithEmployee {
  return { ...entry, heures_travaillees: computeHours(entry.arrivee, entry.depart, entry.pause_minutes) }
}

export const timeEntriesRepo = {
  listByRange(start: string, end: string): TimeEntryWithEmployee[] {
    const rows = getDb()
      .prepare(`${TIME_SELECT} WHERE t.date BETWEEN ? AND ? ORDER BY t.date DESC, t.arrivee`)
      .all(start, end) as (TimeEntry & { employee_nom: string; employee_prenom: string })[]
    return rows.map(withHours)
  },

  create(data: TimeEntryInput): TimeEntryWithEmployee {
    const stmt = getDb().prepare(`
      INSERT INTO time_entries (employee_id, date, arrivee, depart, pause_minutes, notes)
      VALUES (@employee_id, @date, @arrivee, @depart, @pause_minutes, @notes)
    `)
    const info = stmt.run({
      employee_id: data.employee_id,
      date: data.date,
      arrivee: data.arrivee,
      depart: data.depart ?? null,
      pause_minutes: data.pause_minutes ?? 0,
      notes: data.notes ?? null
    })
    return this.get(Number(info.lastInsertRowid))
  },

  update(id: number, data: TimeEntryInput): TimeEntryWithEmployee {
    getDb()
      .prepare(`
        UPDATE time_entries SET
          employee_id = @employee_id, date = @date, arrivee = @arrivee,
          depart = @depart, pause_minutes = @pause_minutes, notes = @notes
        WHERE id = @id
      `)
      .run({
        employee_id: data.employee_id,
        date: data.date,
        arrivee: data.arrivee,
        depart: data.depart ?? null,
        pause_minutes: data.pause_minutes ?? 0,
        notes: data.notes ?? null,
        id
      })
    return this.get(id)
  },

  get(id: number): TimeEntryWithEmployee {
    const row = getDb().prepare(`${TIME_SELECT} WHERE t.id = ?`).get(id) as TimeEntry & {
      employee_nom: string
      employee_prenom: string
    }
    return withHours(row)
  },

  remove(id: number): void {
    getDb().prepare('DELETE FROM time_entries WHERE id = ?').run(id)
  }
}

// ============================ ÉLÉMENTS DE PAIE ============================

/** SQLite stocke les booléens en 0/1 : on rétablit le type. */
function mapElement(row: Record<string, unknown>): ElementPaie {
  return {
    ...row,
    soumis_cnss: Boolean(row.soumis_cnss),
    soumis_iuts: Boolean(row.soumis_iuts)
  } as ElementPaie
}

export const elementsRepo = {
  listByEmployee(employeeId: number): ElementPaie[] {
    const rows = getDb()
      .prepare('SELECT * FROM pay_elements WHERE employee_id = ? ORDER BY sens DESC, id')
      .all(employeeId) as Record<string, unknown>[]
    return rows.map(mapElement)
  },

  /**
   * Éléments applicables à une période : ceux qui n'ont pas de période (donc
   * permanents, repris chaque mois) et ceux dont la période recoupe la paie.
   */
  listPourPeriode(employeeId: number, start: string, end: string): ElementPaie[] {
    const rows = getDb()
      .prepare(
        `SELECT * FROM pay_elements
         WHERE employee_id = ?
           AND (periode_debut IS NULL OR periode_debut <= ?)
           AND (periode_fin IS NULL OR periode_fin >= ?)
         ORDER BY sens DESC, id`
      )
      .all(employeeId, end, start) as Record<string, unknown>[]
    return rows.map(mapElement)
  },

  create(d: ElementPaieInput): ElementPaie {
    const info = getDb()
      .prepare(`
        INSERT INTO pay_elements
          (employee_id, libelle, sens, base, taux, montant, soumis_cnss, soumis_iuts,
           periode_debut, periode_fin, notes)
        VALUES
          (@employee_id, @libelle, @sens, @base, @taux, @montant, @soumis_cnss, @soumis_iuts,
           @periode_debut, @periode_fin, @notes)
      `)
      .run(normalizeElement(d))
    return mapElement(
      getDb().prepare('SELECT * FROM pay_elements WHERE id = ?').get(info.lastInsertRowid) as Record<
        string,
        unknown
      >
    )
  },

  update(id: number, d: ElementPaieInput): ElementPaie {
    getDb()
      .prepare(`
        UPDATE pay_elements SET
          libelle = @libelle, sens = @sens, base = @base, taux = @taux, montant = @montant,
          soumis_cnss = @soumis_cnss, soumis_iuts = @soumis_iuts,
          periode_debut = @periode_debut, periode_fin = @periode_fin, notes = @notes
        WHERE id = @id
      `)
      .run({ ...normalizeElement(d), id })
    return mapElement(
      getDb().prepare('SELECT * FROM pay_elements WHERE id = ?').get(id) as Record<string, unknown>
    )
  },

  remove(id: number): void {
    getDb().prepare('DELETE FROM pay_elements WHERE id = ?').run(id)
  }
}

function normalizeElement(d: ElementPaieInput): Record<string, unknown> {
  return {
    employee_id: d.employee_id,
    libelle: d.libelle,
    sens: d.sens ?? 'gain',
    base: d.base ?? null,
    taux: d.taux ?? null,
    montant: d.montant ?? 0,
    soumis_cnss: d.soumis_cnss ? 1 : 0,
    soumis_iuts: d.soumis_iuts ? 1 : 0,
    periode_debut: d.periode_debut ?? null,
    periode_fin: d.periode_fin ?? null,
    notes: d.notes ?? null
  }
}

// ============================ PAIE ============================

/** Lundi (YYYY-MM-DD) de la semaine ISO contenant `dateISO`. */
function mondayISO(dateISO: string): string {
  const d = new Date(dateISO + 'T00:00:00')
  const jour = (d.getDay() + 6) % 7
  return addDaysISO(dateISO, -jour)
}

/** Nombre de jours (inclus) de chevauchement entre deux périodes ISO. */
function overlapDays(aStart: string, aEnd: string, bStart: string, bEnd: string): number {
  const start = aStart > bStart ? aStart : bStart
  const end = aEnd < bEnd ? aEnd : bEnd
  if (start > end) return 0
  const d1 = new Date(start + 'T00:00:00').getTime()
  const d2 = new Date(end + 'T00:00:00').getTime()
  return Math.round((d2 - d1) / 86400000) + 1
}

/** Arrondi au franc CFA près (la devise n'a pas de sous-unité). */
const fcfa = (n: number): number => Math.round(n)

/**
 * Nombre de mois civils couverts par une période, bornes incluses.
 * Un trimestre (1er juillet → 30 septembre) en compte trois : c'est ce qui
 * multiplie le salaire mensualisé et le plafond de cotisation.
 */
/**
 * Le contrat du salarié recouvre-t-il, même partiellement, la période donnee ?
 *
 * Une embauche postérieure à la fin de période, ou un contrat terminé avant
 * son début, exclut le salarié. Une date d'embauche absente est traitée comme
 * « depuis toujours » : mieux vaut déclarer que d'omettre en silence.
 */
export function couvrePeriode(
  e: { date_embauche?: string | null; date_fin_contrat?: string | null },
  start: string,
  end: string
): boolean {
  if (e.date_embauche && e.date_embauche > end) return false
  if (e.date_fin_contrat && e.date_fin_contrat < start) return false
  return true
}

export function nbMoisPeriode(start: string, end: string): number {
  const d1 = new Date(start + 'T00:00:00')
  const d2 = new Date(end + 'T00:00:00')
  const n = (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth()) + 1
  return Math.max(1, n)
}

/** Pourcentage formaté pour l'affichage sur le bulletin (ex. 0.055 → « 5,50 % »). */
const pct = (t: number): string => (t * 100).toFixed(2).replace('.', ',') + ' %'

/**
 * Impôt Unique sur les Traitements et Salaires : barème progressif par tranches,
 * puis réduction selon le nombre de personnes à charge.
 */
export function calculerIUTS(baseImposable: number, personnesACharge: number, s: PayrollSettings): number {
  let impot = 0
  let borneBasse = 0
  for (const tranche of s.iuts_bareme) {
    const borneHaute = tranche.plafond ?? Infinity
    if (baseImposable <= borneBasse) break
    const montantDansLaTranche = Math.min(baseImposable, borneHaute) - borneBasse
    impot += montantDansLaTranche * tranche.taux
    borneBasse = borneHaute
  }
  // Réduction pour charges de famille, plafonnée au nombre de charges admises.
  const charges = Math.min(personnesACharge, s.iuts_charges_max, s.iuts_reduction_charge.length)
  if (charges > 0) {
    impot -= impot * s.iuts_reduction_charge[charges - 1]
  }
  return Math.max(0, impot)
}

export const payrollRepo = {
  compute(params: PayrollParams): PayrollRow[] {
    const db = getDb()
    const s = params.settings
    // Seuls les salariés dont le contrat COUVRE la période entrent dans le
    // calcul. Sans ce filtre, une paie du passé incluait tout le personnel
    // actuel : on aurait édité des bulletins de janvier 2025 à des gens
    // embauchés en 2026. On garde aussi ceux qui sont partis depuis, sinon
    // rejouer un trimestre ancien les ferait disparaître de la déclaration où
    // ils figurent pourtant.
    const employes = employeesRepo
      .list(true)
      .filter((e) => couvrePeriode(e, params.start, params.end))
    // Une période de plusieurs mois cumule autant de mois de salaire, et le
    // plafond de cotisation suit la même règle.
    const mois = nbMoisPeriode(params.start, params.end)

    return employes.map((e): PayrollRow => {
      const mensuel = e.salaire_mensuel ?? 0
      const heuresHebdo = e.heures_hebdo && e.heures_hebdo > 0 ? e.heures_hebdo : s.seuil_heures_sup
      const heuresMensuelles = heuresHebdo * (52 / 12)
      // Taux horaire : explicite si renseigné, sinon déduit du salaire mensuel.
      const taux = e.salaire_horaire ?? (mensuel > 0 ? mensuel / heuresMensuelles : 0)
      const seuil = Math.min(heuresHebdo, s.seuil_heures_sup)

      // --- Heures travaillées, regroupées par semaine pour isoler les heures sup ---
      const entries = db
        .prepare(
          `SELECT date, arrivee, depart, pause_minutes FROM time_entries
           WHERE employee_id = ? AND date BETWEEN ? AND ?`
        )
        .all(e.id, params.start, params.end) as {
        date: string
        arrivee: string
        depart: string | null
        pause_minutes: number
      }[]

      const parSemaine = new Map<string, number>()
      for (const t of entries) {
        const h = computeHours(t.arrivee, t.depart, t.pause_minutes)
        parSemaine.set(mondayISO(t.date), (parSemaine.get(mondayISO(t.date)) ?? 0) + h)
      }

      let heuresNormales = 0
      let heuresSup = 0
      for (const h of parSemaine.values()) {
        const sup = Math.max(0, h - seuil)
        heuresSup += sup
        heuresNormales += h - sup
      }

      // --- Jours d'absence : registre de pointage prioritaire, sinon demandes de congés ---
      const codesDeduits = TYPES_PRESENCE.filter((t) => t.deduit).map((t) => t.code)
      const registre = db
        .prepare(
          `SELECT code, COUNT(*) AS n FROM presences
           WHERE employee_id = ? AND date BETWEEN ? AND ? GROUP BY code`
        )
        .all(e.id, params.start, params.end) as { code: string; n: number }[]

      let joursAbsence = 0
      let joursTravailles = 0
      if (registre.length > 0) {
        for (const ligne of registre) {
          if (codesDeduits.includes(ligne.code as never)) joursAbsence += ligne.n
          if (TYPES_PRESENCE.find((t) => t.code === ligne.code)?.travaille) joursTravailles += ligne.n
        }
      } else {
        const absences = db
          .prepare(
            `SELECT type, date_debut, date_fin FROM leaves
             WHERE employee_id = ? AND statut = 'Approuvé'
               AND date_debut <= ? AND date_fin >= ?`
          )
          .all(e.id, params.end, params.start) as { type: string; date_debut: string; date_fin: string }[]
        for (const a of absences) {
          if (!TYPES_DEDUITS.includes(a.type as never)) continue
          joursAbsence += overlapDays(a.date_debut, a.date_fin, params.start, params.end)
        }
      }

      // --- Gains ---
      // Le mensualisé perçoit son salaire autant de fois qu'il y a de mois ;
      // l'horaire est déjà cumulé par les pointages de la période.
      const salaireBase = mensuel > 0 ? mensuel * mois : heuresNormales * taux
      const primeSup = heuresSup * taux * (1 + s.majoration_sup)
      // Retenue par jour d'absence : 1/30 du mois pour un mensualisé, sinon taux × heures/jour.
      const retenueJour = mensuel > 0 ? mensuel / 30 : taux * (heuresHebdo / 5)
      const retenueAbsences = joursAbsence * retenueJour

      // Éléments saisis à la main (primes, indemnités, retenues diverses).
      const elements = elementsRepo.listPourPeriode(e.id, params.start, params.end)
      const gainsElements = elements.filter((el) => el.sens === 'gain')
      const retenuesElements = elements.filter((el) => el.sens === 'retenue')

      // Une prime peut être exonérée : seule la part soumise entre dans l'assiette.
      const sommeSoumise = (liste: ElementPaie[], champ: 'soumis_cnss' | 'soumis_iuts'): number =>
        liste.filter((el) => el[champ]).reduce((t, el) => t + el.montant, 0)

      const totalGainsElements = gainsElements.reduce((t, el) => t + el.montant, 0)
      const totalRetenuesElements = retenuesElements.reduce((t, el) => t + el.montant, 0)

      const gains: LignePaie[] = [
        {
          libelle:
            mensuel > 0
              ? `Salaire de base${mois > 1 ? ` — ${mois} mois` : ' mensuel'}`
              : 'Heures normales',
          base:
            mensuel > 0
              ? `${fcfa(mensuel).toLocaleString('fr-FR')}${mois > 1 ? ` × ${mois}` : ''}`
              : `${heuresNormales.toFixed(2)} h`,
          taux: mensuel > 0 ? '—' : fcfa(taux).toLocaleString('fr-FR'),
          montant: fcfa(salaireBase)
        }
      ]
      if (heuresSup > 0) {
        gains.push({
          libelle: `Heures supplémentaires (majorées ${pct(s.majoration_sup)})`,
          base: `${heuresSup.toFixed(2)} h`,
          taux: fcfa(taux * (1 + s.majoration_sup)).toLocaleString('fr-FR'),
          montant: fcfa(primeSup)
        })
      }
      if (retenueAbsences > 0) {
        gains.push({
          libelle: 'Retenue pour absences',
          base: `${joursAbsence} jour(s)`,
          taux: fcfa(retenueJour).toLocaleString('fr-FR'),
          montant: -fcfa(retenueAbsences)
        })
      }
      for (const el of gainsElements) {
        gains.push({
          libelle: el.libelle + (el.soumis_cnss ? '' : ' (non soumis)'),
          base: el.base != null ? el.base.toLocaleString('fr-FR') : '—',
          taux: el.taux != null ? fcfa(el.taux).toLocaleString('fr-FR') : '—',
          montant: fcfa(el.montant)
        })
      }

      const brutImposable = Math.max(
        0,
        fcfa(salaireBase + primeSup - retenueAbsences + totalGainsElements)
      )

      // Assiettes : le salaire de base y entre toujours, les éléments seulement
      // si l'utilisateur les a déclarés soumis.
      const brutHorsElements = Math.max(0, fcfa(salaireBase + primeSup - retenueAbsences))
      const assietteCnss = brutHorsElements + sommeSoumise(gainsElements, 'soumis_cnss')
      const assietteIuts = brutHorsElements + sommeSoumise(gainsElements, 'soumis_iuts')

      // --- Retenues salariales ---
      // La cotisation CNSS n'est due que si la catégorie du travailleur cotise
      // à la branche pension (un élève/étudiant, par exemple, n'y cotise pas).
      // Idem côté paie : une catégorie invalide retombe sur « Permanent ».
      const infoCategorie =
        CATEGORIES_CNSS.find((c) => c.code === e.categorie_cnss) ?? CATEGORIES_CNSS[0]
      const plafondPeriode = s.cnss_plafond * mois
      const baseCotisable = Math.min(assietteCnss, plafondPeriode)
      const cnssSalarie = infoCategorie.pensions ? fcfa(baseCotisable * s.cnss_salarie) : 0

      // Base IUTS = brut imposable − retenue pension salariale − abattement
      // forfaitaire pour frais professionnels (art. 111 du CGI).
      //
      // Le barème est MENSUEL : sur une période de plusieurs mois, on l'applique
      // au revenu d'un seul mois puis on multiplie. Taxer le cumul ferait
      // basculer le salarié dans des tranches supérieures et le surtaxerait.
      const tauxAbattement = e.cadre ? s.iuts_abattement_cadre : s.iuts_abattement
      const baseIuts = fcfa(
        Math.max(0, ((assietteIuts - cnssSalarie) / mois) * (1 - tauxAbattement))
      )
      const iuts = fcfa(calculerIUTS(baseIuts, e.personnes_a_charge ?? 0, s) * mois)

      const retenues: LignePaie[] = [
        {
          libelle: `Retenue CNSS${brutImposable > plafondPeriode ? ' (base plafonnée)' : ''}`,
          base: fcfa(baseCotisable).toLocaleString('fr-FR'),
          taux: pct(s.cnss_salarie),
          montant: cnssSalarie
        },
        {
          libelle: `IUTS${mois > 1 ? ` (barème mensuel × ${mois})` : ''}`,
          base: `${baseIuts.toLocaleString('fr-FR')}${mois > 1 ? ' /mois' : ''}`,
          taux: 'barème',
          montant: iuts
        }
      ]

      for (const el of retenuesElements) {
        retenues.push({
          libelle: el.libelle,
          base: el.base != null ? el.base.toLocaleString('fr-FR') : '—',
          taux: el.taux != null ? fcfa(el.taux).toLocaleString('fr-FR') : '—',
          montant: fcfa(el.montant)
        })
      }

      const totalRetenues = cnssSalarie + iuts + fcfa(totalRetenuesElements)
      const netAPayer = Math.max(0, brutImposable - totalRetenues)

      // --- Charges patronales, selon les branches auxquelles la catégorie cotise ---
      const tauxEmployeur =
        (infoCategorie.pensions ? s.cnss_employeur_pension : 0) +
        (infoCategorie.prestations_familiales ? s.cnss_employeur_familiales : 0) +
        (infoCategorie.risques_professionnels ? s.cnss_employeur_risques : 0)
      const cnssEmployeur = fcfa(baseCotisable * tauxEmployeur)
      const tpa = fcfa(brutImposable * s.taxe_patronale)

      return {
        employee_id: e.id,
        matricule: e.matricule ?? String(e.id).padStart(4, '0'),
        numero_cnss: e.numero_cnss ?? '',
        categorie_cnss: infoCategorie.code,
        cadre: Boolean(e.cadre),
        nom: e.nom,
        prenom: e.prenom,
        poste: e.poste,
        telephone: e.telephone,
        adresse: e.adresse,
        type_contrat: e.type_contrat,
        date_embauche: e.date_embauche,
        personnes_a_charge: e.personnes_a_charge ?? 0,
        taux_abattement: tauxAbattement,
        mois_couverts: mois,
        elements,

        taux_horaire: fcfa(taux),
        salaire_mensuel: fcfa(mensuel),
        heures_normales: Math.round(heuresNormales * 100) / 100,
        heures_sup: Math.round(heuresSup * 100) / 100,
        heures_total: Math.round((heuresNormales + heuresSup) * 100) / 100,
        jours_absence: joursAbsence,
        jours_travailles: joursTravailles,

        gains,
        retenues,

        salaire_base: fcfa(salaireBase),
        prime_heures_sup: fcfa(primeSup),
        retenue_absences: fcfa(retenueAbsences),
        brut_imposable: brutImposable,
        base_cotisable: fcfa(baseCotisable),
        cnss_salarie: cnssSalarie,
        base_iuts: baseIuts,
        iuts,
        total_retenues: totalRetenues,
        net_a_payer: netAPayer,

        cnss_employeur: cnssEmployeur,
        taxe_patronale: tpa,
        cout_employeur: brutImposable + cnssEmployeur + tpa
      }
    })
  }
}

// ============================ PIÈCES JOINTES ============================

export const employeeDocsRepo = {
  listByEmployee(employeeId: number): EmployeeDocument[] {
    return getDb()
      .prepare('SELECT * FROM employee_documents WHERE employee_id = ? ORDER BY created_at DESC')
      .all(employeeId) as EmployeeDocument[]
  },

  get(id: number): EmployeeDocument | undefined {
    return getDb().prepare('SELECT * FROM employee_documents WHERE id = ?').get(id) as
      | EmployeeDocument
      | undefined
  },

  create(d: Omit<EmployeeDocument, 'id' | 'created_at'>): EmployeeDocument {
    const info = getDb()
      .prepare(`
        INSERT INTO employee_documents (employee_id, type, nom, fichier, taille, notes)
        VALUES (@employee_id, @type, @nom, @fichier, @taille, @notes)
      `)
      .run({
        employee_id: d.employee_id,
        type: d.type,
        nom: d.nom,
        fichier: d.fichier,
        taille: d.taille ?? 0,
        notes: d.notes ?? null
      })
    return this.get(Number(info.lastInsertRowid))!
  },

  remove(id: number): void {
    getDb().prepare('DELETE FROM employee_documents WHERE id = ?').run(id)
  }
}

// ============================ CONTRATS ============================

const CONTRACT_SELECT = `
  SELECT c.*, e.nom AS employee_nom, e.prenom AS employee_prenom, e.matricule AS employee_matricule
  FROM contracts c
  JOIN employees e ON e.id = c.employee_id
`

/** Les articles sont stockés en JSON : on les rétablit sous forme de tableau. */
function mapContract<T extends { articles?: unknown }>(row: T): T {
  let articles: ArticleContrat[] = ARTICLES_DEFAUT
  if (typeof row.articles === 'string' && row.articles.trim()) {
    try {
      const parse = JSON.parse(row.articles)
      if (Array.isArray(parse)) articles = parse as ArticleContrat[]
    } catch {
      // Contenu illisible : on retombe sur la trame par défaut plutôt que d'échouer.
    }
  }
  return { ...row, articles }
}

export const contractsRepo = {
  list(): ContractWithEmployee[] {
    const rows = getDb()
      .prepare(`${CONTRACT_SELECT} ORDER BY c.date_debut DESC, c.id DESC`)
      .all() as ContractWithEmployee[]
    return rows.map(mapContract)
  },

  listByEmployee(employeeId: number): Contract[] {
    const rows = getDb()
      .prepare('SELECT * FROM contracts WHERE employee_id = ? ORDER BY date_debut DESC, id DESC')
      .all(employeeId) as Contract[]
    return rows.map(mapContract)
  },

  get(id: number): Contract | undefined {
    const row = getDb().prepare('SELECT * FROM contracts WHERE id = ?').get(id) as
      | Contract
      | undefined
    return row ? mapContract(row) : undefined
  },

  /** Génère une référence lisible du type « CDD-2026-0007 ». */
  nextReference(type: string, annee: string): string {
    const n = (
      getDb()
        .prepare(`SELECT COUNT(*) AS n FROM contracts WHERE reference LIKE ?`)
        .get(`${type}-${annee}-%`) as { n: number }
    ).n
    return `${type}-${annee}-${String(n + 1).padStart(4, '0')}`
  },

  create(data: ContractInput): Contract {
    const db = getDb()
    const info = db
      .prepare(`
        INSERT INTO contracts
          (employee_id, reference, type_contrat, poste, date_debut, date_fin, duree_mois,
           mode_salaire, salaire_montant, heures_hebdo, jours_repos, periode_essai, clauses, articles,
           lieu_signature, statut, date_signature, parent_id, motif_rupture)
        VALUES
          (@employee_id, @reference, @type_contrat, @poste, @date_debut, @date_fin, @duree_mois,
           @mode_salaire, @salaire_montant, @heures_hebdo, @jours_repos, @periode_essai, @clauses, @articles,
           @lieu_signature, @statut, @date_signature, @parent_id, @motif_rupture)
      `)
      .run(normalizeContract(data))
    const cree = this.get(Number(info.lastInsertRowid))!
    if (cree.statut === 'Signé') this.appliquerAuSalarie(cree)
    return cree
  },

  update(id: number, data: ContractInput): Contract {
    getDb()
      .prepare(`
        UPDATE contracts SET
          employee_id = @employee_id, reference = @reference, type_contrat = @type_contrat,
          poste = @poste, date_debut = @date_debut, date_fin = @date_fin, duree_mois = @duree_mois,
          mode_salaire = @mode_salaire, salaire_montant = @salaire_montant,
          heures_hebdo = @heures_hebdo, jours_repos = @jours_repos,
          periode_essai = @periode_essai, clauses = @clauses, articles = @articles,
          lieu_signature = @lieu_signature,
          statut = @statut, date_signature = @date_signature, parent_id = @parent_id,
          motif_rupture = @motif_rupture
        WHERE id = @id
      `)
      .run({ ...normalizeContract(data), id })
    const maj = this.get(id)!
    if (maj.statut === 'Signé') this.appliquerAuSalarie(maj)
    return maj
  },

  /**
   * Supprime un contrat ET défait ce qu'il avait inscrit sur la fiche.
   *
   * Un contrat signé recopie ses conditions sur le salarié — c'est la fiche
   * que lit la paie, pas le contrat. Un simple DELETE laissait donc l'empreinte
   * d'un document disparu : le salarié continuait d'être payé et déclaré aux
   * conditions d'un contrat qui n'existait plus, sans que rien ne l'indique.
   *
   * On ne défait que ce que CE contrat avait écrit : si la valeur sur la fiche
   * ne correspond plus, c'est qu'elle a été modifiée à la main depuis, et l'on
   * n'y touche pas. Et si un autre contrat signé subsiste, c'est lui qui reprend
   * la main.
   */
  remove(id: number): SuppressionContrat {
    const db = getDb()
    const c = this.get(id)
    if (!c) return { fiche: 'inchangee', message: 'Contrat introuvable.' }

    db.prepare('DELETE FROM contracts WHERE id = ?').run(id)

    const suivant = db
      .prepare(
        `SELECT * FROM contracts
          WHERE employee_id = ? AND statut = 'Signé'
          ORDER BY date_debut DESC, id DESC LIMIT 1`
      )
      .get(c.employee_id) as Record<string, unknown> | undefined

    if (suivant) {
      this.appliquerAuSalarie(mapContract(suivant) as unknown as Contract)
      return {
        fiche: 'reprise',
        message: `Les conditions du contrat ${String(suivant.reference)} s’appliquent désormais.`
      }
    }

    if (c.statut !== 'Signé') {
      return {
        fiche: 'inchangee',
        message: 'Ce contrat n’était pas signé : la fiche du salarié n’en portait rien.'
      }
    }

    const e = employeesRepo.get(c.employee_id)
    if (!e) return { fiche: 'inchangee', message: '' }

    const efface: string[] = []
    const maj: Record<string, unknown> = {}
    const defaire = (champ: string, valeurFiche: unknown, valeurContrat: unknown, lib: string): void => {
      if (valeurFiche !== null && valeurFiche !== undefined && valeurFiche === valeurContrat) {
        maj[champ] = null
        efface.push(lib)
      }
    }
    defaire('date_fin_contrat', e.date_fin_contrat, c.date_fin, 'terme du contrat')
    defaire(
      'salaire_mensuel',
      e.salaire_mensuel,
      c.mode_salaire === 'mensuel' ? c.salaire_montant : null,
      'salaire mensuel'
    )
    defaire(
      'salaire_horaire',
      e.salaire_horaire,
      c.mode_salaire === 'horaire' ? c.salaire_montant : null,
      'taux horaire'
    )

    if (Object.keys(maj).length === 0) {
      return {
        fiche: 'inchangee',
        message:
          'La fiche a été modifiée depuis la signature : ses valeurs actuelles sont conservées.'
      }
    }

    const sets = Object.keys(maj)
      .map((k) => `${k} = NULL`)
      .join(', ')
    db.prepare(`UPDATE employees SET ${sets}, updated_at = datetime('now') WHERE id = ?`).run(
      c.employee_id
    )

    // La conséquence est LUE sur la fiche telle qu'elle est maintenant, jamais
    // supposée : effacer le terme d'un contrat ne retire pas un salaire saisi
    // à la main, et annoncer le contraire tromperait sur l'effet obtenu.
    const apres = employeesRepo.get(c.employee_id)
    const sansRemuneration = !apres?.salaire_mensuel && !apres?.salaire_horaire
    return {
      fiche: 'effacee',
      message:
        `Retiré de la fiche du salarié : ${efface.join(', ')}. ` +
        (sansRemuneration
          ? 'Sa fiche ne porte plus aucune rémunération : il figurera à zéro dans la paie tant qu’elle n’est pas complétée, ou passez-le en « sorti » pour qu’il en disparaisse.'
          : 'Sa rémunération, saisie sur la fiche, est conservée : il reste compté dans la paie.')
    }
  },

  /**
   * Reporte les conditions d'un contrat signé sur la fiche du salarié, pour que
   * la paie et les déclarations travaillent sur les mêmes valeurs que le contrat.
   */
  appliquerAuSalarie(c: Contract): void {
    getDb()
      .prepare(`
        UPDATE employees SET
          poste = @poste, type_contrat = @type_contrat, date_embauche = @date_debut,
          date_fin_contrat = @date_fin, heures_hebdo = @heures_hebdo,
          salaire_mensuel = @salaire_mensuel, salaire_horaire = @salaire_horaire,
          updated_at = datetime('now')
        WHERE id = @employee_id
      `)
      .run({
        poste: c.poste,
        type_contrat: c.type_contrat,
        date_debut: c.date_debut,
        date_fin: c.date_fin,
        heures_hebdo: c.heures_hebdo,
        salaire_mensuel: c.mode_salaire === 'mensuel' ? c.salaire_montant : null,
        salaire_horaire: c.mode_salaire === 'horaire' ? c.salaire_montant : null,
        employee_id: c.employee_id
      })
  },

  /** Marque « Terminé » les contrats signés dont le terme est dépassé. */
  cloturerEchus(): number {
    const today = new Date().toISOString().slice(0, 10)
    return getDb()
      .prepare(
        `UPDATE contracts SET statut = 'Terminé'
         WHERE statut = 'Signé' AND date_fin IS NOT NULL AND date_fin < ?`
      )
      .run(today).changes
  }
}

function normalizeContract(d: ContractInput): Record<string, unknown> {
  return {
    employee_id: d.employee_id,
    reference: d.reference,
    type_contrat: d.type_contrat,
    poste: d.poste ?? '',
    date_debut: d.date_debut,
    date_fin: d.date_fin ?? null,
    duree_mois: d.duree_mois ?? null,
    mode_salaire: d.mode_salaire ?? 'mensuel',
    salaire_montant: d.salaire_montant ?? 0,
    heures_hebdo: d.heures_hebdo ?? 40,
    jours_repos: d.jours_repos ?? 1,
    periode_essai: d.periode_essai ?? null,
    clauses: d.clauses ?? null,
    articles: JSON.stringify(d.articles ?? ARTICLES_DEFAUT),
    lieu_signature: d.lieu_signature ?? null,
    statut: d.statut ?? 'Brouillon',
    date_signature: d.date_signature ?? null,
    parent_id: d.parent_id ?? null,
    motif_rupture: d.motif_rupture ?? null
  }
}

// ============================ DÉCLARATIONS CNSS (BNTS / DRS) ============================

const CODES_CATEGORIES: CategorieCnss[] = ['P', 'T', 'J', 'F', 'S', 'E', 'N']

function effectifsVides(): Record<CategorieCnss, number> {
  return { P: 0, T: 0, J: 0, F: 0, S: 0, E: 0, N: 0 }
}

export const declarationsRepo = {
  /**
   * Construit la déclaration d'une période à partir de la paie calculée :
   * le bordereau nominatif (BNTS) et le décompte des cotisations (DRS)
   * proviennent des mêmes lignes, ils ne peuvent donc pas diverger.
   */
  build(params: PayrollParams): DeclarationDto {
    const s = params.settings
    const paie = payrollRepo.compute(params)

    const moisCouverts = nbMoisPeriode(params.start, params.end)
    const plafondPeriode = s.cnss_plafond * moisCouverts

    const lignes: LigneBntsDto[] = paie.map((r, i) => {
      const employe = employeesRepo.get(r.employee_id)
      // Colonnes 5 et 6 : la période propre au travailleur peut être plus courte
      // que celle de la déclaration (embauche ou départ en cours de période).
      const debut =
        employe?.date_embauche && employe.date_embauche > params.start
          ? employe.date_embauche
          : params.start
      const fin =
        employe?.date_fin_contrat && employe.date_fin_contrat < params.end
          ? employe.date_fin_contrat
          : params.end
      return {
        numero: i + 1,
        matricule: r.matricule,
        numero_cnss: r.numero_cnss,
        nom: r.nom,
        prenom: r.prenom,
        periode_debut: debut,
        periode_fin: fin,
        salaire_brut: r.brut_imposable,
        base_cnss: Math.min(r.brut_imposable, plafondPeriode),
        categorie: r.categorie_cnss,
        nature: 'S'
      }
    })

    // Bases et effectifs par branche : une catégorie ne compte que dans les
    // branches auxquelles elle cotise effectivement.
    const branchesDef = [
      { nom: 'Prestations familiales', taux: s.cnss_employeur_familiales, champ: 'prestations_familiales' as const },
      { nom: 'Risques professionnels', taux: s.cnss_employeur_risques, champ: 'risques_professionnels' as const },
      { nom: 'Pensions', taux: s.cnss_salarie + s.cnss_employeur_pension, champ: 'pensions' as const }
    ]

    const branches: BrancheDrs[] = branchesDef.map((b) => {
      const effectifs = effectifsVides()
      let base = 0
      for (const l of lignes) {
        // Une catégorie inconnue est traitée comme « Permanent » plutôt qu'ignorée :
        // une donnée douteuse ne doit jamais faire disparaître silencieusement des
        // cotisations du décompte.
        const info =
          CATEGORIES_CNSS.find((c) => c.code === l.categorie) ?? CATEGORIES_CNSS[0]
        if (!info[b.champ]) continue
        base += l.base_cnss
        effectifs[info.code]++
      }
      return { nom: b.nom, base, taux: b.taux, cotisation: fcfa(base * b.taux), effectifs }
    })

    const effectif = lignes.length
    const mensuelle = effectif >= s.seuil_effectif_mensuel

    return {
      periode_debut: params.start,
      periode_fin: params.end,
      mois_couverts: moisCouverts,
      mensuelle,
      // Le 15 du mois suivant en déclaration mensuelle, 30 jours après la
      // période sinon (déclaration trimestrielle).
      date_limite: mensuelle
        ? `${addDaysISO(params.end, 1).slice(0, 7)}-15`
        : addDaysISO(params.end, 30),
      effectif,
      lignes,
      total_salaires_bruts: lignes.reduce((t, l) => t + l.salaire_brut, 0),
      total_base_cnss: lignes.reduce((t, l) => t + l.base_cnss, 0),
      branches,
      total_cotisations: branches.reduce((t, b) => t + b.cotisation, 0)
    }
  }
}

// ============================ REGISTRE DES BULLETINS ============================

const PAYSLIP_SELECT = `
  SELECT p.*, e.nom AS employee_nom, e.prenom AS employee_prenom, e.matricule AS employee_matricule
  FROM payslips p
  JOIN employees e ON e.id = p.employee_id
`

/** Les instantanés sont stockés en JSON : on les redonne sous forme d'objets. */
function mapPayslip<T extends { donnees: unknown; parametres: unknown }>(row: T): T {
  return {
    ...row,
    donnees: typeof row.donnees === 'string' ? JSON.parse(row.donnees) : row.donnees,
    parametres: typeof row.parametres === 'string' ? JSON.parse(row.parametres) : row.parametres
  }
}

export const payslipsRepo = {
  list(limite = 500): PayslipWithEmployee[] {
    const rows = getDb()
      .prepare(`${PAYSLIP_SELECT} ORDER BY p.periode_debut DESC, e.nom LIMIT ?`)
      .all(limite) as PayslipWithEmployee[]
    return rows.map(mapPayslip)
  },

  listByPeriode(start: string, end: string): PayslipWithEmployee[] {
    const rows = getDb()
      .prepare(`${PAYSLIP_SELECT} WHERE p.periode_debut = ? AND p.periode_fin = ? ORDER BY e.nom`)
      .all(start, end) as PayslipWithEmployee[]
    return rows.map(mapPayslip)
  },

  listByEmployee(employeeId: number): PayslipWithEmployee[] {
    const rows = getDb()
      .prepare(`${PAYSLIP_SELECT} WHERE p.employee_id = ? ORDER BY p.periode_debut DESC`)
      .all(employeeId) as PayslipWithEmployee[]
    return rows.map(mapPayslip)
  },

  /**
   * Clôture une période : calcule la paie et archive un bulletin par salarié.
   * Un bulletin déjà émis pour la même période n'est pas réécrit — il faut
   * l'annuler explicitement pour le refaire.
   */
  cloturer(params: PayrollParams): { emis: number; existants: number } {
    const db = getDb()
    const lignes = payrollRepo.compute(params)
    const mois = params.start.slice(0, 7).replace('-', '-')

    // Numérotation continue par mois : BP-2026-08-0001, 0002…
    const dejaEmis = (
      db.prepare(`SELECT COUNT(*) AS n FROM payslips WHERE reference LIKE ?`).get(`BP-${mois}-%`) as {
        n: number
      }
    ).n

    const insert = db.prepare(`
      INSERT INTO payslips
        (reference, employee_id, periode_debut, periode_fin, brut, total_retenues,
         net_a_payer, cout_employeur, donnees, parametres, statut)
      VALUES
        (@reference, @employee_id, @periode_debut, @periode_fin, @brut, @total_retenues,
         @net_a_payer, @cout_employeur, @donnees, @parametres, 'Émis')
      ON CONFLICT(employee_id, periode_debut, periode_fin) DO NOTHING
    `)

    const run = db.transaction(() => {
      let emis = 0
      let rang = dejaEmis
      for (const r of lignes) {
        rang++
        const res = insert.run({
          reference: `BP-${mois}-${String(rang).padStart(4, '0')}`,
          employee_id: r.employee_id,
          periode_debut: params.start,
          periode_fin: params.end,
          brut: r.brut_imposable,
          total_retenues: r.total_retenues,
          net_a_payer: r.net_a_payer,
          cout_employeur: r.cout_employeur,
          donnees: JSON.stringify(r),
          parametres: JSON.stringify(params.settings)
        })
        if (res.changes > 0) emis++
        else rang-- // conflit : la référence n'a pas été consommée
      }
      return { emis, existants: lignes.length - emis }
    })
    return run()
  },

  setStatut(id: number, statut: string, datePaiement: string | null): void {
    getDb()
      .prepare('UPDATE payslips SET statut = ?, date_paiement = ? WHERE id = ?')
      .run(statut, datePaiement, id)
  },

  remove(id: number): void {
    getDb().prepare('DELETE FROM payslips WHERE id = ?').run(id)
  },

  /**
   * Confronte les bulletins archivés d'une période au calcul qu'on obtiendrait
   * aujourd'hui. Sert à savoir, avant d'écraser, ce qui a réellement bougé :
   * un salarié ajouté, retiré, ou dont la rémunération a changé.
   */
  comparer(params: PayrollParams): BilanPeriode {
    const archives = this.listByPeriode(params.start, params.end)
    const actuels = payrollRepo.compute(params)

    const parArchive = new Map(archives.map((a) => [a.employee_id, a]))
    const parActuel = new Map(actuels.map((r) => [r.employee_id, r]))
    const comparaisons: ComparaisonBulletin[] = []

    // Champs suivis : ceux qui changent le montant remis au salarié.
    const champs: { cle: keyof PayrollRow; libelle: string }[] = [
      { cle: 'brut_imposable', libelle: 'Salaire brut' },
      { cle: 'heures_normales', libelle: 'Heures normales' },
      { cle: 'heures_sup', libelle: 'Heures supplémentaires' },
      { cle: 'jours_absence', libelle: "Jours d'absence" },
      { cle: 'cnss_salarie', libelle: 'CNSS salarié' },
      { cle: 'iuts', libelle: 'IUTS' },
      { cle: 'net_a_payer', libelle: 'Net à payer' },
      { cle: 'cout_employeur', libelle: 'Coût employeur' }
    ]

    for (const a of archives) {
      const actuel = parActuel.get(a.employee_id)
      if (!actuel) {
        comparaisons.push({
          employee_id: a.employee_id,
          reference: a.reference,
          nom: a.employee_nom,
          prenom: a.employee_prenom,
          etat: 'retire',
          ecarts: []
        })
        continue
      }
      const ecarts: EcartChamp[] = []
      for (const c of champs) {
        const avant = Number(a.donnees[c.cle] ?? 0)
        const apres = Number(actuel[c.cle] ?? 0)
        // Tolérance d'un franc : les arrondis ne sont pas des écarts.
        if (Math.abs(avant - apres) > 1) ecarts.push({ libelle: c.libelle, avant, apres })
      }
      comparaisons.push({
        employee_id: a.employee_id,
        reference: a.reference,
        nom: a.employee_nom,
        prenom: a.employee_prenom,
        etat: ecarts.length > 0 ? 'modifie' : 'identique',
        ecarts
      })
    }

    for (const r of actuels) {
      if (parArchive.has(r.employee_id)) continue
      comparaisons.push({
        employee_id: r.employee_id,
        reference: null,
        nom: r.nom,
        prenom: r.prenom,
        etat: 'nouveau',
        ecarts: []
      })
    }

    const compte = (e: EtatComparaison): number =>
      comparaisons.filter((c) => c.etat === e).length

    return {
      existe: archives.length > 0,
      nb_archives: archives.length,
      nb_identiques: compte('identique'),
      nb_modifies: compte('modifie'),
      nb_nouveaux: compte('nouveau'),
      nb_retires: compte('retire'),
      comparaisons
    }
  },

  /**
   * Remplace les bulletins d'une période : les anciens sont supprimés puis
   * réémis avec les valeurs du jour. Opération volontaire et irréversible.
   */
  remplacer(params: PayrollParams): { emis: number; existants: number } {
    const db = getDb()
    const run = db.transaction(() => {
      db.prepare('DELETE FROM payslips WHERE periode_debut = ? AND periode_fin = ?').run(
        params.start,
        params.end
      )
      return this.cloturer(params)
    })
    return run()
  }
}

// ============================ REGISTRE DES DÉCLARATIONS ============================

function mapDeclaration<T extends { donnees: unknown; mensuelle: unknown }>(row: T): T {
  return {
    ...row,
    donnees: typeof row.donnees === 'string' ? JSON.parse(row.donnees) : row.donnees,
    mensuelle: Boolean(row.mensuelle)
  }
}

export const declarationsArchiveRepo = {
  list(): DeclarationRecord[] {
    const rows = getDb()
      .prepare('SELECT * FROM declarations ORDER BY periode_debut DESC')
      .all() as DeclarationRecord[]
    return rows.map(mapDeclaration)
  },

  get(id: number): DeclarationRecord | undefined {
    const row = getDb().prepare('SELECT * FROM declarations WHERE id = ?').get(id) as
      | DeclarationRecord
      | undefined
    return row ? mapDeclaration(row) : undefined
  },

  /** Archive une déclaration calculée. Réenregistrer la même période l'écrase. */
  enregistrer(d: DeclarationDto): DeclarationRecord {
    const db = getDb()
    const annee = d.periode_debut.slice(0, 4)
    const trimestre = Math.floor(Number(d.periode_debut.slice(5, 7)) / 3.01) + 1
    const suffixe = d.mensuelle ? d.periode_debut.slice(5, 7) : `T${trimestre}`

    const existante = db
      .prepare('SELECT reference FROM declarations WHERE periode_debut = ? AND periode_fin = ?')
      .get(d.periode_debut, d.periode_fin) as { reference: string } | undefined

    const n = (
      db.prepare(`SELECT COUNT(*) AS n FROM declarations WHERE reference LIKE ?`).get(
        `DRS-${annee}-%`
      ) as { n: number }
    ).n
    const reference = existante?.reference ?? `DRS-${annee}-${suffixe}-${String(n + 1).padStart(3, '0')}`

    db.prepare(`
      INSERT INTO declarations
        (reference, periode_debut, periode_fin, mensuelle, date_limite, effectif,
         total_salaires_bruts, total_base_cnss, total_cotisations, donnees, statut)
      VALUES
        (@reference, @periode_debut, @periode_fin, @mensuelle, @date_limite, @effectif,
         @total_salaires_bruts, @total_base_cnss, @total_cotisations, @donnees, 'Brouillon')
      ON CONFLICT(periode_debut, periode_fin) DO UPDATE SET
        effectif = excluded.effectif,
        total_salaires_bruts = excluded.total_salaires_bruts,
        total_base_cnss = excluded.total_base_cnss,
        total_cotisations = excluded.total_cotisations,
        donnees = excluded.donnees,
        date_limite = excluded.date_limite,
        mensuelle = excluded.mensuelle
    `).run({
      reference,
      periode_debut: d.periode_debut,
      periode_fin: d.periode_fin,
      mensuelle: d.mensuelle ? 1 : 0,
      date_limite: d.date_limite,
      effectif: d.effectif,
      total_salaires_bruts: d.total_salaires_bruts,
      total_base_cnss: d.total_base_cnss,
      total_cotisations: d.total_cotisations,
      donnees: JSON.stringify(d)
    })

    return db
      .prepare('SELECT * FROM declarations WHERE periode_debut = ? AND periode_fin = ?')
      .get(d.periode_debut, d.periode_fin) as DeclarationRecord
  },

  setStatut(id: number, statut: string, dateDepot: string | null): void {
    getDb()
      .prepare('UPDATE declarations SET statut = ?, date_depot = ? WHERE id = ?')
      .run(statut, dateDepot, id)
  },

  remove(id: number): void {
    getDb().prepare('DELETE FROM declarations WHERE id = ?').run(id)
  }
}

// ============================ REGISTRE DE POINTAGE ============================

export const presencesRepo = {
  listByRange(start: string, end: string): Presence[] {
    return getDb()
      .prepare('SELECT * FROM presences WHERE date BETWEEN ? AND ? ORDER BY date')
      .all(start, end) as Presence[]
  },

  /** Enregistre (ou remplace) le code de présence d'un employé pour une journée. */
  set(data: PresenceInput): Presence {
    const db = getDb()
    db.prepare(
      `INSERT INTO presences (employee_id, date, code, commentaire)
       VALUES (@employee_id, @date, @code, @commentaire)
       ON CONFLICT(employee_id, date)
       DO UPDATE SET code = excluded.code, commentaire = excluded.commentaire`
    ).run({
      employee_id: data.employee_id,
      date: data.date,
      code: data.code,
      commentaire: data.commentaire ?? null
    })
    return db
      .prepare('SELECT * FROM presences WHERE employee_id = ? AND date = ?')
      .get(data.employee_id, data.date) as Presence
  },

  clear(employeeId: number, date: string): void {
    getDb().prepare('DELETE FROM presences WHERE employee_id = ? AND date = ?').run(employeeId, date)
  },

  /**
   * Pré-remplit un mois : chaque jour est marqué Présent, sauf les jours de repos
   * hebdomadaire choisis. N'écrase jamais une saisie existante.
   */
  prefillMonth(start: string, end: string, joursRepos: number[]): number {
    const db = getDb()
    const actifs = employeesRepo.list(false)
    const insert = db.prepare(
      `INSERT INTO presences (employee_id, date, code, commentaire)
       VALUES (?, ?, ?, NULL)
       ON CONFLICT(employee_id, date) DO NOTHING`
    )
    const run = db.transaction(() => {
      let n = 0
      for (let d = start; d <= end; d = addDaysISO(d, 1)) {
        const jourSemaine = (new Date(d + 'T00:00:00').getDay() + 6) % 7
        const code = joursRepos.includes(jourSemaine) ? 'R' : 'P'
        for (const e of actifs) n += insert.run(e.id, d, code).changes
      }
      return n
    })
    return run()
  }
}

// ==================== REGISTRE DES ACTES ÉTABLIS ====================

/**
 * Registre des actes : chaque acte établi y est figé (copie exacte du document)
 * et rangé avec son code. On stocke un seul exemplaire par (salarié, code) :
 * réétablir un acte remplace la copie figée, sans dupliquer la ligne.
 */
export const documentsRepo = {
  list(): ActeDocument[] {
    return getDb()
      .prepare('SELECT * FROM documents ORDER BY datetime(updated_at) DESC, id DESC')
      .all() as ActeDocument[]
  },

  listByEmployee(id: number): ActeDocument[] {
    return getDb()
      .prepare(
        'SELECT * FROM documents WHERE employee_id = ? ORDER BY datetime(updated_at) DESC, id DESC'
      )
      .all(id) as ActeDocument[]
  },

  get(id: number): ActeDocument | undefined {
    return getDb().prepare('SELECT * FROM documents WHERE id = ?').get(id) as
      | ActeDocument
      | undefined
  },

  /** Range l'acte, ou remplace la copie figée s'il existe déjà pour ce salarié. */
  save(d: ActeDocumentInput): ActeDocument {
    const db = getDb()
    db.prepare(
      `INSERT INTO documents
         (reference, employee_id, employee_nom, type_acte, libelle, categorie,
          orientation, corps, options)
       VALUES
         (@reference, @employee_id, @employee_nom, @type_acte, @libelle, @categorie,
          @orientation, @corps, @options)
       ON CONFLICT (employee_id, reference) DO UPDATE SET
         libelle = excluded.libelle,
         categorie = excluded.categorie,
         orientation = excluded.orientation,
         corps = excluded.corps,
         options = excluded.options,
         updated_at = datetime('now')`
    ).run(d)
    return db
      .prepare('SELECT * FROM documents WHERE employee_id = ? AND reference = ?')
      .get(d.employee_id, d.reference) as ActeDocument
  },

  remove(id: number): void {
    getDb().prepare('DELETE FROM documents WHERE id = ?').run(id)
  }
}

// ============================ TABLEAU DE BORD ============================

/** Décale un mois 'YYYY-MM' de n mois. */
function decalerMois(mois: string, n: number): string {
  const [a, m] = mois.split('-').map(Number)
  const d = new Date(a, m - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Libellé court d'un mois : « août 26 ». */
function libelleMois(mois: string): string {
  const [a, m] = mois.split('-').map(Number)
  const nom = new Date(a, m - 1, 1).toLocaleDateString('fr-FR', { month: 'short' })
  return `${nom.replace('.', '')} ${String(a).slice(2)}`
}

/** « 2026-07-01 » → « juil 26 ». */
function formatMoisCourt(iso: string): string {
  return libelleMois(iso.slice(0, 7))
}

/** Nombre de jours (bornes incluses) entre deux dates ISO. */
function nbJoursInclus(debut: string, fin: string): number {
  const d = new Date(debut + 'T00:00:00').getTime()
  const f = new Date(fin + 'T00:00:00').getTime()
  return Math.max(1, Math.round((f - d) / 86400000) + 1)
}

/** Nombre de jours entre aujourd'hui et une date ISO (négatif si passée). */
function joursRestants(iso: string): number {
  const j = Math.round(
    (new Date(iso + 'T00:00:00').getTime() - new Date(todayISOLocal() + 'T00:00:00').getTime()) /
      86400000
  )
  return j
}

function todayISOLocal(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Panorama du tableau de bord : une seule requête IPC, tout agrégé en SQL.
 *
 * Les montants viennent des bulletins **archivés**, pas d'un recalcul : le
 * tableau de bord montre donc ce qui a réellement été émis et payé, ce qui est
 * la seule lecture défendable devant un contrôle.
 */
export function getDashboardPanorama(): DashboardPanorama {
  const db = getDb()
  const today = todayISOLocal()
  const moisCourant = today.slice(0, 7)
  const dans30 = addDaysISO(today, 30)
  const ilYaUnAn = addDaysISO(today, -365)

  const un = <T>(sql: string, ...p: unknown[]): T => db.prepare(sql).get(...p) as T
  const tous = <T>(sql: string, ...p: unknown[]): T[] => db.prepare(sql).all(...p) as T[]
  const compte = (sql: string, ...p: unknown[]): number =>
    un<{ n: number }>(sql, ...p).n ?? 0

  // ---------------------------------------------------------------- effectif
  const parPoste = tous<{ cle: string; valeur: number }>(
    `SELECT CASE WHEN TRIM(COALESCE(poste,'')) = '' THEN 'Non précisé' ELSE poste END AS cle,
            COUNT(*) AS valeur
       FROM employees WHERE statut = 'actif'
      GROUP BY cle ORDER BY valeur DESC, cle`
  ).map((r) => ({ cle: r.cle, libelle: r.cle, valeur: r.valeur }))

  const parCategorie = tous<{ cle: string; valeur: number }>(
    `SELECT categorie_cnss AS cle, COUNT(*) AS valeur
       FROM employees WHERE statut = 'actif' GROUP BY cle ORDER BY valeur DESC`
  ).map((r) => ({
    cle: r.cle,
    libelle: CATEGORIES_CNSS.find((c) => c.code === r.cle)?.libelle ?? r.cle,
    valeur: r.valeur
  }))

  const parSexe = tous<{ cle: string | null; valeur: number }>(
    `SELECT sexe AS cle, COUNT(*) AS valeur
       FROM employees WHERE statut = 'actif' GROUP BY sexe`
  ).map((r) => ({
    cle: r.cle ?? '?',
    libelle: r.cle === 'M' ? 'Hommes' : r.cle === 'F' ? 'Femmes' : 'Non renseigné',
    valeur: r.valeur
  }))

  // Ancienneté moyenne, en mois, sur les actifs dont l'embauche est connue.
  const anc = tous<{ date_embauche: string }>(
    `SELECT date_embauche FROM employees
      WHERE statut = 'actif' AND date_embauche IS NOT NULL AND date_embauche <> ''`
  )
  const ancienneteMoyenne =
    anc.length === 0
      ? 0
      : Math.round(
          anc.reduce((t, e) => {
            const d = new Date(e.date_embauche + 'T00:00:00')
            const n = new Date(today + 'T00:00:00')
            return t + Math.max(0, (n.getFullYear() - d.getFullYear()) * 12 + (n.getMonth() - d.getMonth()))
          }, 0) / anc.length
        )

  // ------------------------------------------------------------ masse 12 mois
  const debut12 = decalerMois(moisCourant, -11) + '-01'
  const brutParMois = tous<{
    mois: string
    brut: number
    net: number
    retenues: number
    cout: number
    n: number
  }>(
    `SELECT substr(periode_debut, 1, 7) AS mois,
            SUM(brut) AS brut, SUM(net_a_payer) AS net,
            SUM(total_retenues) AS retenues, SUM(cout_employeur) AS cout,
            COUNT(*) AS n
       FROM payslips WHERE periode_debut >= ?
      GROUP BY mois`,
    debut12
  )
  const parMois = new Map(brutParMois.map((r) => [r.mois, r]))
  const masse: MoisPaie[] = Array.from({ length: 12 }, (_, i) => {
    const mois = decalerMois(moisCourant, i - 11)
    const r = parMois.get(mois)
    return {
      mois,
      libelle: libelleMois(mois),
      brut: Math.round(r?.brut ?? 0),
      net: Math.round(r?.net ?? 0),
      retenues: Math.round(r?.retenues ?? 0),
      cout_employeur: Math.round(r?.cout ?? 0),
      bulletins: r?.n ?? 0
    }
  })

  // Dernier mois effectivement payé (le mois courant peut être encore vide).
  const moisRenseignes = masse.filter((m) => m.bulletins > 0)
  const dernier = moisRenseignes[moisRenseignes.length - 1] ?? null
  const avant = moisRenseignes[moisRenseignes.length - 2] ?? null
  const variation =
    dernier && avant && avant.brut > 0
      ? Math.round(((dernier.brut - avant.brut) / avant.brut) * 1000) / 10
      : null

  const bulletinsTotal = compte(`SELECT COUNT(*) AS n FROM payslips`)
  const bulletinsPayes = compte(`SELECT COUNT(*) AS n FROM payslips WHERE statut = 'Payé'`)
  const netDu = Math.round(
    un<{ s: number | null }>(`SELECT SUM(net_a_payer) AS s FROM payslips WHERE statut = 'Émis'`)
      .s ?? 0
  )
  const netMoyen =
    bulletinsTotal === 0
      ? 0
      : Math.round(
          (un<{ s: number | null }>(`SELECT SUM(net_a_payer) AS s FROM payslips`).s ?? 0) /
            bulletinsTotal
        )

  // ------------------------------------------------------------- présences
  const pres = tous<{ code: string; n: number }>(
    `SELECT code, COUNT(*) AS n FROM presences
      WHERE substr(date, 1, 7) = ? GROUP BY code`,
    moisCourant
  )
  const nb = (c: string): number => pres.find((p) => p.code === c)?.n ?? 0
  const presents = nb('P')
  const absents = nb('A') + nb('M')
  const congesPris = nb('C') + nb('F')
  const repos = nb('R')
  const ouvres = presents + absents + congesPris
  const tauxPresence = ouvres === 0 ? 0 : Math.round((presents / ouvres) * 1000) / 10

  // ----------------------------------------------------------- cotisations
  const decls = tous<{
    reference: string
    date_limite: string
    total_cotisations: number
    statut: string
    periode_debut: string
    periode_fin: string
  }>(
    `SELECT reference, date_limite, total_cotisations, statut, periode_debut, periode_fin
       FROM declarations ORDER BY date_limite`
  )
  const enAttente = decls.filter((d) => d.statut === 'Brouillon')
  const paramsPaie = lireParamsPaie()
  const prochaine = enAttente[0]
    ? {
        reference: enAttente[0].reference,
        date_limite: enAttente[0].date_limite,
        jours: joursRestants(enAttente[0].date_limite),
        montant: Math.round(enAttente[0].total_cotisations),
        // Une alerte qui dit « en retard » sans dire ce que ça coûte ne fait
        // pas agir : on chiffre dès le tableau de bord.
        majoration_estimee: estimerPenalites(
          enAttente[0].date_limite,
          Math.round(enAttente[0].total_cotisations),
          paramsPaie
        ).majoration_retard
      }
    : null
  const cotisationsAnnee = Math.round(
    decls
      .filter((d) => d.periode_debut.slice(0, 4) === today.slice(0, 4))
      .reduce((t, d) => t + d.total_cotisations, 0)
  )

  // ---------------------------------------------------------- ajustements
  const debutMois = `${moisCourant}-01`
  const finMois = addDaysISO(decalerMois(moisCourant, 1) + '-01', -1)
  const ajust = tous<{ sens: string; total: number; n: number }>(
    `SELECT sens, SUM(montant) AS total, COUNT(*) AS n FROM pay_elements
      WHERE (periode_debut IS NULL OR periode_debut <= ?)
        AND (periode_fin   IS NULL OR periode_fin   >= ?)
      GROUP BY sens`,
    finMois,
    debutMois
  )
  const ajustements = {
    primes: Math.round(ajust.find((a) => a.sens === 'gain')?.total ?? 0),
    retenues: Math.round(ajust.find((a) => a.sens === 'retenue')?.total ?? 0),
    lignes: ajust.reduce((t, a) => t + a.n, 0)
  }

  // -------------------------------------------------------------- contrats
  const echeances = tous<{ nom: string; prenom: string; poste: string; date_fin_contrat: string }>(
    `SELECT nom, prenom, poste, date_fin_contrat FROM employees
      WHERE statut = 'actif' AND date_fin_contrat IS NOT NULL AND date_fin_contrat <> ''
        AND date_fin_contrat <= ?
      ORDER BY date_fin_contrat LIMIT 6`,
    dans30
  ).map((e) => ({
    nom: `${e.prenom} ${e.nom}`.trim(),
    poste: e.poste || '—',
    date_fin: e.date_fin_contrat,
    jours: joursRestants(e.date_fin_contrat)
  }))

  // ------------------------------------------------- exploitation courante

  // Pointage du jour : tous les actifs, y compris ceux qui n'ont pas encore
  // de saisie — c'est précisément ceux-là qu'il faut voir.
  const pointageJour = tous<{ nom: string; prenom: string; poste: string; code: string | null }>(
    `SELECT e.nom, e.prenom, e.poste, p.code
       FROM employees e
       LEFT JOIN presences p ON p.employee_id = e.id AND p.date = ?
      WHERE e.statut = 'actif'
      ORDER BY e.nom, e.prenom`,
    today
  ).map((r) => ({
    nom: `${r.prenom} ${r.nom}`.trim(),
    poste: r.poste || '—',
    code: (r.code as PresenceCode | null) ?? null
  }))

  const congesAttente = tous<{
    nom: string
    prenom: string
    type: string
    date_debut: string
    date_fin: string
    statut: string
  }>(
    `SELECT e.nom, e.prenom, l.type, l.date_debut, l.date_fin, l.statut
       FROM leaves l JOIN employees e ON e.id = l.employee_id
      WHERE l.statut = 'En attente'
      ORDER BY l.date_debut LIMIT 8`
  ).map((r) => ({
    nom: `${r.prenom} ${r.nom}`.trim(),
    type: r.type,
    date_debut: r.date_debut,
    date_fin: r.date_fin,
    jours: nbJoursInclus(r.date_debut, r.date_fin),
    statut: r.statut
  }))

  // Absences du mois : seuls les codes qui appellent une décision (absence
  // injustifiée, maladie, congé sans solde), pas les repos hebdomadaires.
  const absencesMois = tous<{
    nom: string
    prenom: string
    date: string
    code: string
    commentaire: string | null
  }>(
    `SELECT e.nom, e.prenom, p.date, p.code, p.commentaire
       FROM presences p JOIN employees e ON e.id = p.employee_id
      WHERE substr(p.date, 1, 7) = ? AND p.code IN ('A', 'M', 'F')
      ORDER BY p.date DESC LIMIT 8`,
    moisCourant
  ).map((r) => ({
    nom: `${r.prenom} ${r.nom}`.trim(),
    date: r.date,
    code: r.code as PresenceCode,
    commentaire: r.commentaire
  }))

  const rappels = enAttente.slice(0, 6).map((d) => ({
    reference: d.reference,
    periode: `${formatMoisCourt(d.periode_debut)} → ${formatMoisCourt(d.periode_fin)}`,
    date_limite: d.date_limite,
    jours: joursRestants(d.date_limite),
    statut: d.statut,
    montant: Math.round(d.total_cotisations),
    majoration_estimee: estimerPenalites(
      d.date_limite,
      Math.round(d.total_cotisations),
      lireParamsPaie()
    ).majoration_retard
  }))


  const semaine = currentWeekRange()
  const entries = tous<{ arrivee: string; depart: string | null; pause_minutes: number }>(
    `SELECT arrivee, depart, pause_minutes FROM time_entries WHERE date BETWEEN ? AND ?`,
    semaine.start,
    semaine.end
  )

  return {
    genere_le: new Date().toISOString(),
    mois_courant: moisCourant,
    effectif: {
      actifs: compte(`SELECT COUNT(*) AS n FROM employees WHERE statut = 'actif'`),
      total: compte(`SELECT COUNT(*) AS n FROM employees`),
      entrees_12m: compte(
        `SELECT COUNT(*) AS n FROM employees WHERE date_embauche >= ?`,
        ilYaUnAn
      ),
      sorties_12m: compte(
        `SELECT COUNT(*) AS n FROM employees WHERE statut <> 'actif' AND updated_at >= ?`,
        ilYaUnAn
      ),
      par_poste: parPoste,
      par_categorie: parCategorie,
      par_sexe: parSexe,
      anciennete_moyenne_mois: ancienneteMoyenne,
      masse_contractuelle: Math.round(
        un<{ s: number | null }>(
          `SELECT SUM(COALESCE(salaire_mensuel, 0)) AS s FROM employees WHERE statut = 'actif'`
        ).s ?? 0
      )
    },
    masse,
    paie: {
      dernier_mois: dernier,
      variation_pct: variation,
      bulletins_total: bulletinsTotal,
      bulletins_payes: bulletinsPayes,
      net_moyen: netMoyen,
      net_du: netDu
    },
    presences: {
      presents,
      absents,
      conges: congesPris,
      repos,
      saisies: presents + absents + congesPris + repos,
      taux_presence: tauxPresence
    },
    cotisations: {
      declarations: decls.length,
      deposees: decls.length - enAttente.length,
      en_attente: enAttente.length,
      total_annee: cotisationsAnnee,
      prochaine_echeance: prochaine
    },
    ajustements,
    contrats: {
      actifs: compte(
        `SELECT COUNT(*) AS n FROM contracts
          WHERE statut = 'Signé' AND (date_fin IS NULL OR date_fin >= ?)`,
        today
      ),
      a_echeance: echeances.filter((e) => e.jours >= 0).length,
      expires: echeances.filter((e) => e.jours < 0).length,
      echeances
    },
    pointage_jour: pointageJour,
    conges_attente: congesAttente,
    absences_mois: absencesMois,
    rappels,
    jour: {
      services: compte(`SELECT COUNT(*) AS n FROM shifts WHERE date = ?`, today),
      heures_semaine:
        Math.round(
          entries.reduce((s, e) => s + computeHours(e.arrivee, e.depart, e.pause_minutes), 0) * 100
        ) / 100,
      conges_en_attente: compte(`SELECT COUNT(*) AS n FROM leaves WHERE statut = 'En attente'`)
    }
  }
}


// --- Helpers dates/heures partagés ---

function addDaysISO(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + n)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const j = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${j}`
}

/** Ajoute une durée (heures décimales) à une heure HH:MM, en incluant la pause. Retourne HH:MM. */
function ajouterHeures(debut: string, heures: number, pauseMinutes: number): string {
  const [h, m] = debut.split(':').map(Number)
  let total = h * 60 + m + Math.round(heures * 60) + pauseMinutes
  total = ((total % 1440) + 1440) % 1440
  const hh = String(Math.floor(total / 60)).padStart(2, '0')
  const mm = String(total % 60).padStart(2, '0')
  return `${hh}:${mm}`
}

/** Retourne le lundi et le dimanche de la semaine en cours (format YYYY-MM-DD). */
export function currentWeekRange(): { start: string; end: string } {
  const now = new Date()
  const day = (now.getDay() + 6) % 7 // 0 = lundi
  const monday = new Date(now)
  monday.setDate(now.getDate() - day)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const fmt = (d: Date): string => d.toISOString().slice(0, 10)
  return { start: fmt(monday), end: fmt(sunday) }
}

// ============================ RAPPEL DES PÉRIODES PASSÉES ============================

/**
 * Découpe une période en mois civils entiers.
 * Un bulletin est mensuel : rattraper un an, c'est douze bulletins, pas un.
 */
export function moisDeLaPeriode(debut: string, fin: string): { cle: string; debut: string; fin: string }[] {
  const mois: { cle: string; debut: string; fin: string }[] = []
  const [a0, m0] = debut.slice(0, 7).split('-').map(Number)
  const [a1, m1] = fin.slice(0, 7).split('-').map(Number)
  let a = a0
  let m = m0
  // Garde-fou : au-delà de dix ans, c'est une saisie erronée, pas un rattrapage.
  for (let i = 0; i < 120; i++) {
    if (a > a1 || (a === a1 && m > m1)) break
    const p = (n: number): string => String(n).padStart(2, '0')
    const dernier = new Date(Date.UTC(a, m, 0)).getUTCDate()
    mois.push({
      cle: `${a}-${p(m)}`,
      debut: `${a}-${p(m)}-01`,
      fin: `${a}-${p(m)}-${p(dernier)}`
    })
    m++
    if (m > 12) {
      m = 1
      a++
    }
  }
  return mois
}

/**
 * Rappel : produire d'un coup les bulletins des mois écoulés.
 *
 * On enregistre un salarié dont le contrat court depuis des mois — il faut
 * alors rattraper tout l'arriéré, mois par mois, avant de pouvoir déclarer
 * quoi que ce soit à la CNSS. Le faire à la main douze fois de suite était la
 * seule voie ; c'est ce que ce dépôt remplace.
 */
export const rappelRepo = {
  /**
   * Ce que donnerait le rattrapage, sans rien écrire.
   * Chaque mois est chiffré et l'on voit d'avance ceux déjà archivés.
   */
  apercu(debut: string, fin: string, settings: PayrollSettings): MoisRappel[] {
    const db = getDb()
    return moisDeLaPeriode(debut, fin).map((m) => {
      const lignes = payrollRepo.compute({ start: m.debut, end: m.fin, settings })
      const deja = (
        db
          .prepare(
            `SELECT COUNT(*) AS n FROM payslips WHERE periode_debut = ? AND periode_fin = ?`
          )
          .get(m.debut, m.fin) as { n: number }
      ).n
      return {
        cle: m.cle,
        debut: m.debut,
        fin: m.fin,
        effectif: lignes.length,
        brut: lignes.reduce((s, l) => s + l.brut_imposable, 0),
        net: lignes.reduce((s, l) => s + l.net_a_payer, 0),
        cotisations: lignes.reduce(
          (s, l) => s + l.cnss_salarie + l.cnss_employeur,
          0
        ),
        deja_archives: deja
      }
    })
  },

  /**
   * Archive les bulletins manquants sur toute la période.
   *
   * `cloturer` ignore les bulletins déjà émis (contrainte d'unicité sur
   * salarié + période) : relancer un rattrapage ne crée donc jamais de doublon
   * et ne réécrit aucun bulletin figé.
   */
  executer(debut: string, fin: string, settings: PayrollSettings): ResultatRappel {
    const mois = moisDeLaPeriode(debut, fin)
    const detail = mois.map((m) => {
      const r = payslipsRepo.cloturer({ start: m.debut, end: m.fin, settings })
      return { cle: m.cle, debut: m.debut, fin: m.fin, ...r }
    })
    return {
      mois: detail.length,
      emis: detail.reduce((s, d) => s + d.emis, 0),
      existants: detail.reduce((s, d) => s + d.existants, 0),
      detail
    }
  }
}
