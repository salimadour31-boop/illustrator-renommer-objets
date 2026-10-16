# RenommerObjets.jsx / Rename Objects

**v1.0.0** — Adobe Illustrator ExtendScript (ES3)

Renommage en masse des **objets et groupes sélectionnés** (pas les calques — voir [RenommerCalques](https://github.com/salimadour31-boop/illustrator-renommer-calques)).

Batch rename of **selected objects and groups** (not layers — see RenommerCalques).

> **Statut / Status :** non testé dans Illustrator — syntaxe ES3 vérifiée (acorn).  
> **Status:** not tested in Illustrator — ES3 syntax checked (acorn).

> **Conseil :** travaillez toujours sur une **copie** de votre fichier.  
> **Tip:** always work on a **copy** of your file.

Aucune connexion réseau, aucune collecte de données.  
No network access, no data collection.

## Fonctionnalités / Features

| FR | EN |
|---|---|
| Portée : sélection uniquement | Scope: selection only |
| Préfixe / Suffixe | Prefix / Suffix |
| Trouver / remplacer (casse optionnelle) | Find / replace (optional case match) |
| Numérotation (départ, pas, padding) | Numbering (start, step, padding) |
| Modèle `{name}` `{n}` `{nn}` `{nnn}` `{type}` `{parent}` | Template tokens |
| Ignorer verrouillés / masqués | Skip locked / hidden |
| Inclure contenus des groupes (récursif) ou top-level | Include group contents (recursive) or top-level only |
| Bouton **Analyser** : aperçu avant→après | **Analyze** button: before→after preview |
| Appliquer en une opération annulable | Apply in one undoable operation |
| Dialogue ScriptUI FR/EN (bouton de langue) | ScriptUI dialog FR/EN (language toggle) |

## Installation

1. **Fichier > Scripts > Autre script…** puis choisissez `RenommerObjets.jsx`  
   **File > Scripts > Other Script…** then pick `RenommerObjets.jsx`
2. Ou copiez le fichier dans le dossier Presets/Scripts d’Illustrator, puis redémarrez :  
   Or copy the file into Illustrator’s Presets/Scripts folder, then restart:
   - macOS : `/Applications/Adobe Illustrator <version>/Presets/<locale>/Scripts/`
   - Windows : `C:\Program Files\Adobe\Adobe Illustrator <version>\Presets\<locale>\Scripts\`

## Utilisation / Usage

1. Ouvrez un document et sélectionnez des objets ou groupes.  
   Open a document and select objects or groups.
2. Lancez le script.  
   Run the script.
3. Choisissez le mode (préfixe, suffixe, remplacer, numéroter, modèle).  
   Choose the mode (prefix, suffix, replace, number, template).
4. Cliquez **Analyser** pour l’aperçu, puis **Appliquer**.  
   Click **Analyze** for the preview, then **Apply**.
5. Annulez via **Édition > Annuler** si besoin.  
   Undo via **Edit > Undo** if needed.

Si aucun document n’est ouvert, ou si la sélection est vide, un message clair s’affiche (FR/EN).  
If no document is open, or the selection is empty, a clear message is shown (FR/EN).

## Version cible / Target version

Adobe Illustrator **CC 2018 – 2026** (ExtendScript ES3).

## Licence

MIT — Copyright (c) 2026 Amirouche Amwanes. Voir [LICENSE](LICENSE).
