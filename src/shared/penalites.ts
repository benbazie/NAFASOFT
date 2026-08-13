import type { EstimationPenalites, PayrollSettings } from './types'

/**
 * Pénalités CNSS — estimation à l'usage de l'employeur.
 *
 * Ce module vit dans `shared` parce que les mêmes chiffres doivent apparaître
 * dans l'écran de calcul, le tableau de bord, le registre et le portefeuille du
 * cabinet : deux implémentations finiraient par diverger, et deux montants
 * contradictoires sur le même retard sont pires qu'aucun montant.
 *
 * RIEN DE TOUT CECI NE VA DANS LA DRS. Sur le formulaire, les lignes de
 * majoration portent le repère ** et la note précise « Cases à remplir par la
 * CNSS » : c'est elle qui liquide, et elle seule. Ces montants servent à savoir
 * ce qu'on doit avant d'arriver au guichet, et à le provisionner.
 */

const aujourdhui = (): string => new Date().toISOString().slice(0, 10)

/**
 * Majoration de retard (loi n° 004-2021/AN, art. 17 : 1,5 % par mois ou
 * fraction de mois). Le taux reste réglable — un taux légal change sans
 * prévenir, et une valeur figée dans le code deviendrait fausse en silence.
 *
 * @param dateDepot date de dépôt effective ; à défaut, la date du jour, car
 *                  une déclaration non déposée continue de courir.
 */
export function estimerPenalites(
  dateLimite: string | null,
  cotisations: number,
  settings: PayrollSettings,
  dateDepot: string | null = null
): EstimationPenalites {
  const aucune: EstimationPenalites = {
    en_retard: false,
    jours_retard: 0,
    mois_retard: 0,
    majoration_retard: 0,
    total_estime: cotisations
  }
  if (!dateLimite) return aucune

  const reference = dateDepot ?? aujourdhui()
  const jours = Math.round(
    (new Date(reference + 'T00:00:00').getTime() -
      new Date(dateLimite + 'T00:00:00').getTime()) /
      86400000
  )
  if (jours <= 0) return aucune

  // Tout mois entamé compte pour un mois entier.
  const mois = Math.ceil(jours / 30)
  const majoration = Math.round(cotisations * settings.majoration_retard_mois * mois)

  return {
    en_retard: true,
    jours_retard: jours,
    mois_retard: mois,
    majoration_retard: majoration,
    total_estime: cotisations + majoration
  }
}

/**
 * Majoration pour non-production : le salarié qui aurait dû figurer sur la
 * déclaration et n'y est pas. Exprimée en part du SMIG, par salarié omis.
 */
export function estimerNonProduction(
  salariesOmis: number,
  settings: PayrollSettings
): { salaries: number; montant: number; formule: string } {
  const unitaire = Math.round(settings.smig * settings.non_production_smig)
  return {
    salaries: Math.max(0, salariesOmis),
    montant: Math.max(0, salariesOmis) * unitaire,
    formule: `${salariesOmis} salarié(s) × ${(settings.non_production_smig * 100)
      .toFixed(2)
      .replace('.', ',')} % du SMIG (${settings.smig.toLocaleString('fr-FR')}) = ${unitaire.toLocaleString('fr-FR')} par salarié`
  }
}

/**
 * Taxation d'office : lorsqu'aucune déclaration n'a été produite pour une
 * période échue, la CNSS évalue elle-même les cotisations et les majore.
 * L'assiette retenue ici est celle que l'application sait calculer — la CNSS
 * peut retenir la sienne, d'où le mot « estimation ».
 */
export function estimerTaxationOffice(
  cotisationsEstimees: number,
  settings: PayrollSettings
): { montant: number; total: number; formule: string } {
  const montant = Math.round(cotisationsEstimees * settings.taxation_office)
  return {
    montant,
    total: cotisationsEstimees + montant,
    formule: `${cotisationsEstimees.toLocaleString('fr-FR')} × ${(settings.taxation_office * 100)
      .toFixed(2)
      .replace('.', ',')} %`
  }
}

/** Phrase courte pour une pastille ou une ligne de tableau. */
export function libelleRetard(e: EstimationPenalites, taux: number): string {
  if (!e.en_retard) return 'Dans les délais'
  return `${e.mois_retard} mois entamé(s) × ${(taux * 100).toFixed(2).replace('.', ',')} %`
}
