import Database from 'better-sqlite3'
import { app, dialog, BrowserWindow, shell } from 'electron'
import { basename, join } from 'path'
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'fs'
import { dossierDonnees, employeursRepo } from './db/employeurs'
import { dossierPiecesEmployeur, listerPieces } from './fichiers'
import { employeurOuvert, ouvrirBaseEmployeur, fermerBaseEmployeur } from './db'
import type { Manifeste, ManifesteEmployeur, ResultatSauvegarde } from '../shared/types'

/**
 * Sauvegarde et restauration.
 *
 * Une sauvegarde est un DOSSIER, pas une archive compressée : on peut l'ouvrir,
 * y lire le manifeste et vérifier ce qu'elle contient sans aucun outil. C'est
 * ce qui compte quand un cabinet doit rendre à un client la base qui lui
 * appartient, ou quand quelqu'un doit récupérer des données six ans plus tard.
 *
 * Les fichiers ne sont jamais copiés à l'octet : SQLite est ouvert et recopié
 * par son API de sauvegarde en ligne. Une copie brute d'une base en mode WAL
 * peut être tronquée — elle s'ouvrirait sans erreur, avec les dernières
 * écritures manquantes, ce qui est bien pire qu'un échec franc.
 */

const NOM_MANIFESTE = 'manifeste.json'
const FORMAT = 1

