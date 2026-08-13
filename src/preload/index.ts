import { contextBridge, ipcRenderer } from 'electron'
import type {
  Employee,
  EmployeeInput,
  Shift,
  ShiftInput,
  ShiftWithEmployee,
  Leave,
  LeaveInput,
  LeaveWithEmployee,
  TimeEntryInput,
  TimeEntryWithEmployee,
  DashboardPanorama,
  GenerateWeekOptions,
  PayrollParams,
  PayrollRow,
  AuthStatus,
  Presence,
  PresenceInput,
  DeclarationDto,
  Contract,
  ContractInput,
  ContractWithEmployee,
  EmployeeDocument,
  PayslipWithEmployee,
  DeclarationRecord,
  BilanPeriode,
  ElementPaie,
  ElementPaieInput,
  ActeDocument,
  ActeDocumentInput,
  Utilisateur,
  NouvelUtilisateur,
  RoleUtilisateur,
  ResultatLogin,
  EmployeurRegistre,
  EmployeurInput,
  ModePortefeuille,
  MoisRappel,
  PayrollSettings,
  SuppressionContrat,
  ResultatRappel,
  Manifeste,
  ResultatSauvegarde,
  BilanEmployeur
} from '../shared/types'

// API exposée au renderer. Aucune primitive Node/Electron n'est exposée directement :
// tout passe par des canaux IPC nommés et typés.
const api = {
  employees: {
    list: (includeInactive = true): Promise<Employee[]> =>
      ipcRenderer.invoke('employees:list', includeInactive),
    get: (id: number): Promise<Employee | undefined> => ipcRenderer.invoke('employees:get', id),
    create: (data: EmployeeInput): Promise<Employee> => ipcRenderer.invoke('employees:create', data),
    update: (id: number, data: EmployeeInput): Promise<Employee> =>
      ipcRenderer.invoke('employees:update', id, data),
    remove: (id: number): Promise<void> => ipcRenderer.invoke('employees:remove', id)
  },
  shifts: {
    listByRange: (start: string, end: string): Promise<ShiftWithEmployee[]> =>
      ipcRenderer.invoke('shifts:listByRange', start, end),
    listByDate: (date: string): Promise<ShiftWithEmployee[]> =>
      ipcRenderer.invoke('shifts:listByDate', date),
    create: (data: ShiftInput): Promise<Shift> => ipcRenderer.invoke('shifts:create', data),
    update: (id: number, data: ShiftInput): Promise<Shift> =>
      ipcRenderer.invoke('shifts:update', id, data),
    remove: (id: number): Promise<void> => ipcRenderer.invoke('shifts:remove', id),
    generateWeek: (opts: GenerateWeekOptions): Promise<number> =>
      ipcRenderer.invoke('shifts:generateWeek', opts)
  },
  leaves: {
    list: (): Promise<LeaveWithEmployee[]> => ipcRenderer.invoke('leaves:list'),
    create: (data: LeaveInput): Promise<Leave> => ipcRenderer.invoke('leaves:create', data),
    update: (id: number, data: LeaveInput): Promise<Leave> =>
      ipcRenderer.invoke('leaves:update', id, data),
    setStatus: (id: number, statut: string): Promise<Leave> =>
      ipcRenderer.invoke('leaves:setStatus', id, statut),
    remove: (id: number): Promise<void> => ipcRenderer.invoke('leaves:remove', id)
  },
  time: {
    listByRange: (start: string, end: string): Promise<TimeEntryWithEmployee[]> =>
      ipcRenderer.invoke('time:listByRange', start, end),
    create: (data: TimeEntryInput): Promise<TimeEntryWithEmployee> =>
      ipcRenderer.invoke('time:create', data),
    update: (id: number, data: TimeEntryInput): Promise<TimeEntryWithEmployee> =>
      ipcRenderer.invoke('time:update', id, data),
    remove: (id: number): Promise<void> => ipcRenderer.invoke('time:remove', id)
  },
  payroll: {
    compute: (params: PayrollParams): Promise<PayrollRow[]> =>
      ipcRenderer.invoke('payroll:compute', params)
  },
  files: {
    chooseImage: (): Promise<string | null> => ipcRenderer.invoke('files:chooseImage')
  },
  employeeDocs: {
    listByEmployee: (id: number): Promise<EmployeeDocument[]> =>
      ipcRenderer.invoke('docs:listByEmployee', id),
    attach: (employeeId: number, type: string, notes: string | null): Promise<EmployeeDocument | null> =>
      ipcRenderer.invoke('docs:attach', employeeId, type, notes),
    open: (chemin: string): Promise<string> => ipcRenderer.invoke('docs:open', chemin),
    remove: (id: number): Promise<void> => ipcRenderer.invoke('docs:remove', id)
  },
  contracts: {
    list: (): Promise<ContractWithEmployee[]> => ipcRenderer.invoke('contracts:list'),
    listByEmployee: (id: number): Promise<Contract[]> =>
      ipcRenderer.invoke('contracts:listByEmployee', id),
    get: (id: number): Promise<Contract | undefined> => ipcRenderer.invoke('contracts:get', id),
    nextReference: (type: string, annee: string): Promise<string> =>
      ipcRenderer.invoke('contracts:nextReference', type, annee),
    create: (data: ContractInput): Promise<Contract> => ipcRenderer.invoke('contracts:create', data),
    update: (id: number, data: ContractInput): Promise<Contract> =>
      ipcRenderer.invoke('contracts:update', id, data),
    remove: (id: number): Promise<SuppressionContrat> =>
      ipcRenderer.invoke('contracts:remove', id),
    cloturerEchus: (): Promise<number> => ipcRenderer.invoke('contracts:cloturerEchus')
  },
  elements: {
    listByEmployee: (id: number): Promise<ElementPaie[]> =>
      ipcRenderer.invoke('elements:listByEmployee', id),
    listPourPeriode: (id: number, start: string, end: string): Promise<ElementPaie[]> =>
      ipcRenderer.invoke('elements:listPourPeriode', id, start, end),
    create: (d: ElementPaieInput): Promise<ElementPaie> => ipcRenderer.invoke('elements:create', d),
    update: (id: number, d: ElementPaieInput): Promise<ElementPaie> =>
      ipcRenderer.invoke('elements:update', id, d),
    remove: (id: number): Promise<void> => ipcRenderer.invoke('elements:remove', id)
  },
  payslips: {
    list: (limite?: number): Promise<PayslipWithEmployee[]> =>
      ipcRenderer.invoke('payslips:list', limite),
    listByPeriode: (start: string, end: string): Promise<PayslipWithEmployee[]> =>
      ipcRenderer.invoke('payslips:listByPeriode', start, end),
    listByEmployee: (id: number): Promise<PayslipWithEmployee[]> =>
      ipcRenderer.invoke('payslips:listByEmployee', id),
    cloturer: (params: PayrollParams): Promise<{ emis: number; existants: number }> =>
      ipcRenderer.invoke('payslips:cloturer', params),
    setStatut: (id: number, statut: string, date: string | null): Promise<void> =>
      ipcRenderer.invoke('payslips:setStatut', id, statut, date),
    remove: (id: number): Promise<void> => ipcRenderer.invoke('payslips:remove', id),
    comparer: (params: PayrollParams): Promise<BilanPeriode> =>
      ipcRenderer.invoke('payslips:comparer', params),
    remplacer: (params: PayrollParams): Promise<{ emis: number; existants: number }> =>
      ipcRenderer.invoke('payslips:remplacer', params)
  },
  declarations: {
    build: (params: PayrollParams): Promise<DeclarationDto> =>
      ipcRenderer.invoke('declarations:build', params),
    list: (): Promise<DeclarationRecord[]> => ipcRenderer.invoke('declarations:list'),
    save: (d: DeclarationDto): Promise<DeclarationRecord> =>
      ipcRenderer.invoke('declarations:save', d),
    setStatut: (id: number, statut: string, date: string | null): Promise<void> =>
      ipcRenderer.invoke('declarations:setStatut', id, statut, date),
    remove: (id: number): Promise<void> => ipcRenderer.invoke('declarations:remove', id)
  },
  presences: {
    listByRange: (start: string, end: string): Promise<Presence[]> =>
      ipcRenderer.invoke('presences:listByRange', start, end),
    set: (data: PresenceInput): Promise<Presence> => ipcRenderer.invoke('presences:set', data),
    clear: (employeeId: number, date: string): Promise<void> =>
      ipcRenderer.invoke('presences:clear', employeeId, date),
    prefillMonth: (start: string, end: string, joursRepos: number[]): Promise<number> =>
      ipcRenderer.invoke('presences:prefillMonth', start, end, joursRepos)
  },
  documents: {
    list: (): Promise<ActeDocument[]> => ipcRenderer.invoke('documents:list'),
    listByEmployee: (id: number): Promise<ActeDocument[]> =>
      ipcRenderer.invoke('documents:listByEmployee', id),
    save: (d: ActeDocumentInput): Promise<ActeDocument> => ipcRenderer.invoke('documents:save', d),
    remove: (id: number): Promise<void> => ipcRenderer.invoke('documents:remove', id)
  },
  employeurs: {
    list: (archives = false): Promise<EmployeurRegistre[]> =>
      ipcRenderer.invoke('employeurs:list', archives),
    bilan: (): Promise<BilanEmployeur[]> => ipcRenderer.invoke('employeurs:bilan'),
    create: (d: EmployeurInput): Promise<EmployeurRegistre> =>
      ipcRenderer.invoke('employeurs:create', d),
    update: (id: number, d: EmployeurInput): Promise<EmployeurRegistre> =>
      ipcRenderer.invoke('employeurs:update', id, d),
    archiver: (id: number, archive: boolean): Promise<void> =>
      ipcRenderer.invoke('employeurs:archiver', id, archive),
    remove: (id: number): Promise<void> => ipcRenderer.invoke('employeurs:remove', id),
    ouvrir: (id: number): Promise<EmployeurRegistre> => ipcRenderer.invoke('employeurs:ouvrir', id),
    fermer: (): Promise<void> => ipcRenderer.invoke('employeurs:fermer'),
    courant: (): Promise<number | null> => ipcRenderer.invoke('employeurs:courant'),
    dossier: (): Promise<string> => ipcRenderer.invoke('employeurs:dossier'),
    version: (): Promise<string> => ipcRenderer.invoke('app:version'),
    mode: (): Promise<ModePortefeuille> => ipcRenderer.invoke('employeurs:mode'),
    setMode: (m: ModePortefeuille): Promise<void> => ipcRenderer.invoke('employeurs:setMode', m)
  },
  sauvegarde: {
    creer: (employeurId?: number): Promise<ResultatSauvegarde | null> =>
      ipcRenderer.invoke('sauvegarde:creer', employeurId),
    choisir: (): Promise<{ dossier: string; manifeste: Manifeste } | null> =>
      ipcRenderer.invoke('sauvegarde:choisir'),
    restaurer: (dossier: string): Promise<{ abri: string; manifeste: Manifeste }> =>
      ipcRenderer.invoke('sauvegarde:restaurer', dossier),
    importer: (
      dossier: string,
      remplacerId?: number
    ): Promise<{ id: number; nom: string; abri: string | null }> =>
      ipcRenderer.invoke('sauvegarde:importer', dossier, remplacerId),
    derniere: (): Promise<string | null> => ipcRenderer.invoke('sauvegarde:derniere'),
    ouvrirDossier: (chemin: string): Promise<void> =>
      ipcRenderer.invoke('sauvegarde:ouvrirDossier', chemin)
  },
  rappel: {
    apercu: (debut: string, fin: string, s: PayrollSettings): Promise<MoisRappel[]> =>
      ipcRenderer.invoke('rappel:apercu', debut, fin, s),
    executer: (debut: string, fin: string, s: PayrollSettings): Promise<ResultatRappel> =>
      ipcRenderer.invoke('rappel:executer', debut, fin, s)
  },
  exportCsv: (nomDefaut: string, contenu: string): Promise<string | null> =>
    ipcRenderer.invoke('export:csv', nomDefaut, contenu),
  auth: {
    status: (): Promise<AuthStatus> => ipcRenderer.invoke('auth:status'),
    setupPremier: (username: string, nom: string, mdp: string): Promise<ResultatLogin> =>
      ipcRenderer.invoke('auth:setupPremier', username, nom, mdp),
    login: (username: string, mdp: string): Promise<ResultatLogin> =>
      ipcRenderer.invoke('auth:login', username, mdp),
    changePassword: (username: string, ancien: string, nouveau: string): Promise<void> =>
      ipcRenderer.invoke('auth:changePassword', username, ancien, nouveau),
    recoverStart: (username: string): Promise<{ question: string } | null> =>
      ipcRenderer.invoke('auth:recoverStart', username),
    recover: (username: string, reponse: string, nouveau: string): Promise<boolean> =>
      ipcRenderer.invoke('auth:recover', username, reponse, nouveau)
  },
  users: {
    list: (): Promise<Utilisateur[]> => ipcRenderer.invoke('users:list'),
    create: (u: NouvelUtilisateur): Promise<Utilisateur> => ipcRenderer.invoke('users:create', u),
    setRole: (id: number, role: RoleUtilisateur): Promise<void> =>
      ipcRenderer.invoke('users:setRole', id, role),
    resetPassword: (id: number, nouveau: string): Promise<void> =>
      ipcRenderer.invoke('users:resetPassword', id, nouveau),
    setRecovery: (username: string, question: string, reponse: string): Promise<void> =>
      ipcRenderer.invoke('users:setRecovery', username, question, reponse),
    remove: (id: number): Promise<void> => ipcRenderer.invoke('users:remove', id)
  },
  settings: {
    get: (cle: string): Promise<string | null> => ipcRenderer.invoke('settings:get', cle),
    set: (cle: string, valeur: string): Promise<void> => ipcRenderer.invoke('settings:set', cle, valeur)
  },
  dashboard: {
    panorama: (): Promise<DashboardPanorama> => ipcRenderer.invoke('dashboard:panorama')
  },
  window: {
    setTitle: (titre: string): void => ipcRenderer.send('window:setTitle', titre)
  }
}

export type Api = typeof api

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('api', api)
} else {
  // @ts-ignore (fallback si contextIsolation désactivé)
  window.api = api
}
