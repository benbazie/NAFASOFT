/**
 * Identité du PRODUIT logiciel · distincte de l'entreprise cliente.
 *
 * « Nafasoft » est la marque vendue ; le nom, le logo et les coordonnées de
 * l'entreprise qui utilise l'application viennent, eux, de la configuration
 * (settings `config`). Ne jamais coder ici le nom d'un client.
 */
export const PRODUIT = {
  nom: 'Nafasoft',
  // Un slogan, pas une description : ce que le produit FAIT figure dans le
  // menu et les modules ; ici, la devise du concepteur — AFRICA-TIC.
  tagline: 'Les TIC au service de l’humanité.',
  editeur: 'Nafasoft'
} as const

/**
 * Titre de la fenêtre : le nom du client d'abord (c'est son poste de travail),
 * le produit ensuite. Sans client configuré, seul le produit s'affiche.
 */
export function titreFenetre(entrepriseNom?: string | null): string {
  const nom = (entrepriseNom ?? '').trim()
  return nom ? `${nom} · ${PRODUIT.nom}` : PRODUIT.nom
}

/** Monogramme d'un nom : jusqu'à deux initiales, pour l'écran (repli sans logo). */
export function monogramme(nom: string): string {
  const mots = (nom ?? '')
    .split(/[\s-]+/)
    .filter((m) => m.length > 1)
    .slice(0, 2)
  return mots.length > 0 ? mots.map((m) => m[0].toUpperCase()).join('') : '★'
}
