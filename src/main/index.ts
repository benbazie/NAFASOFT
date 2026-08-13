import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { closeDatabase } from './db'
import { ouvrirRegistre, dossierDonnees } from './db/employeurs'
import { registerIpcHandlers } from './ipc'
import { sauvegardeDeMiseAJour } from './sauvegarde'

/**
 * Nom de l'application — À NE JAMAIS CHANGER.
 *
 * Electron en déduit le dossier de données (`%APPDATA%\<nom>`). Or il ne
 * retrouve ce nom dans package.json que selon la façon dont on le lance :
 * `electron-vite` donne « gestion-personnel », un `electron out/main/index.js`
 * donne « Electron ». Deux lancements, deux dossiers, et l'application semble
 * repartir de zéro alors que les données sont intactes à côté.
 *
 * On le fixe donc explicitement, avant tout accès au disque. La valeur reste
 * « gestion-personnel » et non « Nafasoft » : la renommer déplacerait le
 * dossier de données de toutes les installations déjà en service.
 */
app.setName('gestion-personnel')
// …mais `setName` NE DÉPLACE PAS le dossier de données : Electron a déjà
// résolu `userData` quand on l'appelle. Mesuré : le nom devient
// « gestion-personnel » pendant que userData reste « …\Roaming\Electron ».
// Il faut donc imposer le chemin lui-même, sinon la base ouverte dépend de la
// manière dont le processus a été lancé — et l'application semble vide.
app.setPath('userData', join(app.getPath('appData'), 'gestion-personnel'))

/**
 * Icône de la fenêtre.
 *
 * `build/icon.png` ne sert qu'à electron-builder, au moment d'empaqueter :
 * en développement, la fenêtre garde l'icône d'Electron tant qu'on ne la lui
 * donne pas explicitement. On embarque donc la même image dans `resources/`,
 * qui suit l'application une fois installée.
 */
