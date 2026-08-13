/**
 * Retours sonores de l'application.
 *
 * Les sons sont SYNTHÉTISÉS, pas chargés depuis des fichiers : rien à
 * embarquer dans le paquet, rien à charger au démarrage, et la politique de
 * sécurité du contenu reste stricte (aucune ressource externe).
 *
 * Couverture : TOUTE action est sonorisée · le clic lui-même par un son bref
 * et discret, le résultat par un son qui dit s'il a réussi ou échoué. Deux
 * capteurs globaux suffisent (voir `installerSons`), au lieu d'un appel dans
 * chaque écran qu'on finirait par oublier d'ajouter.
 *
 * Le clic reste volontairement très court et deux fois moins fort que les
 * autres : entendu des centaines de fois par jour, il doit se faire oublier.
 * Et tout est coupable d'un seul interrupteur, dans Paramètres → Sons, parce
 * qu'un logiciel qui parle sans qu'on puisse le faire taire finit coupé au
 * niveau du système · et alors les alertes qui comptent ne s'entendent plus.
 */

export type NomSon =
  | 'succes'
  | 'erreur'
  | 'alerte'
  | 'suppression'
  | 'archive'
  | 'bascule'
  | 'clic'

interface Note {
  /** Fréquence en hertz. */
  f: number
  /** Instant de départ, en secondes depuis le début du son. */
  t: number
  /** Durée en secondes. */
  d: number
  /** Volume relatif (0–1) de cette note. */
  v?: number
  forme?: OscillatorType
}

/**
 * Chaque son est une courte suite de notes. Deux sons doivent rester
 * distinguables les yeux fermés : le succès monte, l'erreur descend, la
 * suppression est grave et sourde.
 */
const PARTITIONS: Record<NomSon, Note[]> = {
  succes: [
    { f: 660, t: 0, d: 0.07 },
    { f: 880, t: 0.06, d: 0.11 }
  ],
  erreur: [
    { f: 400, t: 0, d: 0.1, forme: 'triangle' },
    { f: 300, t: 0.09, d: 0.16, forme: 'triangle' }
  ],
  alerte: [
    { f: 560, t: 0, d: 0.08 },
    { f: 560, t: 0.13, d: 0.08 }
  ],
  suppression: [{ f: 220, t: 0, d: 0.13, forme: 'triangle', v: 0.9 }],
  archive: [
    { f: 700, t: 0, d: 0.05, v: 0.7 },
    { f: 1040, t: 0.05, d: 0.09, v: 0.7 }
  ],
  bascule: [{ f: 520, t: 0, d: 0.06, v: 0.6 }],
  clic: [{ f: 1100, t: 0, d: 0.025, v: 0.35 }]
}

const CLE = 'sons'

export interface ReglagesSon {
  actif: boolean
  volume: number // 0 à 1
}

const DEFAUT: ReglagesSon = { actif: true, volume: 0.5 }

export function lireReglagesSon(): ReglagesSon {
  try {
    const brut = localStorage.getItem(CLE)
    if (!brut) return { ...DEFAUT }
    return { ...DEFAUT, ...(JSON.parse(brut) as Partial<ReglagesSon>) }
  } catch {
    return { ...DEFAUT }
  }
}

export function ecrireReglagesSon(r: ReglagesSon): void {
  localStorage.setItem(CLE, JSON.stringify(r))
  reglages = r
}

let reglages: ReglagesSon = lireReglagesSon()
let contexte: AudioContext | null = null

/**
 * Le contexte audio n'est créé qu'au premier son, et jamais avant une
 * interaction : les navigateurs refusent de le démarrer autrement, et le créer
 * au chargement laisserait un objet audio ouvert pour rien toute la journée.
 */
function obtenirContexte(): AudioContext | null {
  if (contexte) return contexte
  const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!C) return null
  try {
    contexte = new C()
    return contexte
  } catch {
    return null
  }
}

/**
 * Joue un son. Ne lève jamais : un retour sonore qui échoue ne doit sous aucun
 * prétexte interrompre l'action que l'utilisateur vient de mener.
 */
