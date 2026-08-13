import Database from 'better-sqlite3'
import { existsSync } from 'fs'
import { ipcMain, BrowserWindow, app } from 'electron'
import {
  employeesRepo,
  shiftsRepo,
  leavesRepo,
  timeEntriesRepo,
  payrollRepo,
  contractsRepo,
  employeeDocsRepo,
  payslipsRepo,
  rappelRepo,
  elementsRepo,
  declarationsArchiveRepo,
  declarationsRepo,
  presencesRepo,
  documentsRepo,
  settingsRepo,
  getDashboardPanorama
} from './db/repositories'
import { authRepo, usersRepo } from './auth'
import { employeursRepo, dossierDonnees } from './db/employeurs'
import { bilanPortefeuille } from './db/portefeuille'
import {
  sauvegarder,
  restaurerPortefeuille,
  importerEmployeur,
  derniereSauvegarde,
  choisirDestination,
  choisirSauvegarde,
  ouvrirDossier
} from './sauvegarde'
import { ouvrirBaseEmployeur, fermerBaseEmployeur, employeurOuvert } from './db'
import { saveCsv } from './export'
import {
  choisirImage,
  joindreFichier,
  ouvrirFichier,
  supprimerFichier,
  rangerPieces
} from './fichiers'
import type {
  EmployeeInput,
  ShiftInput,
  LeaveInput,
  TimeEntryInput,
  GenerateWeekOptions,
  PayrollParams,
  PayrollSettings,
  PresenceInput,
  ContractInput,
  DeclarationDto,
  ElementPaieInput,
  ActeDocumentInput,
  NouvelUtilisateur,
  RoleUtilisateur,
  EmployeurInput
} from '../shared/types'

/**
 * Enregistre tous les handlers IPC. Chaque canal correspond à une opération métier.
 * Les erreurs sont laissées remonter : elles seront transmises au renderer par ipcRenderer.invoke.
 */
/**
 * Aligne le nom du registre sur la raison sociale saisie dans les réglages du
 * client. Le registre reste la source du portefeuille (il doit rester lisible
 * sans ouvrir aucune base), mais il ne doit jamais contredire la fiche que
 * l'utilisateur vient de remplir.
 */
/**
 * Écrit l'identité saisie dans le portefeuille DANS la base du dossier.
 *
 * Le nom de l'entreprise a une seule source de vérité : les réglages de sa
 * propre base, puisque c'est lui qui s'imprime sur les bulletins et les
 * déclarations. Le portefeuille doit donc l'y inscrire, et non le garder pour
 * lui — sinon on nomme un client « BELLE OUVRAGE » dans le portefeuille, ses
 * documents sortent au nom d'une autre entreprise, et l'ouverture du dossier
 * remplace le nom saisi par celui des réglages.
 */
