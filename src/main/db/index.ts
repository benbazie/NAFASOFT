import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import { SCHEMA } from './schema'

let db: Database.Database | null = null

/**
 * Ouvre (ou crée) la base SQLite dans le dossier userData de l'application.
 * En développement, on peut forcer un chemin local via la variable d'env DB_PATH.
 */
export function initDatabase(): Database.Database {
  if (db) return db

  const dbPath = process.env.DB_PATH || join(app.getPath('userData'), 'gestion-personnel.db')
  const firstRun = !existsSync(dbPath)

  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.exec(SCHEMA)
  migrer(db)

  if (firstRun) {
    seedDemoData(db)
  }

  return db
}

/** Identifiant de l'employeur dont la base est actuellement ouverte. */
let employeurCourant: number | null = null

export function employeurOuvert(): number | null {
  return employeurCourant
}

/**
 * Ouvre la base d'un employeur donné, en refermant proprement la précédente.
 *
 * C'est le pivot du multi-employeurs : les dépôts continuent d'interroger
 * `getDb()` sans rien savoir du client courant, donc aucune requête n'a besoin
 * de filtrer — l'étanchéité tient au fait qu'un seul fichier est ouvert.
 */
export function ouvrirBaseEmployeur(chemin: string, id: number): Database.Database {
  if (db) {
    db.close()
    db = null
  }
  const premiereFois = !existsSync(chemin)
  db = new Database(chemin)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.exec(SCHEMA)
  migrer(db)
  employeurCourant = id
  if (premiereFois) {
    console.log(`[base] Nouvelle base créée pour l'employeur ${id}.`)
  }
  return db
}

/** Referme la base courante (retour au portefeuille). */
export function fermerBaseEmployeur(): void {
  if (db) {
    db.close()
    db = null
  }
  employeurCourant = null
}

/** Migrations légères pour faire évoluer une base déjà créée (idempotentes). */
function migrer(database: Database.Database): void {
  // Colonne des articles personnalisables, ajoutée après la création de la table.
  const colContrats = (
    database.prepare(`PRAGMA table_info(contracts)`).all() as { name: string }[]
  ).map((c) => c.name)
  if (colContrats.length > 0 && !colContrats.includes('articles')) {
    database.exec(`ALTER TABLE contracts ADD COLUMN articles TEXT`)
  }

  const colonnes = (database.prepare(`PRAGMA table_info(employees)`).all() as { name: string }[]).map(
    (c) => c.name
  )
  const ajouter = (nom: string, definition: string): void => {
    if (!colonnes.includes(nom)) {
      database.exec(`ALTER TABLE employees ADD COLUMN ${nom} ${definition}`)
    }
  }
  ajouter('salaire_mensuel', 'REAL')
  ajouter('matricule', 'TEXT')
  ajouter('personnes_a_charge', 'INTEGER NOT NULL DEFAULT 0')
  ajouter('numero_cnss', 'TEXT')
  ajouter('categorie_cnss', "TEXT NOT NULL DEFAULT 'P'")
  ajouter('cadre', 'INTEGER NOT NULL DEFAULT 0')
  ajouter('sexe', 'TEXT')
  ajouter('date_naissance', 'TEXT')
  ajouter('photo', 'TEXT')
  ajouter('lieu_naissance', 'TEXT')
  ajouter('situation_famille', 'TEXT')
  ajouter('contact_urgence', 'TEXT')
  ajouter('nationalite', 'TEXT')
  ajouter('cnib', 'TEXT')
  ajouter('nom_pere', 'TEXT')
  ajouter('nom_mere', 'TEXT')
  ajouter('nom_conjoint', 'TEXT')
  ajouter('nombre_enfants', 'INTEGER NOT NULL DEFAULT 0')

  // Rubriques reprises de l'imprimé d'immatriculation CNSS.
  ajouter('acte_nature', 'TEXT')
  ajouter('acte_numero', 'TEXT')
  ajouter('acte_date', 'TEXT')
  ajouter('acte_lieu', 'TEXT')
  ajouter('nom_jeune_fille', 'TEXT')
  ajouter('departement_naissance', 'TEXT')
  ajouter('province_naissance', 'TEXT')
  ajouter('pays_naissance', 'TEXT')
  ajouter('groupe_sanguin', 'TEXT')
  ajouter('prenoms_pere', 'TEXT')
  ajouter('prenoms_mere', 'TEXT')
  ajouter('prenoms_conjoint', 'TEXT')
  ajouter('adresse_conjoint', 'TEXT')
  ajouter('banque', 'TEXT')
  ajouter('compte_bancaire', 'TEXT')
  ajouter('compte_ccp', 'TEXT')
  ajouter('province', 'TEXT')
  ajouter('departement', 'TEXT')
  ajouter('secteur', 'TEXT')
  ajouter('quartier', 'TEXT')
  ajouter('numero_rue', 'TEXT')
  ajouter('nom_rue', 'TEXT')
  ajouter('numero_lot', 'TEXT')
  ajouter('nom_immeuble', 'TEXT')
  ajouter('numero_etage', 'TEXT')
  ajouter('numero_porte', 'TEXT')
  ajouter('qualification', 'TEXT')

  // L'ancien champ « n° sécurité sociale » faisait double emploi avec le numéro
  // d'immatriculation CNSS : on récupère ce qui y avait été saisi avant de l'abandonner.
  if (colonnes.includes('num_secu')) {
    database.exec(`
      UPDATE employees SET numero_cnss = num_secu
      WHERE (numero_cnss IS NULL OR numero_cnss = '')
        AND num_secu IS NOT NULL AND num_secu <> ''
    `)
  }

  reparerCategories(database)
}

