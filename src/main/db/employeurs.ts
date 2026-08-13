import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, unlinkSync } from 'fs'
import type { EmployeurInput, EmployeurRegistre } from '../../shared/types'

/**
 * Registre central des employeurs.
 *
 * Chaque employeur possède SA PROPRE base SQLite (`employeur-<id>.db`) : les
 * données de deux clients ne se croisent jamais, même en cas de bug — c'est ce
 * qui a fait préférer cette architecture au multi-tenant à `employeur_id`, où
 * un seul filtre oublié aurait mélangé des salaires entre entreprises.
 *
 * Ce fichier-ci ne contient QUE l'annuaire : identité, chemin du fichier,
 * ordre. Aucune donnée de paie.
 */

const SCHEMA_REGISTRE = `
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS employeurs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  nom           TEXT    NOT NULL,
  fichier       TEXT    NOT NULL UNIQUE,
  numero_cnss   TEXT,
  ville         TEXT,
  logo          TEXT,
  couleur       TEXT,
  archive       INTEGER NOT NULL DEFAULT 0,
  cree_le       TEXT    NOT NULL DEFAULT (datetime('now')),
  ouvert_le     TEXT
);
-- Les colonnes de la fiche complète sont ajoutées par migrerRegistre :
-- un CREATE TABLE ne s'appliquerait qu'aux installations neuves.

CREATE TABLE IF NOT EXISTS registre_reglages (
  cle    TEXT PRIMARY KEY,
  valeur TEXT
);

-- Les comptes appartiennent à l'INSTALLATION, pas à un employeur : un comptable
-- se connecte une fois puis circule entre ses clients. C'est aussi ce qui rend
-- la connexion possible au démarrage, alors qu'aucune base employeur n'est
-- encore ouverte.
CREATE TABLE IF NOT EXISTS users (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  username     TEXT    NOT NULL UNIQUE,
  nom          TEXT    NOT NULL,
  role         TEXT    NOT NULL DEFAULT 'utilisateur',
  pass         TEXT    NOT NULL,
  must_change  INTEGER NOT NULL DEFAULT 0,
  question     TEXT,
  reponse      TEXT,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);
`

let registre: Database.Database | null = null

/** Racine des données de l'application (surchargeable pour les tests). */
function racineDonnees(): string {
  return process.env.NAFA_DATA || app.getPath('userData')
}

/** Dossier qui contient le registre et toutes les bases des employeurs. */
export function dossierDonnees(): string {
  const d = join(racineDonnees(), 'employeurs')
  if (!existsSync(d)) mkdirSync(d, { recursive: true })
  return d
}

/** Colonnes de la fiche employeur, ajoutées au fil des versions. */
const COLONNES_FICHE: [string, string][] = [
  ['sigle', 'TEXT'],
  ['forme_juridique', 'TEXT'],
  ['rccm', 'TEXT'],
  ['ifu', 'TEXT'],
  ['secteur_activite', 'TEXT'],
  ['date_creation', 'TEXT'],
  ['quartier', 'TEXT'],
  ['adresse', 'TEXT'],
  ['boite_postale', 'TEXT'],
  ['telephone', 'TEXT'],
  ['email', 'TEXT'],
  ['representant_nom', 'TEXT'],
  ['representant_qualite', 'TEXT'],
  ['representant_telephone', 'TEXT'],
  ['etat', "TEXT NOT NULL DEFAULT 'actif'"],
  ['periodicite', "TEXT NOT NULL DEFAULT 'trimestrielle'"],
  ['contact_cabinet', 'TEXT'],
  ['honoraires', 'REAL'],
  ['notes', 'TEXT']
]

/**
 * Enrichissement de l'annuaire, version après version.
 *
 * On ajoute les colonnes une à une plutôt que de recréer la table : un
 * portefeuille en service ne se reconstruit pas, et une migration qui recopie
 * des lignes est une occasion de plus de les perdre.
 */
function migrerRegistre(reg: Database.Database): void {
  const presentes = (reg.prepare('PRAGMA table_info(employeurs)').all() as { name: string }[]).map(
    (c) => c.name
  )
  for (const [nom, definition] of COLONNES_FICHE) {
    if (!presentes.includes(nom)) {
      reg.exec(`ALTER TABLE employeurs ADD COLUMN ${nom} ${definition}`)
    }
  }
}

export function ouvrirRegistre(): Database.Database {
  if (registre) return registre
  const chemin = join(dossierDonnees(), 'registre.db')
  registre = new Database(chemin)
  registre.exec(SCHEMA_REGISTRE)
  migrerRegistre(registre)
  reprendreBaseHistorique(registre)
  reconstruireDepuisFichiers(registre)
  reprendreComptes(registre)
  return registre
}

