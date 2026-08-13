/** Import et redimensionnement d'images (logo, etc.), côté renderer. */

/**
 * Réduit une image à `maxCote` pixels de côté.
 *
 * En PNG par défaut : un logo comporte souvent de la transparence, que le JPEG
 * remplacerait par un fond noir ou blanc. Les photos de salariés, elles,
 * restent en JPEG (voir `EmployeesPage`) car la transparence n'y sert à rien
 * et le poids compte davantage.
 */
export function redimensionnerImage(
  dataUri: string,
  maxCote: number,
  format: 'image/png' | 'image/jpeg' = 'image/png'
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const echelle = Math.min(1, maxCote / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(img.width * echelle))
      canvas.height = Math.max(1, Math.round(img.height * echelle))
      const ctx = canvas.getContext('2d')
      if (!ctx) return resolve(dataUri)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL(format, 0.9))
    }
    img.onerror = () => resolve(dataUri)
    img.src = dataUri
  })
}

/** Ouvre le sélecteur de fichier et renvoie le logo redimensionné, ou null. */
export async function importerLogo(): Promise<string | null> {
  const brut = await window.api.files.chooseImage()
  if (!brut) return null
  return redimensionnerImage(brut, 320, 'image/png')
}
