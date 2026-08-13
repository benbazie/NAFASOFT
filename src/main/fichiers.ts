import Database from 'better-sqlite3'
import { dialog, shell, BrowserWindow, app } from 'electron'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  unlinkSync
} from 'fs'
import { basename, extname, isAbsolute, join } from 'path'
import { dossierDonnees } from './db/employeurs'

/**
 * Pièces jointes des salariés (CNIB, diplômes, certificats).
 *
 * Chaque employeur a SON dossier de pièces, à côté de sa base, et la base ne
 * retient que le nom du fichier. Deux raisons :
 *
 * - supprimer un client efface aussi ses pièces, au lieu de laisser des
 *   fichiers orphelins dans un pot commun à tous les employeurs ;
 * - un dossier exporté reste ouvrable sur une autre machine. Un chemin absolu
 *   désignait un emplacement inexistant chez le destinataire, et les pièces
 *   devenaient introuvables sans le moindre message.
 */

/** Dossier des pièces d'un employeur donné. */
export function dossierPiecesEmployeur(employeurId: number): string {
  const d = join(dossierDonnees(), `pieces-${employeurId}`)
  if (!existsSync(d)) mkdirSync(d, { recursive: true })
  return d
}

/**
 * Chemin réel d'une pièce à partir de ce que contient la base.
 *
 * Un chemin absolu vient d'avant le rangement par employeur : on le respecte
 * tel quel, pour que rien ne devienne inaccessible entre-temps.
 */
export function cheminPiece(valeur: string, employeurId: number | null): string {
  if (isAbsolute(valeur) || employeurId === null) return valeur
  return join(dossierPiecesEmployeur(employeurId), valeur)
}

/**
 * Range les pièces d'un employeur qu'on vient d'ouvrir : les fichiers encore
 * désignés par un chemin absolu rejoignent son dossier, et la base ne garde
 * plus que leur nom. Idempotent — sans effet au second passage.
 */
export function rangerPieces(db: Database.Database, employeurId: number): number {
  let lignes: { id: number; fichier: string }[]
  try {
    lignes = db.prepare('SELECT id, fichier FROM employee_documents').all() as typeof lignes
  } catch {
    return 0
  }
  const aRanger = lignes.filter((l) => l.fichier && isAbsolute(l.fichier))
  if (aRanger.length === 0) return 0

  const cible = dossierPiecesEmployeur(employeurId)
  const maj = db.prepare('UPDATE employee_documents SET fichier = ? WHERE id = ?')
  let ranges = 0

  for (const l of aRanger) {
    const nom = basename(l.fichier)
    const destination = join(cible, nom)
    if (existsSync(l.fichier)) {
      try {
        if (!existsSync(destination)) renameSync(l.fichier, destination)
      } catch {
        // Volume différent ou fichier verrouillé : une copie fait aussi bien.
        try {
          copyFileSync(l.fichier, destination)
        } catch {
          continue // illisible : on laisse la ligne intacte plutôt que de mentir
        }
      }
    } else if (!existsSync(destination)) {
      continue // fichier déjà perdu : réécrire le chemin n'y changerait rien
    }
    maj.run(nom, l.id)
    ranges++
  }

  if (ranges > 0) {
    console.log(`[pièces] ${ranges} pièce(s) rangée(s) pour l'employeur ${employeurId}.`)
  }
  return ranges
}

/** Supprime le dossier de pièces d'un employeur (suppression du client). */
export function supprimerPiecesEmployeur(employeurId: number): void {
  const d = join(dossierDonnees(), `pieces-${employeurId}`)
  if (!existsSync(d)) return
  try {
    rmSync(d, { recursive: true, force: true })
  } catch {
    /* dossier verrouillé : il partira au prochain démarrage */
  }
}

/** Pièces présentes dans le dossier d'un employeur (pour la sauvegarde). */
export function listerPieces(employeurId: number): string[] {
  const d = join(dossierDonnees(), `pieces-${employeurId}`)
  if (!existsSync(d)) return []
  return readdirSync(d).map((f) => join(d, f))
}

const EXT_IMAGES = ['png', 'jpg', 'jpeg', 'webp']

/**
 * Demande une image à l'utilisateur et la renvoie encodée en data URI.
 * Le redimensionnement est fait côté interface, où le canvas est disponible.
 */
export async function choisirImage(): Promise<string | null> {
  const fenetre = BrowserWindow.getFocusedWindow() ?? undefined
  const { canceled, filePaths } = await dialog.showOpenDialog(fenetre!, {
    title: 'Choisir une photo',
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: EXT_IMAGES }]
  })
  if (canceled || filePaths.length === 0) return null

  const chemin = filePaths[0]
  const ext = extname(chemin).slice(1).toLowerCase()
  const mime = ext === 'jpg' ? 'jpeg' : ext
  return `data:image/${mime};base64,${readFileSync(chemin).toString('base64')}`
}

export interface PieceChoisie {
  nom: string
  fichier: string
  taille: number
}

/**
 * Demande un document et le recopie dans le dossier de l'employeur, pour que
 * la pièce reste disponible même si l'original est déplacé ou supprimé.
 * La valeur rendue est le NOM du fichier, jamais son chemin complet.
 */
export async function joindreFichier(
  employeeId: number,
  employeurId: number
): Promise<PieceChoisie | null> {
  const fenetre = BrowserWindow.getFocusedWindow() ?? undefined
  const { canceled, filePaths } = await dialog.showOpenDialog(fenetre!, {
    title: 'Joindre un document',
    properties: ['openFile'],
    filters: [
      { name: 'Documents', extensions: ['pdf', 'doc', 'docx', ...EXT_IMAGES] },
      { name: 'Tous les fichiers', extensions: ['*'] }
    ]
  })
  if (canceled || filePaths.length === 0) return null

  const source = filePaths[0]
  const nom = basename(source)
  // Nom unique : l'employé, l'horodatage puis le nom d'origine.
  const fichier = `${employeeId}-${Date.now()}-${nom}`
  const cible = join(dossierPiecesEmployeur(employeurId), fichier)
  copyFileSync(source, cible)
  return { nom, fichier, taille: statSync(cible).size }
}

/** Ouvre une pièce jointe avec l'application par défaut du système. */
export async function ouvrirFichier(valeur: string, employeurId: number | null): Promise<string> {
  const chemin = cheminPiece(valeur, employeurId)
  if (!existsSync(chemin)) return 'Le fichier est introuvable : il a peut-être été supprimé.'
  return shell.openPath(chemin)
}

/** Supprime le fichier d'une pièce jointe (sans toucher à la ligne en base). */
export function supprimerFichier(valeur: string, employeurId: number | null): void {
  const chemin = cheminPiece(valeur, employeurId)
  if (existsSync(chemin)) unlinkSync(chemin)
}