function horodatage(): string {
  const d = new Date()
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`
}

function assainir(nom: string): string {
  return nom
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9 -]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 40) || 'dossier'
}

/**
 * Recopie une base SQLite par l'API de sauvegarde en ligne.
 * Fonctionne même si la base est en cours d'utilisation.
 */
async function copierBase(source: string, cible: string): Promise<number> {
  const db = new Database(source, { readonly: true, fileMustExist: true })
  try {
    await db.backup(cible)
  } finally {
    db.close()
  }
  return statSync(cible).size
}

/** Quelques compteurs pour que le manifeste soit lisible par un humain. */
function compter(chemin: string): { effectif: number; bulletins: number } {
  let db: Database.Database | null = null
  try {
    db = new Database(chemin, { readonly: true, fileMustExist: true })
    const un = (sql: string): number => {
      try {
        return (db!.prepare(sql).get() as { n: number }).n
      } catch {
        return 0
      }
    }
    return {
      effectif: un(`SELECT COUNT(*) AS n FROM employees WHERE statut = 'actif'`),
      bulletins: un(`SELECT COUNT(*) AS n FROM payslips`)
    }
  } catch {
    return { effectif: 0, bulletins: 0 }
  } finally {
    db?.close()
  }
}

function copierPieces(fichiers: string[], cible: string): number {
  if (fichiers.length === 0) return 0
  mkdirSync(cible, { recursive: true })
  let n = 0
  for (const f of fichiers) {
    try {
      copyFileSync(f, join(cible, basename(f)))
      n++
    } catch {
      /* pièce illisible : on continue, la sauvegarde vaut mieux qu'un abandon */
    }
  }
  return n
}

/** Recopie `pieces/<id>` d'une sauvegarde vers le dossier d'un employeur. */
function restituerPieces(sauvegarde: string, idSource: number, idCible: number): void {
  const source = join(sauvegarde, 'pieces', String(idSource))
  if (!existsSync(source)) return
  const cible = dossierPiecesEmployeur(idCible)
  for (const f of readdirSync(source)) copyFileSync(join(source, f), join(cible, f))
}

/**
 * Crée une sauvegarde dans `destination`.
 * `employeurId` absent = tout le portefeuille (registre compris).
 */
export async function sauvegarder(
  destination: string,
  employeurId?: number
): Promise<ResultatSauvegarde> {
  const cibles = employeurId
    ? [employeursRepo.get(employeurId)].filter((e): e is NonNullable<typeof e> => Boolean(e))
    : employeursRepo.list(true)

  if (cibles.length === 0) throw new Error('Aucun dossier à sauvegarder.')

  const etiquette = employeurId ? assainir(cibles[0].nom) : 'portefeuille'
  const dossier = join(destination, `Nafasoft-${etiquette}-${horodatage()}`)
  mkdirSync(dossier, { recursive: true })

  const employeurs: ManifesteEmployeur[] = []
  let octets = 0
  let nbPieces = 0

  for (const e of cibles) {
    const source = join(dossierDonnees(), e.fichier)
    if (!existsSync(source)) continue
    const taille = await copierBase(source, join(dossier, e.fichier))
    octets += taille
    // Les pièces suivent leur employeur, dans `pieces/<id>` : deux clients
    // peuvent avoir un fichier de même nom sans que l'un écrase l'autre.
    nbPieces += copierPieces(listerPieces(e.id), join(dossier, 'pieces', String(e.id)))
    employeurs.push({
      id: e.id,
      nom: e.nom,
      ville: e.ville,
      numero_cnss: e.numero_cnss,
      couleur: e.couleur,
      fichier: e.fichier,
      taille,
      ...compter(source)
    })
  }

  // Le registre n'accompagne que la sauvegarde complète : l'export d'un seul
  // client ne doit rien révéler des autres dossiers du cabinet.
  if (!employeurId) {
    const registre = join(dossierDonnees(), 'registre.db')
    if (existsSync(registre)) octets += await copierBase(registre, join(dossier, 'registre.db'))
  }

  const manifeste: Manifeste = {
    produit: 'Nafasoft',
    version: app.getVersion(),
    format: FORMAT,
    type: employeurId ? 'employeur' : 'portefeuille',
    cree_le: new Date().toISOString(),
    employeurs,
    pieces: nbPieces
  }
  writeFileSync(join(dossier, NOM_MANIFESTE), JSON.stringify(manifeste, null, 2), 'utf-8')

  employeursRepo.ecrireReglage('derniere_sauvegarde', manifeste.cree_le)
  return { dossier, manifeste, octets }
}

/** Lit le manifeste d'une sauvegarde sans rien restaurer. */
export function inspecter(dossier: string): Manifeste | null {
  const f = join(dossier, NOM_MANIFESTE)
  if (!existsSync(f)) return null
  try {
    const m = JSON.parse(readFileSync(f, 'utf-8')) as Manifeste
    if (m.produit !== 'Nafasoft' || m.format > FORMAT) return null
    return m
  } catch {
    return null
  }
}

/**
 * Copie de sûreté de l'état actuel, prise juste avant d'écraser quoi que ce
 * soit. Une restauration qui part d'une mauvaise sauvegarde reste rattrapable.
 */
async function filetDeSecurite(): Promise<string> {
  const abri = join(app.getPath('userData'), 'avant-restauration')
  mkdirSync(abri, { recursive: true })
  const { dossier } = await sauvegarder(abri)
  return dossier
}

/**
 * Restauration complète du portefeuille : le registre et toutes les bases sont
 * remplacés par ceux de la sauvegarde. La base ouverte est refermée d'abord —
 * écraser un fichier SQLite ouvert corrompt la base et fige l'application.
 */
export async function restaurerPortefeuille(dossier: string): Promise<{ abri: string; manifeste: Manifeste }> {
  const manifeste = inspecter(dossier)
  if (!manifeste) throw new Error('Ce dossier ne contient pas de sauvegarde Nafasoft lisible.')
  if (manifeste.type !== 'portefeuille') {
    throw new Error('Cette sauvegarde ne concerne qu’un seul dossier : utilisez l’import de dossier.')
  }

  const abri = await filetDeSecurite()
  fermerBaseEmployeur()

  const cible = dossierDonnees()
  for (const f of readdirSync(dossier)) {
    if (!f.endsWith('.db')) continue
    await copierBase(join(dossier, f), join(cible, f))
  }

  for (const e of manifeste.employeurs) restituerPieces(dossier, e.id, e.id)

  return { abri, manifeste }
}

/**
 * Importe le dossier d'un seul employeur.
 *
 * `remplacerId` absent : le dossier entre comme NOUVEAU client — c'est le cas
 * d'un employeur qui change de cabinet, ou d'un client qui reprend la main sur
 * sa propre paie. Sinon on écrase le dossier désigné, sa fiche d'identité
 * restant celle du registre local.
 */
export async function importerEmployeur(
  dossier: string,
  remplacerId?: number
): Promise<{ id: number; nom: string; abri: string | null }> {
  const manifeste = inspecter(dossier)
  if (!manifeste || manifeste.employeurs.length === 0) {
    throw new Error('Ce dossier ne contient pas de sauvegarde Nafasoft lisible.')
  }
  const src = manifeste.employeurs[0]
  const fichierSource = join(dossier, src.fichier)
  if (!existsSync(fichierSource)) throw new Error(`Base absente de la sauvegarde : ${src.fichier}`)

  const abri = remplacerId ? await filetDeSecurite() : null
  const ouvert = employeurOuvert()
  if (remplacerId && ouvert === remplacerId) fermerBaseEmployeur()

  let id = remplacerId ?? 0
  if (!remplacerId) {
    // Un nom déjà pris devient « Nom (importé) » : deux cartes identiques dans
    // le portefeuille seraient impossibles à départager.
    const pris = employeursRepo.list(true).some((e) => e.nom === src.nom)
    id = employeursRepo.create({
      nom: pris ? `${src.nom} (importé)` : src.nom,
      ville: src.ville,
      numero_cnss: src.numero_cnss,
      couleur: src.couleur
    }).id
  }

  await copierBase(fichierSource, employeursRepo.chemin(id))

  // Les pièces changent de dossier avec la base : l'identifiant local diffère
  // de celui de la machine d'origine.
  restituerPieces(dossier, src.id, id)

  // On rouvre ce qui était ouvert, pour que l'interface reste utilisable.
  if (ouvert !== null && employeurOuvert() === null) {
    ouvrirBaseEmployeur(employeursRepo.chemin(ouvert), ouvert)
  }

  return { id, nom: employeursRepo.get(id)?.nom ?? src.nom, abri }
}

/** Date ISO de la dernière sauvegarde, ou null si aucune n'a jamais été faite. */
export function derniereSauvegarde(): string | null {
  return employeursRepo.lireReglage('derniere_sauvegarde')
}

// --- Boîtes de dialogue système -------------------------------------------

function fenetre(): BrowserWindow | undefined {
  return BrowserWindow.getFocusedWindow() ?? undefined
}

export async function choisirDestination(): Promise<string | null> {
  const { canceled, filePaths } = await dialog.showOpenDialog(fenetre()!, {
    title: 'Où enregistrer la sauvegarde ?',
    properties: ['openDirectory', 'createDirectory'],
    buttonLabel: 'Sauvegarder ici'
  })
  return canceled || filePaths.length === 0 ? null : filePaths[0]
}

export async function choisirSauvegarde(): Promise<{ dossier: string; manifeste: Manifeste } | null> {
  const { canceled, filePaths } = await dialog.showOpenDialog(fenetre()!, {
    title: 'Choisir une sauvegarde Nafasoft',
    properties: ['openDirectory'],
    buttonLabel: 'Examiner'
  })
  if (canceled || filePaths.length === 0) return null
  const manifeste = inspecter(filePaths[0])
  if (!manifeste) throw new Error('Ce dossier ne contient pas de sauvegarde Nafasoft (manifeste.json absent ou illisible).')
  return { dossier: filePaths[0], manifeste }
}

export function ouvrirDossier(chemin: string): void {
  void shell.openPath(chemin)
}

/**
 * Sauvegarde automatique au premier lancement d'une nouvelle version.
 *
 * Une mise à jour par clé USB s'installe par-dessus l'ancienne : le programme
 * est remplacé, les données restent. Mais la nouvelle version peut faire migrer
 * le schéma dès l'ouverture — et si cette migration se passe mal chez un client
 * hors ligne, il n'y a personne pour le rattraper. On prend donc une copie
 * AVANT, une seule fois par version, et on la garde à côté des données.
 *
 * En cas d'échec, on n'empêche pas le démarrage : une sauvegarde ratée ne doit
 * pas priver le client de son logiciel. Le message dans la console suffit.
 */
export async function sauvegardeDeMiseAJour(): Promise<string | null> {
  const version = app.getVersion()
  const derniere = employeursRepo.lireReglage('version_app')
  if (derniere === version) return null

  // Première installation : rien à sauvegarder, on note simplement la version.
  if (!derniere || employeursRepo.list(true).length === 0) {
    employeursRepo.ecrireReglage('version_app', version)
    return null
  }

  try {
    const abri = join(app.getPath('userData'), 'avant-mise-a-jour')
    mkdirSync(abri, { recursive: true })
    const { dossier, manifeste } = await sauvegarder(abri)
    employeursRepo.ecrireReglage('version_app', version)
    console.log(
      `[mise à jour] ${derniere} → ${version} : ${manifeste.employeurs.length} dossier(s) ` +
        `sauvegardés avant migration dans ${dossier}`
    )
    return dossier
  } catch (err) {
    console.error(
      `[mise à jour] La sauvegarde préalable a échoué (${(err as Error).message}). ` +
        `Le démarrage continue — vérifiez vos données et sauvegardez manuellement.`
    )
    employeursRepo.ecrireReglage('version_app', version)
    return null
  }
}
