// Schéma SQL de la base de données. Exécuté à chaque démarrage (idempotent).
export const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS employees (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  matricule          TEXT,
  numero_cnss        TEXT,
  categorie_cnss     TEXT    NOT NULL DEFAULT 'P',
  cadre              INTEGER NOT NULL DEFAULT 0,
  sexe               TEXT,
  date_naissance     TEXT,
  personnes_a_charge INTEGER NOT NULL DEFAULT 0,
  photo              TEXT,
  lieu_naissance     TEXT,
  nationalite        TEXT,
  cnib               TEXT,
  nom_pere           TEXT,
  nom_mere           TEXT,
  situation_famille  TEXT,
  nom_conjoint       TEXT,
  nombre_enfants     INTEGER NOT NULL DEFAULT 0,
  contact_urgence    TEXT,
  -- Rubriques de la demande d'immatriculation CNSS
  acte_nature        TEXT,
  acte_numero        TEXT,
  acte_date          TEXT,
  acte_lieu          TEXT,
  nom_jeune_fille    TEXT,
  departement_naissance TEXT,
  province_naissance TEXT,
  pays_naissance     TEXT,
  groupe_sanguin     TEXT,
  prenoms_pere       TEXT,
  prenoms_mere       TEXT,
  prenoms_conjoint   TEXT,
  adresse_conjoint   TEXT,
  banque             TEXT,
  compte_bancaire    TEXT,
  compte_ccp         TEXT,
  province           TEXT,
  departement        TEXT,
  secteur            TEXT,
  quartier           TEXT,
  numero_rue         TEXT,
  nom_rue            TEXT,
  numero_lot         TEXT,
  nom_immeuble       TEXT,
  numero_etage       TEXT,
  numero_porte       TEXT,
  qualification      TEXT,
  nom              TEXT    NOT NULL,
  prenom           TEXT    NOT NULL,
  poste            TEXT    NOT NULL DEFAULT '',
  type_contrat     TEXT    NOT NULL DEFAULT 'CDI',
  date_embauche    TEXT,
  date_fin_contrat TEXT,
  salaire_horaire  REAL,
  salaire_mensuel  REAL,
  heures_hebdo     REAL,
  telephone        TEXT,
  email            TEXT,
  adresse          TEXT,
  statut           TEXT    NOT NULL DEFAULT 'actif',
  notes            TEXT,
  created_at       TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS shifts (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id   INTEGER NOT NULL,
  date          TEXT    NOT NULL,
  heure_debut   TEXT    NOT NULL,
  heure_fin     TEXT    NOT NULL,
  poste         TEXT,
  pause_minutes INTEGER NOT NULL DEFAULT 0,
  notes         TEXT,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_shifts_date ON shifts(date);
CREATE INDEX IF NOT EXISTS idx_shifts_employee ON shifts(employee_id);

CREATE TABLE IF NOT EXISTS leaves (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL,
  type        TEXT    NOT NULL,
  date_debut  TEXT    NOT NULL,
  date_fin    TEXT    NOT NULL,
  statut      TEXT    NOT NULL DEFAULT 'En attente',
  motif       TEXT,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_leaves_employee ON leaves(employee_id);
CREATE INDEX IF NOT EXISTS idx_leaves_dates ON leaves(date_debut, date_fin);

CREATE TABLE IF NOT EXISTS time_entries (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id   INTEGER NOT NULL,
  date          TEXT    NOT NULL,
  arrivee       TEXT    NOT NULL,
  depart        TEXT,
  pause_minutes INTEGER NOT NULL DEFAULT 0,
  notes         TEXT,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_time_entries_date ON time_entries(date);
CREATE INDEX IF NOT EXISTS idx_time_entries_employee ON time_entries(employee_id);

CREATE TABLE IF NOT EXISTS settings (
  cle    TEXT PRIMARY KEY,
  valeur TEXT
);

CREATE TABLE IF NOT EXISTS employee_documents (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL,
  type        TEXT    NOT NULL,
  nom         TEXT    NOT NULL,
  fichier     TEXT    NOT NULL,
  taille      INTEGER NOT NULL DEFAULT 0,
  notes       TEXT,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_docs_employee ON employee_documents(employee_id);

CREATE TABLE IF NOT EXISTS contracts (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id    INTEGER NOT NULL,
  reference      TEXT    NOT NULL,
  type_contrat   TEXT    NOT NULL,
  poste          TEXT    NOT NULL DEFAULT '',
  date_debut     TEXT    NOT NULL,
  date_fin       TEXT,
  duree_mois     INTEGER,
  mode_salaire   TEXT    NOT NULL DEFAULT 'mensuel',
  salaire_montant REAL   NOT NULL DEFAULT 0,
  heures_hebdo   REAL    NOT NULL DEFAULT 40,
  jours_repos    INTEGER NOT NULL DEFAULT 1,
  periode_essai  TEXT,
  clauses        TEXT,
  articles       TEXT,
  lieu_signature TEXT,
  statut         TEXT    NOT NULL DEFAULT 'Brouillon',
  date_signature TEXT,
  parent_id      INTEGER,
  motif_rupture  TEXT,
  created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES contracts(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_contracts_employee ON contracts(employee_id);
CREATE INDEX IF NOT EXISTS idx_contracts_statut ON contracts(statut);

CREATE TABLE IF NOT EXISTS pay_elements (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id   INTEGER NOT NULL,
  libelle       TEXT    NOT NULL,
  sens          TEXT    NOT NULL DEFAULT 'gain',
  base          REAL,
  taux          REAL,
  montant       REAL    NOT NULL DEFAULT 0,
  soumis_cnss   INTEGER NOT NULL DEFAULT 1,
  soumis_iuts   INTEGER NOT NULL DEFAULT 1,
  periode_debut TEXT,
  periode_fin   TEXT,
  notes         TEXT,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_elements_employee ON pay_elements(employee_id);

CREATE TABLE IF NOT EXISTS payslips (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  reference       TEXT    NOT NULL UNIQUE,
  employee_id     INTEGER NOT NULL,
  periode_debut   TEXT    NOT NULL,
  periode_fin     TEXT    NOT NULL,
  brut            REAL    NOT NULL DEFAULT 0,
  total_retenues  REAL    NOT NULL DEFAULT 0,
  net_a_payer     REAL    NOT NULL DEFAULT 0,
  cout_employeur  REAL    NOT NULL DEFAULT 0,
  donnees         TEXT    NOT NULL,
  parametres      TEXT    NOT NULL,
  statut          TEXT    NOT NULL DEFAULT 'Émis',
  date_paiement   TEXT,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  UNIQUE (employee_id, periode_debut, periode_fin)
);
CREATE INDEX IF NOT EXISTS idx_payslips_periode ON payslips(periode_debut, periode_fin);
CREATE INDEX IF NOT EXISTS idx_payslips_employee ON payslips(employee_id);

CREATE TABLE IF NOT EXISTS declarations (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  reference            TEXT    NOT NULL UNIQUE,
  periode_debut        TEXT    NOT NULL,
  periode_fin          TEXT    NOT NULL,
  mensuelle            INTEGER NOT NULL DEFAULT 0,
  date_limite          TEXT,
  effectif             INTEGER NOT NULL DEFAULT 0,
  total_salaires_bruts REAL    NOT NULL DEFAULT 0,
  total_base_cnss      REAL    NOT NULL DEFAULT 0,
  total_cotisations    REAL    NOT NULL DEFAULT 0,
  donnees              TEXT    NOT NULL,
  statut               TEXT    NOT NULL DEFAULT 'Brouillon',
  date_depot           TEXT,
  created_at           TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (periode_debut, periode_fin)
);

-- Registre des actes établis : chaque acte produit est figé (copie exacte du
-- document imprimé) et rangé avec son code, réimprimable à l'identique.
CREATE TABLE IF NOT EXISTS documents (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  reference    TEXT    NOT NULL,
  employee_id  INTEGER NOT NULL,
  employee_nom TEXT    NOT NULL,
  type_acte    TEXT    NOT NULL,
  libelle      TEXT    NOT NULL,
  categorie    TEXT    NOT NULL DEFAULT 'interne',
  orientation  TEXT    NOT NULL DEFAULT 'portrait',
  corps        TEXT    NOT NULL,
  options      TEXT,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  UNIQUE (employee_id, reference)
);
CREATE INDEX IF NOT EXISTS idx_documents_employee ON documents(employee_id);

-- Comptes de l'installation (plusieurs utilisateurs par poste). Le mot de passe
-- et la réponse de secours sont hachés (scrypt « sel:hash »), jamais en clair.
-- Le compte « concepteur » (maître universel) n'est PAS ici : il vit dans le code.
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

CREATE TABLE IF NOT EXISTS presences (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id  INTEGER NOT NULL,
  date         TEXT    NOT NULL,
  code         TEXT    NOT NULL,
  commentaire  TEXT,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  UNIQUE (employee_id, date)
);
CREATE INDEX IF NOT EXISTS idx_presences_date ON presences(date);
`
