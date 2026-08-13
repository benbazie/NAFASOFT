import { randomBytes, scryptSync, timingSafeEqual } from 'crypto'
import { ouvrirRegistre } from './db/employeurs'
import { CONCEPTEUR_USERNAME, estConcepteur, verifierMaitre } from './concepteur'
import type {
  AuthStatus,
  NouvelUtilisateur,
  ResultatLogin,
  RoleUtilisateur,
  Utilisateur
} from '../shared/types'

// Mots de passe et réponses de secours ne sont jamais stockés en clair : on
// conserve « sel:hash » (scrypt) et on compare à temps constant.

function hacher(secret: string): string {
  const sel = randomBytes(16)
  const hash = scryptSync(secret, sel, 64)
  return `${sel.toString('hex')}:${hash.toString('hex')}`
}

function verifier(secret: string, stocke: string | null | undefined): boolean {
  if (!stocke) return false
  const [selHex, hashHex] = stocke.split(':')
  if (!selHex || !hashHex) return false
  const attendu = Buffer.from(hashHex, 'hex')
  const candidat = scryptSync(secret, Buffer.from(selHex, 'hex'), 64)
  return attendu.length === candidat.length && timingSafeEqual(attendu, candidat)
}

const norm = (u: string): string => (u ?? '').trim().toLowerCase()

/**
 * Base des comptes : le REGISTRE, pas la base de l'employeur ouvert.
 *
 * Un comptable ouvre une session une seule fois puis passe d'un client a
 * l'autre ; et la connexion doit fonctionner au demarrage, quand aucune base
 * employeur n'est encore ouverte.
 */
const baseComptes = ouvrirRegistre

interface RangUser {
  id: number
  username: string
  nom: string
  role: RoleUtilisateur
  pass: string
  must_change: number
  question: string | null
  reponse: string | null
  created_at: string
  updated_at: string
}

function mapUser(r: RangUser): Utilisateur {
  return {
    id: r.id,
    username: r.username,
    nom: r.nom,
    role: r.role,
    must_change: !!r.must_change,
    question: r.question,
    a_recuperation: Boolean(r.reponse),
    created_at: r.created_at,
    updated_at: r.updated_at
  }
}

function rang(username: string): RangUser | undefined {
  return baseComptes().prepare('SELECT * FROM users WHERE username = ?').get(norm(username)) as
    | RangUser
    | undefined
}

function nbAdmins(saufId?: number): number {
  return (
    baseComptes()
      .prepare(`SELECT COUNT(*) AS n FROM users WHERE role = 'administrateur' AND id <> ?`)
      .get(saufId ?? -1) as { n: number }
  ).n
}

/** Gestion des comptes de l'installation (hors compte maître concepteur). */
export const usersRepo = {
  count(): number {
    return (baseComptes().prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number }).n
  },

  list(): Utilisateur[] {
    const rows = baseComptes()
      .prepare('SELECT * FROM users ORDER BY role, nom')
      .all() as RangUser[]
    return rows.map(mapUser)
  },

  get(username: string): Utilisateur | undefined {
    const r = rang(username)
    return r ? mapUser(r) : undefined
  },

  /** Crée un compte. `username` doit être unique et n'est pas « concepteur ». */
  create(u: NouvelUtilisateur, mustChange = false): Utilisateur {
    const username = norm(u.username)
    if (username.length < 3) throw new Error('L’identifiant doit contenir au moins 3 caractères.')
    if (estConcepteur(username)) throw new Error('L’identifiant « concepteur » est réservé.')
    if (!u.motDePasse || u.motDePasse.length < 4)
      throw new Error('Le mot de passe doit contenir au moins 4 caractères.')
    if (rang(username)) throw new Error('Cet identifiant existe déjà.')
    const role: RoleUtilisateur = u.role === 'administrateur' ? 'administrateur' : 'utilisateur'
    baseComptes()
      .prepare(
        `INSERT INTO users (username, nom, role, pass, must_change)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(username, u.nom.trim() || username, role, hacher(u.motDePasse), mustChange ? 1 : 0)
    return this.get(username)!
  },

  setRole(id: number, role: RoleUtilisateur): void {
    const r = role === 'administrateur' ? 'administrateur' : 'utilisateur'
    // On ne rétrograde pas le dernier administrateur : l'installation resterait
    // sans personne pour gérer les comptes.
    const actuel = baseComptes().prepare('SELECT role FROM users WHERE id = ?').get(id) as
      | { role: string }
      | undefined
    if (actuel?.role === 'administrateur' && r !== 'administrateur' && nbAdmins(id) === 0) {
      throw new Error('Impossible : c’est le dernier administrateur.')
    }
    baseComptes()
      .prepare(`UPDATE users SET role = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(r, id)
  },

  /** Réinitialisation par un administrateur : nouveau mot de passe provisoire. */
  resetPassword(id: number, nouveau: string): void {
    if (!nouveau || nouveau.length < 4)
      throw new Error('Le mot de passe doit contenir au moins 4 caractères.')
    baseComptes()
      .prepare(`UPDATE users SET pass = ?, must_change = 1, updated_at = datetime('now') WHERE id = ?`)
      .run(hacher(nouveau), id)
  },

  /** Définit la question / réponse de secours d'un compte (auto-récupération). */
  setRecovery(username: string, question: string, reponse: string): void {
    if (!question.trim() || reponse.trim().length < 2)
      throw new Error('Renseignez une question et une réponse d’au moins 2 caractères.')
    baseComptes()
      .prepare(
        `UPDATE users SET question = ?, reponse = ?, updated_at = datetime('now') WHERE username = ?`
      )
      .run(question.trim(), hacher(reponse.trim().toLowerCase()), norm(username))
  },

  remove(id: number): void {
    const r = baseComptes().prepare('SELECT role FROM users WHERE id = ?').get(id) as
      | { role: string }
      | undefined
    if (r?.role === 'administrateur' && nbAdmins(id) === 0) {
      throw new Error('Impossible : c’est le dernier administrateur.')
    }
    baseComptes().prepare('DELETE FROM users WHERE id = ?').run(id)
  }
}