/**
 * Filet de sécurité : un registre vide entouré de bases employeurs.
 *
 * Cet état est contradictoire — des dossiers existent sur le disque mais plus
 * rien ne les désigne. Il peut naître d'un registre recréé, d'une copie
 * incomplète ou d'une restauration partielle. Sans ce rattrapage,
 * l'application se croit neuve et propose de tout recommencer : l'utilisateur
 * crée alors une entreprise vide À CÔTÉ de ses vraies données, qui restent
 * invisibles. On préfère reconstruire l'annuaire à partir des fichiers.
 */
function reconstruireDepuisFichiers(reg: Database.Database): void {
  const n = (reg.prepare('SELECT COUNT(*) AS n FROM employeurs').get() as { n: number }).n
  if (n > 0) return

  const dossier = dossierDonnees()
  const bases = readdirSync(dossier)
    .filter((f) => /^employeur-\d+\.db$/.test(f))
    .sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]))
  if (bases.length === 0) return

  const insert = reg.prepare(
    `INSERT OR IGNORE INTO employeurs (id, nom, fichier, ville, numero_cnss) VALUES (?, ?, ?, ?, ?)`
  )
  let repris = 0

  for (const fichier of bases) {
    const id = Number(fichier.match(/\d+/)![0])
    // Le nom vient des réglages de la base elle-même : le client se retrouve
    // sous son propre nom, pas sous un intitulé inventé.
    let nom = `Employeur ${id}`
    let ville: string | null = null
    let cnss: string | null = null
    let db: Database.Database | null = null
    try {
      db = new Database(join(dossier, fichier), { readonly: true, fileMustExist: true })
      const r = db.prepare(`SELECT valeur FROM settings WHERE cle = 'config'`).get() as
        | { valeur: string | null }
        | undefined
      if (r?.valeur) {
        const c = JSON.parse(r.valeur) as {
          entreprise_nom?: string
          entreprise_ville?: string
          numero_employeur_cnss?: string
        }
        if (c.entreprise_nom && c.entreprise_nom.trim().length >= 2) nom = c.entreprise_nom.trim()
        ville = c.entreprise_ville ?? null
        cnss = c.numero_employeur_cnss ?? null
      }
    } catch {
      // Base illisible : on l'inscrit quand même, sous un nom générique, pour
      // qu'elle apparaisse dans le portefeuille au lieu de rester orpheline.
    } finally {
      db?.close()
    }
    insert.run(id, nom, fichier, ville, cnss)
    repris++
    console.log(`[registre] Dossier retrouvé sur le disque et réinscrit : ${nom} (${fichier}).`)
  }

  if (repris > 0) {
    console.warn(
      `[registre] Le registre était vide alors que ${repris} base(s) employeur existaient : ` +
        `l'annuaire a été reconstruit à partir des fichiers.`
    )
  }
}

/**
 * Remontée des comptes vers le registre.
 *
 * Les comptes étaient stockés dans la base de l'entreprise. Ils appartiennent
 * en réalité à l'installation : on les récupère depuis les bases employeurs
 * existantes tant que le registre n'en contient aucun, sinon le client se
 * retrouverait devant un écran de première configuration après mise à jour,
 * alors que son mot de passe existe toujours.
 */
