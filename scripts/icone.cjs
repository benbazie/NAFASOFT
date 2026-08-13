/**
 * Génère l'icône de l'application à partir de l'emblème Nafasoft.
 *
 *     npm run icone
 *
 * On rend le SVG dans une fenêtre Electron hors écran puis on capture l'image :
 * pas de dépendance de conversion à installer, et l'icône reste la copie exacte
 * de l'emblème affiché dans l'application — les deux ne peuvent pas diverger.
 * electron-builder dérive ensuite le .ico multi-résolutions de ce PNG.
 */
const { app, BrowserWindow } = require('electron')
const { writeFileSync, mkdirSync, existsSync } = require('fs')
const { join } = require('path')

const CONTOUR = '100,12 176,56 176,144 100,188 24,144 24,56'

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="512" height="512">
  <defs>
    <linearGradient id="hex" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#2f6bff"/><stop offset="1" stop-color="#081f63"/>
    </linearGradient>
    <linearGradient id="or" x1="0.15" y1="0" x2="0.7" y2="1">
      <stop offset="0" stop-color="#ffe487"/><stop offset="0.5" stop-color="#f4b820"/>
      <stop offset="1" stop-color="#cf8605"/>
    </linearGradient>
  </defs>
  <polygon points="${CONTOUR}" fill="url(#hex)"/>
  <polygon points="100,12 176,56 176,80 24,80 24,56" fill="#ffffff" opacity="0.07"/>
  <polygon points="${CONTOUR}" fill="none" stroke="url(#or)" stroke-width="5" stroke-linejoin="round"/>
  <line x1="75" y1="70" x2="125" y2="130" stroke="url(#or)" stroke-width="18" stroke-linecap="round"/>
  <rect x="66" y="62" width="17" height="76" rx="4" fill="#ffffff"/>
  <rect x="117" y="62" width="17" height="76" rx="4" fill="#ffffff"/>
</svg>`

const PAGE = `<!doctype html><meta charset="utf-8">
<style>html,body{margin:0;padding:0;background:transparent;width:512px;height:512px;overflow:hidden}</style>
${SVG}`

app.whenReady().then(async () => {
  const w = new BrowserWindow({
    width: 512,
    height: 512,
    show: false,
    transparent: true,
    frame: false,
    webPreferences: { offscreen: true }
  })
  await w.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(PAGE))
  // Laisse le rendu se stabiliser : une capture trop précoce donne une image vide.
  await new Promise((r) => setTimeout(r, 600))

  const image = await w.webContents.capturePage()
  const dossier = join(__dirname, '..', 'build')
  if (!existsSync(dossier)) mkdirSync(dossier, { recursive: true })
  const cible = join(dossier, 'icon.png')
  writeFileSync(cible, image.toPNG())

  const t = image.getSize()
  console.log(`[icône] ${cible} — ${t.width}x${t.height}`)
  if (t.width < 256) console.error("[icône] ATTENTION : moins de 256 px, Windows refusera l'icône.")
  app.quit()
})