function cheminIcone(): string {
  // `resources/` est embarqué DANS app.asar par electron-builder : le même
  // chemin relatif à `out/main` vaut donc en développement comme une fois
  // installé. Viser `process.resourcesPath` pointait à côté dans le paquet.
  return join(__dirname, '../../resources/icon.png')
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    // Dimensions de repli : elles servent quand l'utilisateur quitte le mode
    // maximisé, et sur un écran trop petit pour être maximisé utilement.
    width: 1280,
    height: 820,
    minWidth: 1000,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    title: 'Nafasoft',
    icon: cheminIcone(),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    // Plein écran d'emblée : c'est un logiciel de travail, pas un utilitaire.
    // Les tableaux de paie, le registre de pointage et les aperçus A4 ont
    // besoin de toute la largeur — ouvrir en 1280×820 sur un écran de 1920
    // oblige l'utilisateur à agrandir la fenêtre à chaque démarrage.
    // On maximise AVANT d'afficher : l'inverse fait voir la petite fenêtre
    // une fraction de seconde, puis un saut.
    mainWindow.maximize()
    console.log('[fenêtre] prête, affichage maximisé')
    mainWindow.show()
  })
  mainWindow.on('closed', () => {
    console.log('[fenêtre] fermée')
  })

  // Une fenêtre blanche ne dit rien par elle-même : l'erreur qui l'a causée vit
  // dans la console du rendu, invisible depuis le terminal. On la fait remonter.
  mainWindow.webContents.on('console-message', (_e, niveau, message, ligne, source) => {
    if (niveau >= 2) console.error(`[rendu] ${message}  (${source}:${ligne})`)
  })
  mainWindow.webContents.on('did-fail-load', (_e, code, description, url) => {
    console.error(`[rendu] chargement échoué (${code} ${description}) : ${url}`)
  })
  mainWindow.webContents.on('render-process-gone', (_e, details) => {
    // Un code 143 est un SIGTERM : le processus a été TUÉ de l'extérieur (arrêt
    // du terminal, minuterie de test), il n'a pas planté. Confondre les deux
    // envoie chercher un bogue qui n'existe pas.
    const tue = details.exitCode === 143 || details.exitCode === 137
    console.error(
      `[rendu] processus interrompu : ${details.reason} (code ${details.exitCode})` +
        (tue ? ' — arrêt demandé de l’extérieur, pas un plantage' : '')
    )
  })
  mainWindow.webContents.on('preload-error', (_e, chemin, erreur) => {
    console.error(`[préchargement] ${chemin} : ${erreur.message}`)
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR en développement, fichier buildé en production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

/**
 * Une seule instance à la fois — garde-fou vital, pas un confort.
 *
 * Deux processus qui ouvrent le même fichier SQLite en mode WAL finissent par
 * écrire des pages incohérentes : la base devient illisible (« malformed
 * database schema ») et emporte bulletins et déclarations avec elle. Il suffit
 * d'un double-clic de trop sur l'icône. Si le verrou n'est pas obtenu, on rend
 * la main à l'instance déjà en cours au lieu d'en ouvrir une seconde.
 */
if (!app.requestSingleInstanceLock()) {
  // Quitter sans rien dire est intenable : on voit une fenêtre s'ouvrir puis
  // disparaître, le terminal rend la main, et rien n'explique pourquoi.
  console.warn(
    '[instance] Nafasoft est déjà ouvert : cette seconde exécution s’arrête et rend la main ' +
      'à la fenêtre existante. Fermez-la (ou arrêtez « npm run dev » / « npm start ») avant de relancer.'
  )
  app.quit()
} else {
  app.on('second-instance', () => {
    const [fenetre] = BrowserWindow.getAllWindows()
    if (fenetre) {
      if (fenetre.isMinimized()) fenetre.restore()
      fenetre.focus()
    }
  })
}

app.whenReady().then(() => {
  // L'instance qui n'a pas le verrou s'arrête ici, avant de toucher au disque.
  if (!app.hasSingleInstanceLock()) return

  // Doit être IDENTIQUE à l'appId de l'installateur : c'est ce qui rattache
  // la fenêtre au raccourci installé (icône de la barre des tâches,
  // épinglage, notifications). Un écart et Windows affiche une icône générique.
  electronApp.setAppUserModelId('bf.nafasoft.gestionpersonnel')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Initialisation base + IPC AVANT d'ouvrir la fenêtre.
  // On n'ouvre plus de base au démarrage : c'est le choix de l'employeur (ou
  // l'ouverture automatique du seul employeur enregistré) qui la sélectionne.
  // Trace du dossier RÉELLEMENT lu : c'est LA question à se poser quand une
  // application « repart de zéro ». Afficher `userData` ne suffisait pas — une
  // variable d'environnement peut détourner le dossier sans que ce chemin-là
  // ne bouge, et la trace disait alors le contraire de la vérité.
  const registre = ouvrirRegistre()
  const nb = (registre.prepare('SELECT COUNT(*) AS n FROM employeurs').get() as { n: number }).n
  console.log(`[données] ${dossierDonnees()}  —  ${nb} dossier(s) employeur`)
  if (process.env.NAFA_DATA) {
    console.warn(
      `[données] ATTENTION : la variable d'environnement NAFA_DATA détourne les données vers ` +
        `« ${process.env.NAFA_DATA} ». Supprimez-la pour retrouver l'emplacement normal.`
    )
  }

  registerIpcHandlers()

  // Nouvelle version installée par-dessus l'ancienne : on met les données à
  // l'abri avant que la moindre migration ne s'exécute.
  void sauvegardeDeMiseAJour()

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  console.log('[arrêt] toutes les fenêtres sont fermées')
  if (process.platform !== 'darwin') {
    closeDatabase()
    app.quit()
  }
})

// Trace de l'arrêt : sans elle, une fermeture immédiate est indiscernable d'un
// plantage, et l'on cherche un bogue là où il n'y en a pas.
app.on('before-quit', () => {
  console.log('[arrêt] fermeture demandée')
  closeDatabase()
})
