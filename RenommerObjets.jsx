//@target illustrator
/*
 * RenommerObjets.jsx  —  v1.0.0
 * ----------------------------------------------------------------------------
 * FR : Renommage en masse des objets et groupes sélectionnés (pas les calques).
 *      Portée : sélection uniquement.
 *      Modes : Préfixe, Suffixe, Remplacer (trouver/remplacer, casse optionnelle),
 *      Numéroter (préfixe + compteur avec padding, pas, départ),
 *      Modèle avec jetons {name}, {n}, {nn}, {nnn}, {type}, {parent}.
 *      Options : ignorer verrouillés/masqués ; inclure contenus des groupes
 *      (récursif) ou seulement le top-level de la sélection.
 *      Bouton « Analyser » : aperçu avant→après sans modification.
 *      Bouton « Appliquer » : renommage en une opération annulable
 *      (app.beginUndoGroup / endUndoGroup si disponibles).
 * EN : Batch rename of selected objects and groups (not layers).
 *      Scope: selection only.
 *      Modes: Prefix, Suffix, Replace (find/replace, optional case),
 *      Number (prefix + counter with zero-padding, step, start),
 *      Template with tokens {name}, {n}, {nn}, {nnn}, {type}, {parent}.
 *      Options: skip locked/hidden; include group contents (recursive)
 *      or top-level selection only.
 *      "Analyze" button: before→after preview without changing anything.
 *      "Apply" button: rename in one undoable operation
 *      (app.beginUndoGroup / endUndoGroup when available).
 *
 * Cible / Target : Illustrator CC (2018+) jusqu'aux versions récentes.
 * Statut / Status : NON TESTÉ DANS ILLUSTRATOR — syntaxe ES3 vérifiée (acorn).
 *                   NOT TESTED IN ILLUSTRATOR — ES3 syntax checked (acorn).
 * Conseil : travaillez sur une copie de votre fichier.
 * Tip     : work on a copy of your file.
 * Aucune connexion réseau, aucune collecte de données.
 * No network access, no data collection.
 *
 * Licence MIT — (c) 2026 Amirouche Amwanes. Code original.
 */

