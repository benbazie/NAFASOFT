import { dialog, BrowserWindow } from 'electron'
import { writeFileSync } from 'fs'

/**
 * Enregistre un contenu CSV sur le disque via une boîte de dialogue « Enregistrer sous ».
 * Le BOM UTF-8 garantit un affichage correct des accents dans Excel.
 * Retourne le chemin choisi, ou null si l'utilisateur annule.
 */
export async function saveCsv(nomDefaut: string, contenu: string): Promise<string | null> {
  const fenetre = BrowserWindow.getFocusedWindow() ?? undefined
  const { canceled, filePath } = await dialog.showSaveDialog(fenetre!, {
    title: 'Exporter en CSV',
    defaultPath: nomDefaut,
    filters: [{ name: 'Fichier CSV (Excel)', extensions: ['csv'] }]
  })
  if (canceled || !filePath) return null
  writeFileSync(filePath, '﻿' + contenu, 'utf8')
  return filePath
}