function reprendreComptes(reg: Database.Database): void {
  // Consolidation faite UNE SEULE FOIS, marquée dans le registre.
  //
  // La condition d'avant — « seulement si le registre n'a aucun compte » —
  // laissait derrière elle tous les comptes des autres dossiers dès qu'un seul
  // avait été repris : leurs titulaires ne pouvaient plus se connecter, alors
  // que leur mot de passe existait toujours dans la base de leur entreprise.
  // Le drapeau permet d'importer TOUT ce qui manque, sans ressusciter ensuite
  // un compte que l'administrateur aurait délibérément supprimé.
  const fait = reg
    .prepare(`SELECT valeur FROM registre_reglages WHERE cle = 'comptes_repris'`)
    .get() as { valeur: string | null } | undefined
  if (fait?.valeur) return

  const insert = reg.prepare(
    `INSERT OR IGNORE INTO users (username, nom, role, pass, must_change, question, reponse)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
  let repris = 0

  for (const e of reg.prepare('SELECT fichier FROM employeurs ORDER BY id').all() as {
    fichier: string
  }[]) {
    const chemin = join(dossierDonnees(), e.fichier)
    if (!existsSync(chemin)) continue
    let src: Database.Database | null = null
    try {
      src = new Database(chemin, { readonly: true, fileMustExist: true })
      const lignes = src.prepare('SELECT * FROM users').all() as {
        username: string
        nom: string
        role: string
        pass: string
        must_change: number
        question: string | null
        reponse: string | null
      }[]
      for (const u of lignes) {
        insert.run(u.username, u.nom, u.role, u.pass, u.must_change, u.question, u.reponse)
        repris++
      }
      if (lignes.length === 0) {
        // Version plus ancienne encore : un unique mot de passe gérant.
        const row = src.prepare(`SELECT valeur FROM settings WHERE cle = 'manager_password'`).get() as
          | { valeur: string | null }
          | undefined
        if (row?.valeur) {
          insert.run('gerant', 'Gérant', 'administrateur', row.valeur, 0, null, null)
          repris++
        }
      }
    } catch {
      /* base absente, illisible ou sans table users : rien à reprendre */
    } finally {
      src?.close()
    }
  }

  reg
    .prepare(
      `INSERT INTO registre_reglages (cle, valeur) VALUES ('comptes_repris', ?)
       ON CONFLICT(cle) DO UPDATE SET valeur = excluded.valeur`
    )
    .run(new Date().toISOString())

  if (repris > 0) {
    console.log(
      `[registre] ${repris} compte(s) repris depuis les bases employeurs ` +
        `(les identifiants et mots de passe d'origine restent valables).`
    )
  }
}

/**
 * Reprise de l'installation mono-employeur d'origine : si une base
 * `gestion-personnel.db` existe encore à l'ancien emplacement et qu'aucun
 * employeur n'est enregistré, on l'adopte comme premier employeur au lieu de
 * la laisser orpheline — l'utilisateur ne perd rien en mettant à jour.
 *
 * L'ancien emplacement est TOUJOURS déduit de `racineDonnees()`, jamais de
 * `DB_PATH` : une exécution de test qui redirige `NAFA_DATA` ne doit sous aucun
 * prétexte aller déplacer la vraie base de l'utilisateur.
 */
function reprendreBaseHistorique(reg: Database.Database): void {
  const n = (reg.prepare('SELECT COUNT(*) AS n FROM employeurs').get() as { n: number }).n
  if (n > 0) return

  const ancienne = join(racineDonnees(), 'gestion-personnel.db')
  if (!existsSync(ancienne)) return

  const cible = join(dossierDonnees(), 'employeur-1.db')
  if (existsSync(cible)) return

  // Le nom déjà saisi dans les réglages vaut mieux qu'un « Mon entreprise »
  // générique : le client retrouve son entreprise sous son propre nom.
  let nom = 'Mon entreprise'
  try {
    const ancienneDb = new Database(ancienne, { readonly: true, fileMustExist: true })
    try {
      // Clé « config » : le même JSON que celui lu par le renderer (chargerConfig).
      const r = ancienneDb.prepare(`SELECT valeur FROM settings WHERE cle = 'config'`).get() as
        | { valeur: string | null }
        | undefined
      const raison = r?.valeur
        ? (JSON.parse(r.valeur) as { entreprise_nom?: string }).entreprise_nom
        : null
      if (raison && raison.trim().length >= 2) nom = raison.trim()

      // On COPIE, on ne déplace pas. `VACUUM INTO` relit la base page par page
      // et écrit un fichier neuf et compact : une base déjà abîmée échoue ici,
      // au lieu d'être promue « dossier officiel » et de propager son mal.
      // Un rename, lui, aurait déplacé un fichier peut-être encore ouvert
      // ailleurs — et un fichier SQLite déplacé sous son propre processus est
      // le scénario type de la corruption.
      ancienneDb.prepare('VACUUM INTO ?').run(cible)
    } finally {
      ancienneDb.close()
    }
  } catch (err) {
    console.error('[registre] Reprise abandonnée :', (err as Error).message)
    if (existsSync(cible)) {
      try {
        unlinkSync(cible)
      } catch {
        /* rien à nettoyer */
      }
    }
    return
  }

  // Contrôle du résultat avant d'engager quoi que ce soit dans le registre.
  try {
    const copie = new Database(cible, { readonly: true, fileMustExist: true })
    try {
      const ok =
        (copie.prepare(`SELECT COUNT(*) AS n FROM sqlite_master WHERE name = 'employees'`).get() as {
          n: number
        }).n === 1
      if (!ok) throw new Error('la copie ne contient pas les tables attendues')
    } finally {
      copie.close()
    }
  } catch (err) {
    console.error('[registre] Copie invalide, reprise annulée :', (err as Error).message)
    try {
      unlinkSync(cible)
    } catch {
      /* rien à nettoyer */
    }
    return
  }

  // L'original est écarté, pas supprimé : il reste le dernier recours si la
  // reprise se révélait fautive, et son nom dit clairement ce qu'il est.
  try {
    renameSync(ancienne, ancienne + '.repris')
    for (const suffixe of ['-wal', '-shm']) {
      if (existsSync(ancienne + suffixe)) unlinkSync(ancienne + suffixe)
    }
  } catch {
    /* original verrouillé : la copie fait foi, l'original sera ignoré */
  }

  reg.prepare(`INSERT INTO employeurs (nom, fichier) VALUES (?, ?)`).run(nom, 'employeur-1.db')
  console.log(`[registre] Base historique reprise comme premier employeur « ${nom} ».`)
}