(function () {

    var VERSION = "1.0.0";

    // ------------------------------------------------------------------
    // Langue / Language (toggle FR/EN, défaut selon locale)
    // ------------------------------------------------------------------
    var FR = String($.locale || app.locale || "").toLowerCase().indexOf("fr") === 0;
    function t(fr, en) { return FR ? fr : en; }

    // ------------------------------------------------------------------
    // Garde-fous / Guards
    // ------------------------------------------------------------------
    if (app.documents.length === 0) {
        alert(t("Aucun document ouvert.\nOuvrez un document puis relancez le script.",
                "No document open.\nOpen a document and run the script again."));
        return;
    }

    var doc = app.activeDocument;

    // ------------------------------------------------------------------
    // Modes / Modes
    // ------------------------------------------------------------------
    var MODE_PREFIX  = 0;
    var MODE_SUFFIX  = 1;
    var MODE_REPLACE = 2;
    var MODE_NUMBER  = 3;
    var MODE_TMPL    = 4;

    // ------------------------------------------------------------------
    // Utilitaires ES3 / ES3 helpers
    // ------------------------------------------------------------------

    function safe(fn, fallback) {
        try { return fn(); } catch (e) { return fallback; }
    }

    function padNumber(n, width) {
        var s = String(n);
        while (s.length < width) { s = "0" + s; }
        return s;
    }

    /**
     * Remplace toutes les occurrences (boucle indexOf, pas de regex).
     * Replace all occurrences (indexOf loop, no regex).
     */
    function replaceAll(haystack, needle, replacement, caseSensitive) {
        if (!needle || needle.length === 0) { return String(haystack); }
        var source = String(haystack);
        var result = "";
        var pos = 0;
        var idx;
        var cmpSrc = caseSensitive ? source : source.toLowerCase();
        var cmpNdl = caseSensitive ? String(needle) : String(needle).toLowerCase();
        var nLen = needle.length;

        while (true) {
            idx = cmpSrc.indexOf(cmpNdl, pos);
            if (idx < 0) {
                result += source.substring(pos);
                break;
            }
            result += source.substring(pos, idx);
            result += String(replacement);
            pos = idx + nLen;
        }
        return result;
    }

    /**
     * Libellé de type d'objet (FR/EN).
     * Object type label (FR/EN).
     */
    function typeLabel(item) {
        var tn = safe(function () { return String(item.typename); }, "");
        var map = {
            "PathItem":          t("Tracé", "Path"),
            "CompoundPathItem":  t("Tracé composé", "Compound path"),
            "GroupItem":         t("Groupe", "Group"),
            "TextFrame":         t("Texte", "Text"),
            "PlacedItem":        t("Image liée", "Linked image"),
            "RasterItem":        t("Image pixellisée", "Raster"),
            "SymbolItem":        t("Symbole", "Symbol"),
            "MeshItem":          t("Filet", "Mesh"),
            "PluginItem":        t("Plugin", "Plugin"),
            "GraphItem":         t("Graphique", "Graph"),
            "NonNativeItem":     t("Non natif", "Non-native"),
            "LegacyTextItem":    t("Texte ancien", "Legacy text")
        };
        if (map[tn]) { return map[tn]; }
        return tn || t("Objet", "Object");
    }

    /**
     * Nom du parent (groupe ou calque), ou "".
     * Parent name (group or layer), or "".
     */
    function getParentName(item) {
        return safe(function () {
            var p = item.parent;
            if (!p) { return ""; }
            if (p.typename === "Document") { return ""; }
            if (p.typename === "Layer" || p.typename === "GroupItem") {
                return String(p.name || "");
            }
            return "";
        }, "");
    }

    /**
     * Remplace les jetons du modèle.
     * Replace template tokens.
     * Jetons / Tokens : {name}, {n}, {nn}, {nnn}, {type}, {parent}
     */
    function applyTemplate(tmpl, name, n, typeStr, parentName) {
        var s = String(tmpl);
        s = replaceAll(s, "{name}", name, true);
        s = replaceAll(s, "{type}", typeStr, true);
        s = replaceAll(s, "{parent}", parentName, true);
        s = replaceAll(s, "{nnn}", padNumber(n, 3), true);
        s = replaceAll(s, "{nn}", padNumber(n, 2), true);
        s = replaceAll(s, "{n}", String(n), true);
        return s;
    }

    /**
     * Calcule le nouveau nom selon le mode et les options.
     * Compute the new name for the given mode and options.
     * opts.counter est un objet { value: number } muté pour Numéroter / Modèle.
     */
    function computeNewName(oldName, typeStr, parentName, opts) {
        var mode = opts.mode;
        var name = String(oldName);
        var n;

        if (mode === MODE_PREFIX) {
            return String(opts.text) + name;
        }
        if (mode === MODE_SUFFIX) {
            return name + String(opts.text);
        }
        if (mode === MODE_REPLACE) {
            return replaceAll(name, opts.find, opts.replace, opts.caseSensitive);
        }
        if (mode === MODE_NUMBER) {
            n = opts.counter.value;
            opts.counter.value = n + opts.step;
            return String(opts.prefix) + padNumber(n, opts.pad);
        }
        if (mode === MODE_TMPL) {
            n = opts.counter.value;
            opts.counter.value = n + opts.step;
            return applyTemplate(opts.template, name, n, typeStr, parentName);
        }
        return name;
    }

    // ------------------------------------------------------------------
    // Collecte des objets / Object collection
    // ------------------------------------------------------------------

    /**
     * Vérifie si un item est déjà dans la liste (évite doublons récursifs).
     * Check whether an item is already in the list (avoid recursive duplicates).
     */
    function alreadyListed(out, item) {
        var i;
        for (i = 0; i < out.length; i++) {
            if (out[i].item === item) { return true; }
        }
        return false;
    }

    /**
     * Ajoute un PageItem (et éventuellement ses enfants de groupe).
     * Add a PageItem (and optionally its group children).
     */
    function collectItem(item, recursive, opts, out) {
        if (!item) { return; }
        if (alreadyListed(out, item)) { return; }

        var locked = safe(function () { return item.locked; }, false);
        var hidden = safe(function () { return item.hidden; }, false);
        var name = safe(function () { return String(item.name); }, "");
        var parentName = getParentName(item);
        var typeStr = typeLabel(item);
        var skipReason = null;

        if (opts.ignoreLocked && locked) {
            skipReason = t("verrouillé", "locked");
        } else if (opts.ignoreHidden && hidden) {
            skipReason = t("masqué", "hidden");
        }

        out.push({
            item: item,
            name: name,
            typeStr: typeStr,
            parentName: parentName,
            skipReason: skipReason
        });

        if (recursive) {
            var isGroup = safe(function () { return item.typename === "GroupItem"; }, false);
            if (isGroup) {
                var kids = safe(function () { return item.pageItems; }, null);
                if (kids) {
                    var i;
                    for (i = 0; i < kids.length; i++) {
                        collectItem(kids[i], true, opts, out);
                    }
                }
            }
        }
    }

    /**
     * Collecte depuis la sélection.
     * Collect from selection.
     * recursive : true = inclure contenus des groupes
     */
    function collectFromSelection(recursive, opts) {
        var out = [];
        var sel = null;
        try {
            sel = doc.selection;
        } catch (eSel) {
            sel = null;
        }
        if (!sel || sel.length === 0) {
            return out;
        }
        var i;
        for (i = 0; i < sel.length; i++) {
            collectItem(sel[i], recursive, opts, out);
        }
        return out;
    }

    /**
     * Construit la liste d'aperçu avant→après (sans modifier).
     * Build before→after preview list (no modification).
     */
    function buildPreview(entries, opts) {
        var counter = { value: opts.start };
        var runOpts = {
            mode: opts.mode,
            text: opts.text,
            find: opts.find,
            replace: opts.replace,
            caseSensitive: opts.caseSensitive,
            prefix: opts.prefix,
            pad: opts.pad,
            step: opts.step,
            template: opts.template,
            counter: counter
        };
        var lines = [];
        var renameCount = 0;
        var skipCount = 0;
        var sameCount = 0;
        var i, e, newName, line, label;

        for (i = 0; i < entries.length; i++) {
            e = entries[i];
            label = e.name || ("<" + e.typeStr + ">");
            if (e.skipReason) {
                skipCount++;
                line = label + "  →  [" + t("ignoré", "skipped") + ": " + e.skipReason + "]";
                lines.push(line);
                continue;
            }
            newName = computeNewName(e.name, e.typeStr, e.parentName, runOpts);
            if (newName === e.name) {
                sameCount++;
                line = label + "  →  " + (newName || "\"\"") + "  (" + t("inchangé", "unchanged") + ")";
            } else {
                renameCount++;
                line = label + "  →  " + newName;
            }
            lines.push(line);
            e.newName = newName;
        }
        return {
            lines: lines,
            renameCount: renameCount,
            skipCount: skipCount,
            sameCount: sameCount,
            total: entries.length
        };
    }

    /**
     * Applique les renommages en une passe (undo group si dispo).
     * Apply renames in one pass (undo group when available).
     */
    function applyRenames(entries, opts) {
        var counter = { value: opts.start };
        var runOpts = {
            mode: opts.mode,
            text: opts.text,
            find: opts.find,
            replace: opts.replace,
            caseSensitive: opts.caseSensitive,
            prefix: opts.prefix,
            pad: opts.pad,
            step: opts.step,
            template: opts.template,
            counter: counter
        };
        var renamed = 0;
        var skipped = 0;
        var failed = 0;
        var i, e, newName;

        var hasUndo = false;
        try {
            if (typeof app.beginUndoGroup === "function") {
                app.beginUndoGroup(t("Renommer objets", "Rename objects"));
                hasUndo = true;
            }
        } catch (eUndo) { hasUndo = false; }

        try {
            for (i = 0; i < entries.length; i++) {
                e = entries[i];
                if (e.skipReason) {
                    skipped++;
                    continue;
                }
                if (typeof e.newName === "string") {
                    newName = e.newName;
                    if (opts.mode === MODE_NUMBER || opts.mode === MODE_TMPL) {
                        runOpts.counter.value += opts.step;
                    }
                } else {
                    newName = computeNewName(e.name, e.typeStr, e.parentName, runOpts);
                }
                if (newName === e.name) { continue; }
                try {
                    e.item.name = newName;
                    renamed++;
                } catch (eSet) {
                    failed++;
                }
            }
            try { app.redraw(); } catch (eRedraw) { /* ignore */ }
        } finally {
            if (hasUndo) {
                try { app.endUndoGroup(); } catch (eEnd) { /* ignore */ }
            }
        }
        return { renamed: renamed, skipped: skipped, failed: failed };
    }

    // ------------------------------------------------------------------
    // Dialogue ScriptUI / ScriptUI dialog
    // ------------------------------------------------------------------

    function showDialog() {
        var dlg = new Window("dialog", t("Renommer objets", "Rename objects") + "  v" + VERSION);
        dlg.orientation = "column";
        dlg.alignChildren = ["fill", "top"];
        dlg.spacing = 8;
        dlg.margins = 14;

        // --- Langue + conseil / Language + tip ---
        var gTop = dlg.add("group");
        gTop.orientation = "row";
        gTop.alignChildren = ["left", "center"];
        var tip = gTop.add("statictext", undefined,
            t("Conseil : travaillez sur une copie de votre fichier.",
              "Tip: work on a copy of your file."));
        tip.graphics.font = ScriptUI.newFont(tip.graphics.font.name, ScriptUI.FontStyle.ITALIC, tip.graphics.font.size);
        gTop.add("statictext", undefined, "  ");
        var btnLang = gTop.add("button", undefined, FR ? "EN" : "FR");
        btnLang.preferredSize = [40, 22];

        // --- Portée / Scope ---
        var gScope = dlg.add("panel", undefined, t("Portée", "Scope"));
        gScope.orientation = "column";
        gScope.alignChildren = ["left", "top"];
        gScope.margins = 12;
        var lblScope = gScope.add("statictext", undefined,
            t("Sélection uniquement (objets / groupes).",
              "Selection only (objects / groups)."));
        var cbRecursive = gScope.add("checkbox", undefined,
            t("Inclure le contenu des groupes (récursif)",
              "Include group contents (recursive)"));
        cbRecursive.value = false;
        var lblTopOnly = gScope.add("statictext", undefined,
            t("Décoché = seulement le top-level de la sélection.",
              "Unchecked = top-level of selection only."));

        // --- Mode ---
        var gMode = dlg.add("panel", undefined, t("Mode", "Mode"));
        gMode.orientation = "column";
        gMode.alignChildren = ["left", "top"];
        gMode.margins = 12;
        var rbPrefix  = gMode.add("radiobutton", undefined, t("Préfixe", "Prefix"));
        var rbSuffix  = gMode.add("radiobutton", undefined, t("Suffixe", "Suffix"));
        var rbReplace = gMode.add("radiobutton", undefined, t("Remplacer (trouver / remplacer)", "Replace (find / replace)"));
        var rbNumber  = gMode.add("radiobutton", undefined, t("Numéroter", "Number"));
        var rbTmpl    = gMode.add("radiobutton", undefined,
            t("Modèle ({name}, {n}, {nn}, {nnn}, {type}, {parent})",
              "Template ({name}, {n}, {nn}, {nnn}, {type}, {parent})"));
        rbPrefix.value = true;

        // --- Options selon le mode / Mode-specific options ---
        var gOpts = dlg.add("panel", undefined, t("Options du mode", "Mode options"));
        gOpts.orientation = "column";
        gOpts.alignChildren = ["fill", "top"];
        gOpts.margins = 12;

        var rowText = gOpts.add("group");
        rowText.orientation = "row";
        rowText.alignChildren = ["left", "center"];
        var lblText = rowText.add("statictext", undefined, t("Texte :", "Text:"));
        var etText = rowText.add("edittext", undefined, "");
        etText.preferredSize = [280, 22];

        var rowFind = gOpts.add("group");
        rowFind.orientation = "row";
        rowFind.alignChildren = ["left", "center"];
        var lblFind = rowFind.add("statictext", undefined, t("Trouver :", "Find:"));
        var etFind = rowFind.add("edittext", undefined, "");
        etFind.preferredSize = [260, 22];

        var rowRepl = gOpts.add("group");
        rowRepl.orientation = "row";
        rowRepl.alignChildren = ["left", "center"];
        var lblRepl = rowRepl.add("statictext", undefined, t("Remplacer par :", "Replace with:"));
        var etRepl = rowRepl.add("edittext", undefined, "");
        etRepl.preferredSize = [220, 22];

        var cbCase = gOpts.add("checkbox", undefined, t("Respecter la casse", "Match case"));
        cbCase.value = false;

        var rowNum = gOpts.add("group");
        rowNum.orientation = "row";
        rowNum.alignChildren = ["left", "center"];
        var lblPrefix = rowNum.add("statictext", undefined, t("Préfixe n° :", "Number prefix:"));
        var etPrefix = rowNum.add("edittext", undefined, "Objet_");
        etPrefix.preferredSize = [100, 22];
        var lblStart = rowNum.add("statictext", undefined, t("Départ :", "Start:"));
        var etStart = rowNum.add("edittext", undefined, "1");
        etStart.preferredSize = [40, 22];
        var lblStep = rowNum.add("statictext", undefined, t("Pas :", "Step:"));
        var etStep = rowNum.add("edittext", undefined, "1");
        etStep.preferredSize = [40, 22];
        var lblPad = rowNum.add("statictext", undefined, t("Chiffres :", "Digits:"));
        var etPad = rowNum.add("edittext", undefined, "2");
        etPad.preferredSize = [36, 22];

        var rowTmpl = gOpts.add("group");
        rowTmpl.orientation = "row";
        rowTmpl.alignChildren = ["left", "center"];
        var lblTmpl = rowTmpl.add("statictext", undefined, t("Modèle :", "Template:"));
        var etTmpl = rowTmpl.add("edittext", undefined, "{type}_{name}_{nn}");
        etTmpl.preferredSize = [260, 22];

        var lblTmplHelp = gOpts.add("statictext", undefined,
            t("{name}=nom, {n}/{nn}/{nnn}=compteur, {type}=type, {parent}=parent",
              "{name}=name, {n}/{nn}/{nnn}=counter, {type}=type, {parent}=parent"),
            { multiline: false });

        // --- Filtres / Filters ---
        var gFilt = dlg.add("panel", undefined, t("Filtres", "Filters"));
        gFilt.orientation = "column";
        gFilt.alignChildren = ["left", "top"];
        gFilt.margins = 12;
        var cbIgnLock = gFilt.add("checkbox", undefined,
            t("Ignorer les objets verrouillés", "Skip locked objects"));
        cbIgnLock.value = true;
        var cbIgnHid = gFilt.add("checkbox", undefined,
            t("Ignorer les objets masqués", "Skip hidden objects"));
        cbIgnHid.value = true;

        // --- Aperçu / Preview ---
        var gPrev = dlg.add("panel", undefined, t("Aperçu (Analyser)", "Preview (Analyze)"));
        gPrev.orientation = "column";
        gPrev.alignChildren = ["fill", "top"];
        gPrev.margins = 12;
        var etPrev = gPrev.add("edittext", undefined, "", { multiline: true, scrolling: true, readonly: true });
        etPrev.preferredSize = [480, 140];
        var lblSummary = gPrev.add("statictext", undefined,
            t("Cliquez sur Analyser pour un aperçu.", "Click Analyze for a preview."));

        // --- Boutons / Buttons ---
        var gBtn = dlg.add("group");
        gBtn.orientation = "row";
        gBtn.alignment = ["right", "bottom"];
        var btnAnalyze = gBtn.add("button", undefined, t("Analyser", "Analyze"));
        var btnApply   = gBtn.add("button", undefined, t("Appliquer", "Apply"));
        var btnCancel  = gBtn.add("button", undefined, t("Annuler", "Cancel"), { name: "cancel" });

        // --- Visibilité des champs selon le mode / Field visibility by mode ---
        function currentMode() {
            if (rbPrefix.value)  { return MODE_PREFIX; }
            if (rbSuffix.value)  { return MODE_SUFFIX; }
            if (rbReplace.value) { return MODE_REPLACE; }
            if (rbNumber.value)  { return MODE_NUMBER; }
            if (rbTmpl.value)    { return MODE_TMPL; }
            return MODE_PREFIX;
        }

        function updateModeUI() {
            var m = currentMode();
            rowText.visible  = (m === MODE_PREFIX || m === MODE_SUFFIX);
            rowFind.visible  = (m === MODE_REPLACE);
            rowRepl.visible  = (m === MODE_REPLACE);
            cbCase.visible   = (m === MODE_REPLACE);
            rowNum.visible   = (m === MODE_NUMBER || m === MODE_TMPL);
            rowTmpl.visible  = (m === MODE_TMPL);
            lblTmplHelp.visible = (m === MODE_TMPL);
            dlg.layout.layout(true);
        }

        rbPrefix.onClick  = updateModeUI;
        rbSuffix.onClick  = updateModeUI;
        rbReplace.onClick = updateModeUI;
        rbNumber.onClick  = updateModeUI;
        rbTmpl.onClick    = updateModeUI;
        updateModeUI();

        // --- Lecture des options / Read options from UI ---
        function readOpts() {
            var start = parseInt(etStart.text, 10);
            var step  = parseInt(etStep.text, 10);
            var pad   = parseInt(etPad.text, 10);
            if (isNaN(start) || start < 0) { start = 1; }
            if (isNaN(step) || step === 0) { step = 1; }
            if (isNaN(pad) || pad < 1) { pad = 1; }
            if (pad > 8) { pad = 8; }
            return {
                mode: currentMode(),
                text: etText.text,
                find: etFind.text,
                replace: etRepl.text,
                caseSensitive: cbCase.value,
                prefix: etPrefix.text,
                start: start,
                step: step,
                pad: pad,
                template: etTmpl.text,
                ignoreLocked: cbIgnLock.value,
                ignoreHidden: cbIgnHid.value,
                recursive: cbRecursive.value
            };
        }

        var cachedEntries = null;
        var cachedOptsKey = null;

        function optsKey(o) {
            return [
                o.mode, o.text, o.find, o.replace, o.caseSensitive,
                o.prefix, o.start, o.step, o.pad, o.template,
                o.ignoreLocked, o.ignoreHidden, o.recursive
            ].join("|");
        }

        function doAnalyze() {
            var opts = readOpts();
            if (opts.mode === MODE_REPLACE && (!opts.find || opts.find.length === 0)) {
                alert(t("Indiquez la chaîne à trouver.", "Enter the find string."));
                return null;
            }
            if (opts.mode === MODE_TMPL && (!opts.template || opts.template.length === 0)) {
                alert(t("Indiquez un modèle.", "Enter a template."));
                return null;
            }
            var collectOpts = {
                ignoreLocked: opts.ignoreLocked,
                ignoreHidden: opts.ignoreHidden
            };
            var entries = collectFromSelection(opts.recursive, collectOpts);
            if (entries.length === 0) {
                alert(t(
                    "Aucun objet sélectionné.\nSélectionnez des objets ou groupes, puis relancez Analyser.",
                    "No objects selected.\nSelect objects or groups, then click Analyze again."
                ));
                etPrev.text = "";
                lblSummary.text = t("Aucune sélection.", "No selection.");
                cachedEntries = null;
                return null;
            }
            var preview = buildPreview(entries, opts);
            etPrev.text = preview.lines.join("\n");
            lblSummary.text = t(
                preview.total + " objet(s) — " + preview.renameCount + " à renommer, " +
                preview.sameCount + " inchangé(s), " + preview.skipCount + " ignoré(s).",
                preview.total + " object(s) — " + preview.renameCount + " to rename, " +
                preview.sameCount + " unchanged, " + preview.skipCount + " skipped."
            );
            cachedEntries = entries;
            cachedOptsKey = optsKey(opts);
            return { entries: entries, preview: preview, opts: opts };
        }

        btnAnalyze.onClick = function () {
            doAnalyze();
        };

        btnApply.onClick = function () {
            var opts = readOpts();
            if (opts.mode === MODE_REPLACE && (!opts.find || opts.find.length === 0)) {
                alert(t("Indiquez la chaîne à trouver.", "Enter the find string."));
                return;
            }
            if (opts.mode === MODE_TMPL && (!opts.template || opts.template.length === 0)) {
                alert(t("Indiquez un modèle.", "Enter a template."));
                return;
            }

            var entries;
            var key = optsKey(opts);
            if (cachedEntries && cachedOptsKey === key) {
                entries = cachedEntries;
            } else {
                var result = doAnalyze();
                if (!result) { return; }
                entries = result.entries;
                opts = result.opts;
            }

            var toRename = 0;
            var i;
            for (i = 0; i < entries.length; i++) {
                if (!entries[i].skipReason && entries[i].newName && entries[i].newName !== entries[i].name) {
                    toRename++;
                }
            }
            if (toRename === 0) {
                alert(t("Aucun objet à renommer avec ces options.",
                        "No objects to rename with these options."));
                return;
            }

            var ok = confirm(t(
                "Renommer " + toRename + " objet(s) ?\nCette opération est annulable (Édition > Annuler).",
                "Rename " + toRename + " object(s)?\nThis operation is undoable (Edit > Undo)."
            ));
            if (!ok) { return; }

            var res = applyRenames(entries, opts);
            dlg.close(1);
            alert(t(
                "Terminé.\nRenommés : " + res.renamed +
                "\nIgnorés : " + res.skipped +
                (res.failed ? ("\nÉchecs : " + res.failed) : "") +
                "\n\nÉdition > Annuler pour revenir en arrière si besoin.",
                "Done.\nRenamed: " + res.renamed +
                "\nSkipped: " + res.skipped +
                (res.failed ? ("\nFailed: " + res.failed) : "") +
                "\n\nEdit > Undo to revert if needed."
            ));
        };

        // Toggle langue : ferme et rouvre avec l'autre langue
        // Language toggle: close and reopen with the other language
        btnLang.onClick = function () {
            FR = !FR;
            dlg.close(2);
        };

        dlg.center();
        var result = dlg.show();
        if (result === 2) {
            showDialog();
        }
    }

    // Vérification sélection vide au démarrage (message clair)
    // Empty-selection check at startup (clear message)
    var sel0 = null;
    try { sel0 = doc.selection; } catch (e0) { sel0 = null; }
    if (!sel0 || sel0.length === 0) {
        alert(t(
            "Aucun objet sélectionné.\nSélectionnez des objets ou groupes, puis relancez le script.",
            "No objects selected.\nSelect objects or groups, then run the script again."
        ));
        return;
    }

    showDialog();

})();
