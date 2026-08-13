/**
 * Élague les langues de Chromium après l'empaquetage.
 *
 * Nafasoft est entièrement en français, sans système de traduction : les 55
 * langues embarquées par défaut ne servent, au mieux, qu'au correcteur
 * orthographique natif d'un champ de texte — et seulement si l'utilisateur y
 * fait un clic droit. On ne garde que le français et l'anglais (repli
 * universel), le reste n'aurait jamais été vu par personne.
 *
 * Hook electron-builder (`build.afterPack` dans package.json) : s'exécute une
 * fois l'application copiée dans `dist-app/win-unpacked`, avant la
 * construction de l'installateur NSIS.
 */
const { readdirSync, unlinkSync } = require('fs')
const { join } = require('path')

const GARDEES = new Set(['fr.pak', 'en-US.pak'])

module.exports = async function afterPack(contexte) {
  const dossier = join(contexte.appOutDir, 'locales')
  let fichiers
  try {
    fichiers = readdirSync(dossier)
  } catch {
    // Pas de dossier locales (autre plateforme, ou déjà élagué) : rien à faire.
    return
  }

  let retires = 0
  for (const f of fichiers) {
    if (f.endsWith('.pak') && !GARDEES.has(f)) {
      unlinkSync(join(dossier, f))
      retires++
    }
  }
  console.log(`[afterPack] ${retires} langue(s) retirée(s) — conservées : ${[...GARDEES].join(', ')}`)
}