function ligneVers(r: Record<string, unknown>): EmployeurRegistre {
  const t = (cle: string): string | null => (r[cle] as string) ?? null
  return {
    id: r.id as number,
    nom: r.nom as string,
    fichier: r.fichier as string,
    sigle: t('sigle'),
    forme_juridique: t('forme_juridique'),
    rccm: t('rccm'),
    ifu: t('ifu'),
    numero_cnss: t('numero_cnss'),
    secteur_activite: t('secteur_activite'),
    date_creation: t('date_creation'),
    ville: t('ville'),
    quartier: t('quartier'),
    adresse: t('adresse'),
    boite_postale: t('boite_postale'),
    telephone: t('telephone'),
    email: t('email'),
    representant_nom: t('representant_nom'),
    representant_qualite: t('representant_qualite'),
    representant_telephone: t('representant_telephone'),
    etat: (t('etat') as EmployeurRegistre['etat']) ?? 'actif',
    periodicite: (t('periodicite') as EmployeurRegistre['periodicite']) ?? 'trimestrielle',
    contact_cabinet: t('contact_cabinet'),
    honoraires: (r.honoraires as number) ?? null,
    notes: t('notes'),
    logo: t('logo'),
    couleur: t('couleur'),
    archive: Boolean(r.archive),
    cree_le: r.cree_le as string,
    ouvert_le: t('ouvert_le')
  }
}

/** Colonnes que `create` et `update` savent écrire. */
const CHAMPS_ECRIVABLES = [
  'nom', 'sigle', 'forme_juridique', 'rccm', 'ifu', 'numero_cnss', 'secteur_activite',
  'date_creation', 'ville', 'quartier', 'adresse', 'boite_postale', 'telephone', 'email',
  'representant_nom', 'representant_qualite', 'representant_telephone', 'etat', 'periodicite',
  'contact_cabinet', 'honoraires', 'notes', 'logo', 'couleur'
] as const

/**
 * Défauts des colonnes NOT NULL de la fiche (`etat`, `periodicite`).
 *
 * La contrainte SQL a bien un défaut, mais il ne s'applique qu'à un INSERT
 * qui OMET la colonne — `valeurs()` l'écrit toujours, avec `null` si rien
 * n'est fourni, ce qui viole la contrainte au lieu de la laisser jouer.
 */
const DEFAUTS_CREATION: Partial<Record<(typeof CHAMPS_ECRIVABLES)[number], unknown>> = {
  etat: 'actif',
  periodicite: 'trimestrielle'
}