/** Authentification : état, première configuration, connexion, récupération. */
export const authRepo = {
  status(): AuthStatus {
    return { configure: usersRepo.count() > 0 }
  },

  /** Première configuration : crée le premier administrateur (le gérant). */
  setupPremier(username: string, nom: string, motDePasse: string): ResultatLogin {
    if (usersRepo.count() > 0) return { ok: false, erreur: 'L’installation est déjà configurée.' }
    const u = usersRepo.create(
      { username, nom, role: 'administrateur', motDePasse },
      false
    )
    return {
      ok: true,
      session: { username: u.username, nom: u.nom, role: u.role, must_change: false, concepteur: false }
    }
  },

  /** Connexion : compte maître universel d'abord, puis comptes locaux. */
  login(username: string, motDePasse: string): ResultatLogin {
    if (estConcepteur(username)) {
      return verifierMaitre(motDePasse)
        ? {
            ok: true,
            session: {
              username: CONCEPTEUR_USERNAME,
              nom: 'Concepteur Nafasoft',
              role: 'concepteur',
              must_change: false,
              concepteur: true
            }
          }
        : { ok: false, erreur: 'Mot de passe maître incorrect.' }
    }
    const r = rang(username)
    if (!r || !verifier(motDePasse, r.pass)) {
      return { ok: false, erreur: 'Identifiant ou mot de passe incorrect.' }
    }
    return {
      ok: true,
      session: {
        username: r.username,
        nom: r.nom,
        role: r.role,
        must_change: !!r.must_change,
        concepteur: false
      }
    }
  },

  /** Changement de son propre mot de passe (efface l'obligation de changer). */
  changePassword(username: string, ancien: string, nouveau: string): void {
    if (estConcepteur(username)) {
      throw new Error('Le mot de passe maître se change dans le code (npm run maitre).')
    }
    const r = rang(username)
    if (!r || !verifier(ancien, r.pass)) throw new Error('Ancien mot de passe incorrect.')
    if (!nouveau || nouveau.length < 4)
      throw new Error('Le nouveau mot de passe doit contenir au moins 4 caractères.')
    baseComptes()
      .prepare(`UPDATE users SET pass = ?, must_change = 0, updated_at = datetime('now') WHERE id = ?`)
      .run(hacher(nouveau), r.id)
  },

  /** Renvoie la question de secours d'un compte, si elle est configurée. */
  recoverStart(username: string): { question: string } | null {
    const r = rang(username)
    return r && r.question && r.reponse ? { question: r.question } : null
  },

  /** Auto-récupération : vérifie la réponse de secours et fixe un nouveau mot de passe. */
  recover(username: string, reponse: string, nouveau: string): boolean {
    const r = rang(username)
    if (!r || !r.reponse) return false
    if (!verifier(reponse.trim().toLowerCase(), r.reponse)) return false
    if (!nouveau || nouveau.length < 4)
      throw new Error('Le nouveau mot de passe doit contenir au moins 4 caractères.')
    baseComptes()
      .prepare(`UPDATE users SET pass = ?, must_change = 0, updated_at = datetime('now') WHERE id = ?`)
      .run(hacher(nouveau), r.id)
    return true
  }
}