/**
 * Remet à « P » (Permanent) toute catégorie CNSS invalide.
 *
 * Une version antérieure a pu écrire le statut de l'employé (« actif ») dans ce
 * champ. Une valeur hors référentiel excluait le salarié de toutes les branches
 * du décompte, faisant tomber les cotisations à zéro sans le moindre message.
 */
function reparerCategories(database: Database.Database): number {
  const corriges = database
    .prepare(
      `UPDATE employees SET categorie_cnss = 'P'
       WHERE categorie_cnss IS NULL
          OR categorie_cnss NOT IN ('P','T','J','F','S','E','N')`
    )
    .run().changes
  if (corriges > 0) {
    console.log(`[base] ${corriges} catégorie(s) CNSS invalide(s) corrigée(s) en « P ».`)
  }
  return corriges
}

export function getDb(): Database.Database {
  if (!db) throw new Error('La base de données n\'est pas initialisée. Appelez initDatabase() d\'abord.')
  return db
}

export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}

/** Quelques données de démonstration au premier lancement pour ne pas partir d'un écran vide. */
function seedDemoData(database: Database.Database): void {
  const insert = database.prepare(`
    INSERT INTO employees
      (matricule, numero_cnss, categorie_cnss, cadre, sexe, date_naissance, personnes_a_charge,
       nom, prenom, poste, type_contrat, date_embauche, date_fin_contrat,
       salaire_mensuel, heures_hebdo, telephone, statut)
    VALUES
      (@matricule, @numero_cnss, @categorie_cnss, @cadre, @sexe, @date_naissance, @personnes_a_charge,
       @nom, @prenom, @poste, @type_contrat, @date_embauche, @date_fin_contrat,
       @salaire_mensuel, @heures_hebdo, @telephone, 'actif')
  `)
  // Jeu d'exemple cohérent avec le contexte burkinabè (salaires mensuels en FCFA).
  const demo = [
    { matricule: '0001', numero_cnss: '0112458 A', categorie_cnss: 'P', cadre: 1, sexe: 'F', date_naissance: '1988-05-12', personnes_a_charge: 3, nom: 'Ouédraogo', prenom: 'Aminata', poste: 'Chef cuisinier', type_contrat: 'CDI', date_embauche: '2021-03-15', date_fin_contrat: null, salaire_mensuel: 185000, heures_hebdo: 40, telephone: '70 12 34 56' },
    { matricule: '0002', numero_cnss: '0224871 B', categorie_cnss: 'P', cadre: 0, sexe: 'M', date_naissance: '1996-11-03', personnes_a_charge: 1, nom: 'Sawadogo', prenom: 'Boureima', poste: 'Serveur', type_contrat: 'CDD', date_embauche: '2025-09-01', date_fin_contrat: '2025-12-01', salaire_mensuel: 95000, heures_hebdo: 40, telephone: '76 98 76 54' },
    { matricule: '0003', numero_cnss: '0331204 C', categorie_cnss: 'J', cadre: 0, sexe: 'F', date_naissance: '2001-02-27', personnes_a_charge: 0, nom: 'Kaboré', prenom: 'Salimata', poste: 'Plongeuse', type_contrat: 'CDD', date_embauche: '2026-01-10', date_fin_contrat: '2026-04-10', salaire_mensuel: 62000, heures_hebdo: 35, telephone: '65 11 22 33' },
    { matricule: '0004', numero_cnss: '0417639 D', categorie_cnss: 'P', cadre: 0, sexe: 'M', date_naissance: '1993-07-19', personnes_a_charge: 2, nom: 'Traoré', prenom: 'Issouf', poste: 'Barman', type_contrat: 'CDI', date_embauche: '2023-09-20', date_fin_contrat: null, salaire_mensuel: 110000, heures_hebdo: 40, telephone: '78 55 66 77' }
  ]
  const insertMany = database.transaction((rows: typeof demo) => {
    for (const row of rows) insert.run(row)
  })
  insertMany(demo)
}