export const employeursRepo = {
  list(inclureArchives = false): EmployeurRegistre[] {
    const where = inclureArchives ? '' : 'WHERE archive = 0'
    return (
      ouvrirRegistre()
        .prepare(`SELECT * FROM employeurs ${where} ORDER BY archive, nom`)
        .all() as Record<string, unknown>[]
    ).map(ligneVers)
  },

  get(id: number): EmployeurRegistre | undefined {
    const r = ouvrirRegistre().prepare('SELECT * FROM employeurs WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined
    return r ? ligneVers(r) : undefined
  },

  /** Crée un employeur et le fichier de base qui lui est propre. */
  /**
   * Valeurs à écrire, dans l'ordre de CHAMPS_ECRIVABLES.
   *
   * Une chaîne vide devient NULL : un champ laissé vide ne doit pas rendre
   * « présent mais vide » un renseignement absent, sinon les documents
   * impriment des lignes vides au lieu de sauter la rubrique.
   */
  valeurs(d: EmployeurInput, actuel?: EmployeurRegistre): unknown[] {
    return CHAMPS_ECRIVABLES.map((champ) => {
      const brut = (d as Record<string, unknown>)[champ]
      if (brut === undefined) {
        if (actuel) return (actuel as unknown as Record<string, unknown>)[champ] ?? null
        // Création sans valeur fournie : les colonnes NOT NULL (etat,
        // periodicite) ont un défaut en base, mais celui-ci ne s'applique
        // qu'à un INSERT qui omet la colonne — pas à un INSERT explicite
        // avec `null`, ce que produit cette fonction. On reproduit donc le
        // défaut ici, pour qu'un appel qui oublie ces deux champs ne casse
        // pas la création au lieu de silencieusement échouer.
        return DEFAUTS_CREATION[champ] ?? null
      }
      if (typeof brut === 'string') {
        const v = brut.trim()
        return v === '' ? null : v
      }
      return brut ?? null
    })
  },

  create(d: EmployeurInput): EmployeurRegistre {
    const reg = ouvrirRegistre()
    const nom = d.nom.trim()
    if (nom.length < 2) throw new Error('Le nom de l’employeur est trop court.')

    const colonnes = CHAMPS_ECRIVABLES.join(', ')
    const trous = CHAMPS_ECRIVABLES.map(() => '?').join(', ')
    const info = reg
      .prepare(`INSERT INTO employeurs (fichier, ${colonnes}) VALUES ('', ${trous})`)
      .run(...this.valeurs({ ...d, nom }))

    // Le nom du fichier dérive de l'identifiant, donc il n'est connu qu'après
    // l'insertion : d'où la mise à jour immédiate qui suit.
    const id = Number(info.lastInsertRowid)
    reg.prepare('UPDATE employeurs SET fichier = ? WHERE id = ?').run(`employeur-${id}.db`, id)
    return this.get(id)!
  },

  update(id: number, d: EmployeurInput): EmployeurRegistre {
    const actuel = this.get(id)
    if (!actuel) throw new Error('Employeur introuvable.')
    if (d.nom !== undefined && d.nom.trim().length < 2) {
      throw new Error('Le nom de l’employeur est trop court.')
    }
    const affectations = CHAMPS_ECRIVABLES.map((c) => `${c} = ?`).join(', ')
    ouvrirRegistre()
      .prepare(`UPDATE employeurs SET ${affectations} WHERE id = ?`)
      .run(...this.valeurs(d, actuel), id)
    return this.get(id)!
  },

  /** Archive (masque) un employeur sans toucher à ses données. */
  archiver(id: number, archive: boolean): void {
    ouvrirRegistre().prepare('UPDATE employeurs SET archive = ? WHERE id = ?').run(archive ? 1 : 0, id)
  },

  /** Supprime l'employeur, sa base ET ses pièces jointes. Irréversible. */
  remove(id: number): void {
    const e = this.get(id)
    if (!e) return
    ouvrirRegistre().prepare('DELETE FROM employeurs WHERE id = ?').run(id)
    // Les pièces sont rangées par employeur : elles partent avec lui, au lieu
    // de rester orphelines sur le disque sans plus rien pour les désigner.
    const pieces = join(dossierDonnees(), `pieces-${id}`)
    if (existsSync(pieces)) {
      try {
        rmSync(pieces, { recursive: true, force: true })
      } catch {
        /* dossier verrouillé : il partira au prochain démarrage */
      }
    }
    const chemin = join(dossierDonnees(), e.fichier)
    for (const f of [chemin, chemin + '-wal', chemin + '-shm']) {
      if (existsSync(f)) {
        try {
          unlinkSync(f)
        } catch {
          /* fichier verrouillé : il sera nettoyé au prochain démarrage */
        }
      }
    }
  },

  marquerOuvert(id: number): void {
    ouvrirRegistre()
      .prepare(`UPDATE employeurs SET ouvert_le = datetime('now') WHERE id = ?`)
      .run(id)
  },

  /** Chemin absolu du fichier de base d'un employeur. */
  chemin(id: number): string {
    const e = this.get(id)
    if (!e) throw new Error('Employeur introuvable.')
    return join(dossierDonnees(), e.fichier)
  },

  lireReglage(cle: string): string | null {
    const r = ouvrirRegistre()
      .prepare('SELECT valeur FROM registre_reglages WHERE cle = ?')
      .get(cle) as { valeur: string | null } | undefined
    return r?.valeur ?? null
  },

  ecrireReglage(cle: string, valeur: string): void {
    ouvrirRegistre()
      .prepare(
        `INSERT INTO registre_reglages (cle, valeur) VALUES (?, ?)
         ON CONFLICT(cle) DO UPDATE SET valeur = excluded.valeur`
      )
      .run(cle, valeur)
  }
}