export function jouer(nom: NomSon): void {
  if (!reglages.actif || reglages.volume <= 0) return
  const ctx = obtenirContexte()
  if (!ctx) return
  try {
    if (ctx.state === 'suspended') void ctx.resume()
    const debut = ctx.currentTime + 0.01

    for (const n of PARTITIONS[nom]) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = n.forme ?? 'sine'
      osc.frequency.value = n.f

      // Enveloppe : sans attaque ni extinction progressives, on entend un
      // « clac » à chaque bord · plus désagréable que le son lui-même.
      const t0 = debut + n.t
      const crete = reglages.volume * 0.22 * (n.v ?? 1)
      gain.gain.setValueAtTime(0.0001, t0)
      gain.gain.exponentialRampToValueAtTime(crete, t0 + 0.012)
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + n.d)

      osc.connect(gain).connect(ctx.destination)
      osc.start(t0)
      osc.stop(t0 + n.d + 0.02)
    }
  } catch {
    /* audio indisponible : on continue en silence */
  }
}

/** Raccourci : succès si l'opération a réussi, erreur sinon. */
export function jouerResultat(ok: boolean): void {
  jouer(ok ? 'succes' : 'erreur')
}

// ------------------------------------------------------------------ capteurs

/**
 * Deux sons identiques déclenchés coup sur coup n'apportent rien et sonnent
 * comme un défaut : on ignore la répétition immédiate.
 */
let dernier: { nom: NomSon; t: number } = { nom: 'clic', t: 0 }

function jouerSansDoublon(nom: NomSon): void {
  const maintenant = performance.now()
  if (dernier.nom === nom && maintenant - dernier.t < 250) return
  dernier = { nom, t: maintenant }
  jouer(nom)
}

/** Un élément sur lequel cliquer constitue une action. */
function estActionnable(cible: EventTarget | null): boolean {
  if (!(cible instanceof Element)) return false
  const el = cible.closest(
    'button, a[href], [role="button"], [role="menuitem"], .onglet, .nav-item, .mb-item, .mb-bouton, summary'
  )
  if (!el) return false
  if (el instanceof HTMLButtonElement && el.disabled) return false
  return true
}

/**
 * Sonorisation globale.
 *
 * Plutôt que d'ajouter un appel dans chaque page · quarante fichiers, et un
 * oubli à chaque nouvel écran · on écoute à deux endroits :
 *
 * 1. le clic sur tout élément actionnable, pour le retour immédiat ;
 * 2. l'apparition des bandeaux de résultat, pour dire si l'action a réussi.
 *
 * Le second point est le plus utile : chaque module affiche déjà un bandeau
 * « succès » ou « erreur ». En les observant, tout ce qui aboutit ou échoue
 * dans l'application est sonorisé, y compris les écrans écrits demain.
 */
export function installerSons(): void {
  document.addEventListener(
    'pointerdown',
    (e) => {
      if (estActionnable(e.target)) jouerSansDoublon('clic')
    },
    { capture: true }
  )

  // Le clavier compte autant que la souris : valider au clavier est une action.
  document.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && estActionnable(e.target)) {
      jouerSansDoublon('clic')
    }
  })

  const sonDuBandeau = (el: Element): NomSon | null => {
    if (el.classList.contains('erreur')) return 'erreur'
    if (el.classList.contains('succes')) return 'succes'
    if (el.classList.contains('alerte')) return 'alerte'
    return null
  }

  const observateur = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const noeud of m.addedNodes) {
        if (!(noeud instanceof Element)) continue
        const bandeaux = noeud.classList?.contains('bandeau')
          ? [noeud]
          : Array.from(noeud.querySelectorAll?.('.bandeau') ?? [])
        for (const b of bandeaux) {
          const son = sonDuBandeau(b)
          if (son) jouerSansDoublon(son)
        }
      }
    }
  })
  observateur.observe(document.body, { childList: true, subtree: true })
}
