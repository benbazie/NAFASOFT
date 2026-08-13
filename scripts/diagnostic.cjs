/**
 * Diagnostic d'emplacement des données.
 *
 * À lancer depuis le terminal où l'application se comporte mal :
 *     npm run diagnostic
 *
 * Il n'ouvre aucune fenêtre, n'écrit rien, ne modifie rien. Il dit seulement
 * OÙ l'application irait chercher ses données depuis CE terminal, et ce qu'elle
 * y trouverait. Deux terminaux qui donnent deux réponses différentes désignent
 * la cause sans discussion possible.
 */
const { app } = require('electron')
const Database = require('better-sqlite3')
const { join } = require('path')
const { existsSync, readdirSync, statSync } = require('fs')

const avantCorrection = app.getPath('userData')
app.setName('gestion-personnel')
const apresSetName = app.getPath('userData')
// Même geste que l'application : c'est setPath qui déplace réellement.
app.setPath('userData', join(app.getPath('appData'), 'gestion-personnel'))
const apresSetPath = app.getPath('userData')

app.whenReady().then(() => {
  const l = (...a) => console.log(...a)

  l('')
  l('=========== DIAGNOSTIC NAFASOFT ===========')
  l('')
  l("Nom de l'application  :", app.getName())
  l('userData au lancement :', avantCorrection)
  l('  après setName       :', apresSetName, apresSetName === avantCorrection ? '(inchangé — setName ne déplace rien)' : '')
  l('  après setPath       :', apresSetPath)
  if (avantCorrection !== apresSetPath) {
    l('  >>> Ce terminal ouvrait le MAUVAIS dossier ; setPath le corrige.')
  } else {
    l('  >>> Ce terminal ouvrait déjà le bon dossier.')
  }
  l('')
  l('Variables d’environnement qui détournent les données :')
  l('  NAFA_DATA =', process.env.NAFA_DATA || '(non définie — normal)')
  l('  DB_PATH   =', process.env.DB_PATH || '(non définie — normal)')
  l('  APPDATA   =', process.env.APPDATA || '(non définie)')
  l('')

  const racine = process.env.NAFA_DATA || apresSetPath
  const dossier = join(racine, 'employeurs')
  l('Dossier de données réellement utilisé :')
  l(' ', dossier)
  l('  existe :', existsSync(dossier) ? 'OUI' : 'NON')
  l('')

  if (!existsSync(dossier)) {
    l('  >>> Ce dossier n’existe pas : l’application se croira neuve.')
    app.quit()
    return
  }

  l('Fichiers présents :')
  for (const f of readdirSync(dossier).filter((x) => x.endsWith('.db'))) {
    l(`  ${f.padEnd(20)} ${String(statSync(join(dossier, f)).size).padStart(9)} octets`)
  }
  l('')

  const registre = join(dossier, 'registre.db')
  if (!existsSync(registre)) {
    l('  >>> Aucun registre.db : l’écran de première configuration s’affichera.')
    app.quit()
    return
  }

  let db
  try {
    db = new Database(registre, { readonly: true, fileMustExist: true })
    const emp = db.prepare('SELECT id, nom, fichier, archive FROM employeurs ORDER BY id').all()
    l(`Registre : ${emp.length} employeur(s) enregistré(s)`)
    for (const e of emp) {
      const chemin = join(dossier, e.fichier)
      let effectif = '?'
      let base
      try {
        base = new Database(chemin, { readonly: true, fileMustExist: true })
        effectif = base.prepare('SELECT COUNT(*) AS n FROM employees').get().n
      } catch (err) {
        effectif = 'ILLISIBLE'
      } finally {
        base && base.close()
      }
      l(`  #${e.id} ${String(e.nom).padEnd(22)} ${e.fichier.padEnd(18)} salariés=${effectif}${e.archive ? '  (archivé)' : ''}`)
    }
    const visibles = emp.filter((e) => !e.archive).length
    l('')
    l('Comptes :', db.prepare('SELECT username, role FROM users').all().map((u) => `${u.username}/${u.role}`).join('  ') || 'AUCUN')
    l('Mode    :', db.prepare("SELECT valeur FROM registre_reglages WHERE cle='mode'").get()?.valeur ?? 'auto')
    l('')
    l('CONCLUSION :')
    if (visibles === 0) {
      l("  L’application affichera l’ÉCRAN DE CONFIGURATION — aucun dossier visible ici.")
      l('  Ne créez rien depuis cet écran : vérifiez d’abord le chemin ci-dessus.')
    } else if (visibles === 1) {
      l(`  L’application ouvrira directement « ${emp.find((e) => !e.archive).nom} ».`)
    } else {
      l(`  L’application affichera le PORTEFEUILLE avec ${visibles} dossiers.`)
    }
  } catch (err) {
    l('  >>> Registre illisible :', err.message)
  } finally {
    db && db.close()
  }
  l('')
  l('==========================================')
  l('')
  app.quit()
})
