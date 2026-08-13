// Génère le hash scrypt « sel:hash » d'un mot de passe maître concepteur.
// Usage : node scripts/maitre.mjs "votre mot de passe maître"
// Collez la ligne HASH_MAITRE affichée dans src/main/concepteur.ts, puis rebâtissez.
import { randomBytes, scryptSync } from 'node:crypto'
const mdp = process.argv[2]
if (!mdp || mdp.length < 6) {
  console.error('Donnez un mot de passe maître d’au moins 6 caractères, entre guillemets.')
  process.exit(1)
}
const sel = randomBytes(16)
const hash = scryptSync(mdp, sel, 64)
console.log(`${sel.toString('hex')}:${hash.toString('hex')}`)