function appliquerIdentiteAuDossier(id: number, d: EmployeurInput): void {
  const chemin = employeursRepo.chemin(id)
  if (!existsSync(chemin)) return

  const ecrire = (lire: () => string | null, sauver: (v: string) => void): void => {
    let config: Record<string, unknown> = {}
    try {
      const brut = lire()
      if (brut) config = JSON.parse(brut) as Record<string, unknown>
    } catch {
      /* réglages illisibles : on repart d'un objet vide plutôt que d'abandonner */
    }
    config.entreprise_nom = d.nom.trim()
    if (d.ville) config.entreprise_ville = d.ville
    if (d.numero_cnss) config.numero_employeur_cnss = d.numero_cnss
    sauver(JSON.stringify(config))
  }

  if (employeurOuvert() === id) {
    ecrire(
      () => settingsRepo.get('config'),
      (v) => settingsRepo.set('config', v)
    )
    return
  }

  // Dossier fermé : on l'ouvre le temps d'écrire, puis on le referme aussitôt.
  const db = new Database(chemin)
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS settings (cle TEXT PRIMARY KEY, valeur TEXT)`)
    ecrire(
      () =>
        (db.prepare(`SELECT valeur FROM settings WHERE cle = 'config'`).get() as
          | { valeur: string | null }
          | undefined)?.valeur ?? null,
      (v) =>
        db
          .prepare(
            `INSERT INTO settings (cle, valeur) VALUES ('config', ?)
             ON CONFLICT(cle) DO UPDATE SET valeur = excluded.valeur`
          )
          .run(v)
    )
  } finally {
    db.close()
  }
}

function synchroniserNom(id: number): void {
  const brut = settingsRepo.get('config')
  if (!brut) return
  try {
    const nom = (JSON.parse(brut) as { entreprise_nom?: string }).entreprise_nom?.trim()
    const actuel = employeursRepo.get(id)
    if (!nom || nom.length < 2 || !actuel || actuel.nom === nom) return
    employeursRepo.update(id, {
      nom,
      numero_cnss: actuel.numero_cnss,
      ville: actuel.ville,
      couleur: actuel.couleur,
      logo: actuel.logo
    })
  } catch {
    /* réglages illisibles : on garde le nom du registre */
  }
}

export function registerIpcHandlers(): void {
  // --- Fenêtre ---
  // Le titre de la fenêtre porte le nom du client (« Entreprise · Nafasoft ») :
  // le renderer le pousse une fois la config chargée. On retrouve la fenêtre
  // par son webContents plutôt que de la plomber jusqu'ici.
  ipcMain.on('window:setTitle', (e, titre: string) => {
    BrowserWindow.fromWebContents(e.sender)?.setTitle(titre)
  })

  // --- Employés ---
  ipcMain.handle('employees:list', (_e, includeInactive: boolean) => employeesRepo.list(includeInactive))
  ipcMain.handle('employees:get', (_e, id: number) => employeesRepo.get(id))
  ipcMain.handle('employees:create', (_e, data: EmployeeInput) => employeesRepo.create(data))
  ipcMain.handle('employees:update', (_e, id: number, data: EmployeeInput) => employeesRepo.update(id, data))
  ipcMain.handle('employees:remove', (_e, id: number) => employeesRepo.remove(id))

  // --- Planning ---
  ipcMain.handle('shifts:listByRange', (_e, start: string, end: string) => shiftsRepo.listByRange(start, end))
  ipcMain.handle('shifts:listByDate', (_e, date: string) => shiftsRepo.listByDate(date))
  ipcMain.handle('shifts:create', (_e, data: ShiftInput) => shiftsRepo.create(data))
  ipcMain.handle('shifts:update', (_e, id: number, data: ShiftInput) => shiftsRepo.update(id, data))
  ipcMain.handle('shifts:remove', (_e, id: number) => shiftsRepo.remove(id))
  ipcMain.handle('shifts:generateWeek', (_e, opts: GenerateWeekOptions) => shiftsRepo.generateWeek(opts))

  // --- Congés / absences ---
  ipcMain.handle('leaves:list', () => leavesRepo.list())
  ipcMain.handle('leaves:create', (_e, data: LeaveInput) => leavesRepo.create(data))
  ipcMain.handle('leaves:update', (_e, id: number, data: LeaveInput) => leavesRepo.update(id, data))
  ipcMain.handle('leaves:setStatus', (_e, id: number, statut: string) => leavesRepo.setStatus(id, statut))
  ipcMain.handle('leaves:remove', (_e, id: number) => leavesRepo.remove(id))

  // --- Pointage ---
  ipcMain.handle('time:listByRange', (_e, start: string, end: string) => timeEntriesRepo.listByRange(start, end))
  ipcMain.handle('time:create', (_e, data: TimeEntryInput) => timeEntriesRepo.create(data))
  ipcMain.handle('time:update', (_e, id: number, data: TimeEntryInput) => timeEntriesRepo.update(id, data))
  ipcMain.handle('time:remove', (_e, id: number) => timeEntriesRepo.remove(id))

  // --- Paie ---
  ipcMain.handle('payroll:compute', (_e, params: PayrollParams) => payrollRepo.compute(params))

  // --- Photo & pièces jointes ---
  ipcMain.handle('files:chooseImage', () => choisirImage())
  ipcMain.handle('docs:listByEmployee', (_e, id: number) => employeeDocsRepo.listByEmployee(id))
  ipcMain.handle('docs:attach', async (_e, employeeId: number, type: string, notes: string | null) => {
    const employeur = employeurOuvert()
    if (employeur === null) throw new Error('Aucun dossier ouvert.')
    const piece = await joindreFichier(employeeId, employeur)
    if (!piece) return null
    return employeeDocsRepo.create({
      employee_id: employeeId,
      type: type as never,
      nom: piece.nom,
      fichier: piece.fichier,
      taille: piece.taille,
      notes
    })
  })
  ipcMain.handle('docs:open', (_e, chemin: string) => ouvrirFichier(chemin, employeurOuvert()))
  ipcMain.handle('docs:remove', (_e, id: number) => {
    const doc = employeeDocsRepo.get(id)
    if (doc) supprimerFichier(doc.fichier, employeurOuvert())
    employeeDocsRepo.remove(id)
  })

  // --- Contrats ---
  ipcMain.handle('contracts:list', () => contractsRepo.list())
  ipcMain.handle('contracts:listByEmployee', (_e, id: number) => contractsRepo.listByEmployee(id))
  ipcMain.handle('contracts:get', (_e, id: number) => contractsRepo.get(id))
  ipcMain.handle('contracts:nextReference', (_e, type: string, annee: string) =>
    contractsRepo.nextReference(type, annee)
  )
  ipcMain.handle('contracts:create', (_e, data: ContractInput) => contractsRepo.create(data))
  ipcMain.handle('contracts:update', (_e, id: number, data: ContractInput) =>
    contractsRepo.update(id, data)
  )
  ipcMain.handle('contracts:remove', (_e, id: number) => contractsRepo.remove(id))
  ipcMain.handle('contracts:cloturerEchus', () => contractsRepo.cloturerEchus())

  // --- Éléments de paie (primes, indemnités, retenues) ---
  ipcMain.handle('elements:listByEmployee', (_e, id: number) => elementsRepo.listByEmployee(id))
  ipcMain.handle('elements:listPourPeriode', (_e, id: number, s: string, f: string) =>
    elementsRepo.listPourPeriode(id, s, f)
  )
  ipcMain.handle('elements:create', (_e, d: ElementPaieInput) => elementsRepo.create(d))
  ipcMain.handle('elements:update', (_e, id: number, d: ElementPaieInput) =>
    elementsRepo.update(id, d)
  )
  ipcMain.handle('elements:remove', (_e, id: number) => elementsRepo.remove(id))

  // --- Registre des bulletins ---
  ipcMain.handle('payslips:list', (_e, limite?: number) => payslipsRepo.list(limite))
  ipcMain.handle('payslips:listByPeriode', (_e, s: string, f: string) =>
    payslipsRepo.listByPeriode(s, f)
  )
  ipcMain.handle('payslips:listByEmployee', (_e, id: number) => payslipsRepo.listByEmployee(id))
  ipcMain.handle('payslips:cloturer', (_e, params: PayrollParams) => payslipsRepo.cloturer(params))
  ipcMain.handle('payslips:setStatut', (_e, id: number, statut: string, date: string | null) =>
    payslipsRepo.setStatut(id, statut, date)
  )
  ipcMain.handle('payslips:remove', (_e, id: number) => payslipsRepo.remove(id))
  ipcMain.handle('payslips:comparer', (_e, params: PayrollParams) => payslipsRepo.comparer(params))
  ipcMain.handle('payslips:remplacer', (_e, params: PayrollParams) => payslipsRepo.remplacer(params))

  // --- Rappel des périodes passées ---
  ipcMain.handle('rappel:apercu', (_e, debut: string, fin: string, s: PayrollSettings) =>
    rappelRepo.apercu(debut, fin, s)
  )
  ipcMain.handle('rappel:executer', (_e, debut: string, fin: string, s: PayrollSettings) =>
    rappelRepo.executer(debut, fin, s)
  )

  // --- Déclarations CNSS (BNTS / DRS) ---
  ipcMain.handle('declarations:build', (_e, params: PayrollParams) => declarationsRepo.build(params))
  ipcMain.handle('declarations:list', () => declarationsArchiveRepo.list())
  ipcMain.handle('declarations:save', (_e, d: DeclarationDto) => declarationsArchiveRepo.enregistrer(d))
  ipcMain.handle('declarations:setStatut', (_e, id: number, statut: string, date: string | null) =>
    declarationsArchiveRepo.setStatut(id, statut, date)
  )
  ipcMain.handle('declarations:remove', (_e, id: number) => declarationsArchiveRepo.remove(id))

  // --- Registre de pointage ---
  ipcMain.handle('presences:listByRange', (_e, start: string, end: string) =>
    presencesRepo.listByRange(start, end)
  )
  ipcMain.handle('presences:set', (_e, data: PresenceInput) => presencesRepo.set(data))
  ipcMain.handle('presences:clear', (_e, employeeId: number, date: string) =>
    presencesRepo.clear(employeeId, date)
  )
  ipcMain.handle('presences:prefillMonth', (_e, start: string, end: string, joursRepos: number[]) =>
    presencesRepo.prefillMonth(start, end, joursRepos)
  )

  // --- Registre des actes établis ---
  ipcMain.handle('documents:list', () => documentsRepo.list())
  ipcMain.handle('documents:listByEmployee', (_e, id: number) => documentsRepo.listByEmployee(id))
  ipcMain.handle('documents:save', (_e, d: ActeDocumentInput) => documentsRepo.save(d))
  ipcMain.handle('documents:remove', (_e, id: number) => documentsRepo.remove(id))

  // --- Portefeuille d'employeurs ---
  // Chaque employeur a sa propre base ; « ouvrir » ferme la précédente.
  ipcMain.handle('employeurs:list', (_e, archives?: boolean) => employeursRepo.list(archives))
  ipcMain.handle('employeurs:bilan', () => bilanPortefeuille())
  ipcMain.handle('employeurs:create', (_e, d: EmployeurInput) => {
    const cree = employeursRepo.create(d)
    // La base du dossier n'existe pas encore : elle sera créée à la première
    // ouverture, et l'identité y sera inscrite à ce moment-là.
    return cree
  })
  ipcMain.handle('employeurs:update', (_e, id: number, d: EmployeurInput) => {
    const maj = employeursRepo.update(id, d)
    appliquerIdentiteAuDossier(id, d)
    return maj
  })
  ipcMain.handle('employeurs:archiver', (_e, id: number, a: boolean) =>
    employeursRepo.archiver(id, a)
  )
  ipcMain.handle('employeurs:remove', (_e, id: number) => employeursRepo.remove(id))
  ipcMain.handle('employeurs:ouvrir', (_e, id: number) => {
    let base: ReturnType<typeof ouvrirBaseEmployeur>
    try {
      base = ouvrirBaseEmployeur(employeursRepo.chemin(id), id)
    } catch (err) {
      // Une base illisible ne doit pas remonter une erreur SQLite brute :
      // l'utilisateur n'en tire rien et croit que l'application est cassée,
      // alors que ses données sont peut-être dans une sauvegarde.
      const e = employeursRepo.get(id)
      throw new Error(
        `Le dossier « ${e?.nom ?? id} » est illisible (${(err as Error).message}). ` +
          'Restaurez-le depuis Paramètres > Sauvegarde, ou ouvrez un autre dossier.'
      )
    }
    employeursRepo.marquerOuvert(id)
    synchroniserNom(id)
    // Reprise des pièces jointes encore désignées par un chemin absolu : c'est
    // le seul moment où l'on tient à la fois la base et l'identité du dossier.
    rangerPieces(base, id)
    // Un dossier neuf n'a pas encore de nom dans ses réglages : on y inscrit
    // celui du portefeuille, pour que ses documents sortent au bon en-tête.
    const fiche = employeursRepo.get(id)
    if (fiche && !settingsRepo.get('config')) {
      appliquerIdentiteAuDossier(id, {
        nom: fiche.nom,
        ville: fiche.ville,
        numero_cnss: fiche.numero_cnss
      })
    }
    return employeursRepo.get(id)
  })
  ipcMain.handle('employeurs:fermer', () => fermerBaseEmployeur())
  ipcMain.handle('employeurs:courant', () => employeurOuvert())
  ipcMain.handle('employeurs:dossier', () => dossierDonnees())
  ipcMain.handle('app:version', () => app.getVersion())
  ipcMain.handle('employeurs:mode', () => employeursRepo.lireReglage('mode') ?? 'auto')
  ipcMain.handle('employeurs:setMode', (_e, m: string) => employeursRepo.ecrireReglage('mode', m))

  // --- Sauvegarde & restauration ---
  ipcMain.handle('sauvegarde:creer', async (_e, employeurId?: number) => {
    const destination = await choisirDestination()
    if (!destination) return null
    return sauvegarder(destination, employeurId)
  })
  ipcMain.handle('sauvegarde:choisir', () => choisirSauvegarde())
  ipcMain.handle('sauvegarde:restaurer', (_e, dossier: string) => restaurerPortefeuille(dossier))
  ipcMain.handle('sauvegarde:importer', (_e, dossier: string, remplacerId?: number) =>
    importerEmployeur(dossier, remplacerId)
  )
  ipcMain.handle('sauvegarde:derniere', () => derniereSauvegarde())
  ipcMain.handle('sauvegarde:ouvrirDossier', (_e, chemin: string) => ouvrirDossier(chemin))

  // --- Export CSV ---
  ipcMain.handle('export:csv', (_e, nomDefaut: string, contenu: string) => saveCsv(nomDefaut, contenu))

  // --- Réglages ---
  ipcMain.handle('settings:get', (_e, cle: string) => settingsRepo.get(cle))
  ipcMain.handle('settings:set', (_e, cle: string, valeur: string) => {
    settingsRepo.set(cle, valeur)
    // La raison sociale existe à deux endroits : dans la base du client (elle
    // habille ses documents) et dans le registre (elle nomme sa carte au
    // portefeuille). Sans cette reprise, renommer l'entreprise dans les
    // réglages laissait le portefeuille afficher l'ancien nom indéfiniment.
    const id = employeurOuvert()
    if (cle === 'config' && id !== null) synchroniserNom(id)
  })

  // --- Authentification / rôles ---
  ipcMain.handle('auth:status', () => authRepo.status())
  ipcMain.handle('auth:setupPremier', (_e, u: string, nom: string, mdp: string) =>
    authRepo.setupPremier(u, nom, mdp)
  )
  ipcMain.handle('auth:login', (_e, u: string, mdp: string) => authRepo.login(u, mdp))
  ipcMain.handle('auth:changePassword', (_e, u: string, ancien: string, nouveau: string) =>
    authRepo.changePassword(u, ancien, nouveau)
  )
  ipcMain.handle('auth:recoverStart', (_e, u: string) => authRepo.recoverStart(u))
  ipcMain.handle('auth:recover', (_e, u: string, rep: string, nouveau: string) =>
    authRepo.recover(u, rep, nouveau)
  )

  // --- Comptes utilisateurs ---
  ipcMain.handle('users:list', () => usersRepo.list())
  ipcMain.handle('users:create', (_e, u: NouvelUtilisateur) => usersRepo.create(u, true))
  ipcMain.handle('users:setRole', (_e, id: number, role: RoleUtilisateur) =>
    usersRepo.setRole(id, role)
  )
  ipcMain.handle('users:resetPassword', (_e, id: number, nouveau: string) =>
    usersRepo.resetPassword(id, nouveau)
  )
  ipcMain.handle('users:setRecovery', (_e, u: string, q: string, rep: string) =>
    usersRepo.setRecovery(u, q, rep)
  )
  ipcMain.handle('users:remove', (_e, id: number) => usersRepo.remove(id))

  // --- Tableau de bord ---
  ipcMain.handle('dashboard:panorama', () => getDashboardPanorama())
}
