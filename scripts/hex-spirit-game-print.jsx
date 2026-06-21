#target photoshop

/**
 * Hex Spirit Game Print Builder (frames_final.psd)
 * -------------------------------------------
 * This script consumes the CSV + art raw bundle exported from the Hex Spirits admin page.
 * Update the four paths below to point to your local template, CSV, art folder, and output directory
 * before running inside Photoshop.
 *
 * PSD structure: 6 frame tiers (spirit_world, abyss, arcane, fairy, human_enclave, royal_family)
 * Each tier has origin-themed sub-groups (tidal, forest, lantern, cyber, astral, void).
 * The CSV provides Tier and OriginSubfolder columns to determine which layers to activate.
 *
 * Back-side overlays live under TWO top-level groups with identical inner structure:
 *   back_overlay                 — used when subfolder ∈ {forest, florest, lantern, tidal, cyber}
 *   human_abyss_back_overlay       — used for everyone else (astral, void, human_enclave, royal_family)
 * Inner structure (per group):
 *   AWAKEN_REQ      — DISCARD TO AWAKEN label + REQUIREMENT text
 *   SPECIAL_CLASS   — panel with info > CLASS_NAME / CLASS_DESC (note trailing space in PSD name)
 *
 * Exports two images per spirit into one folder:
 *   game_prints/<SpiritID>_front_game_print.png  — tier overlay visible, both back groups hidden
 *   game_prints/<SpiritID>_back_game_print.png   — tier overlay visible, correct back group visible
 */

// === CONFIGURATION ===
var templateFile = new File('/Users/maikyon/Library/CloudStorage/GoogleDrive-michaelmqvu@gmail.com/My Drive/Arc Spirits/frames_final.psd');
var scriptFolder = File($.fileName).parent;
var packRoot = scriptFolder ? scriptFolder.parent : Folder.current;
var csvFile = new File(packRoot + '/hex_spirits_art_raw.csv');
var artFolder = new Folder(packRoot + '/art_raw');
var exportFolder = new Folder(packRoot + '/game_prints');

// Optional: export ONLY a specific layer group (LayerSet) instead of the whole PSD canvas.
var exportLayerGroupPath = null;
var exportTrimToGroupBounds = false;

// === TIER / ORIGIN DEFINITIONS ===
var ALL_TIERS = ['spirit_world', 'abyss', 'arcane', 'fairy', 'human_enclave', 'royal_family'];
var TIER_SUBGROUPS = {
    'spirit_world': ['tidal', 'forest', 'lantern', 'cyber'],
    'abyss': ['forest', 'lantern', 'tidal', 'cyber', 'astral', 'void'],
    'arcane': ['tidal', 'florest', 'lantern', 'cyber'],
    'fairy': ['lantern', 'tidal', 'forest', 'cyber'],
    'human_enclave': [],
    'royal_family': []
};

validatePath(templateFile, 'Template PSD');
validatePath(csvFile, 'CSV data');
validatePath(artFolder, 'Art raw folder');
if (!exportFolder.exists) exportFolder.create();

var csvRows = readCSV(csvFile);
if (!csvRows || csvRows.length === 0) {
    alert('CSV is empty. Re-export from the Hex Spirits admin.');
    exit();
}

var header = csvRows.shift();
var rows = [];
for (var r = 0; r < csvRows.length; r++) {
    var row = {};
    var line = csvRows[r];
    for (var c = 0; c < header.length; c++) {
        row[header[c]] = line && line[c] ? line[c] : '';
    }
    rows.push(row);
}

var unique = uniqueRows(rows);

// Suppress all dialogs during batch processing
var originalDialogMode = app.displayDialogs;
app.displayDialogs = DialogModes.NO;

// Open template once
var doc = app.open(templateFile);
var failedItems = [];
var skippedItems = [];
var successCount = 0;

// Cache the placeholder layer reference BEFORE any replacements (name changes after first replace)
var artPlaceholder = findLayer(doc, ['art', 'IMAGE_PLACEHOLDER']);
if (!artPlaceholder) {
    alert('IMAGE_PLACEHOLDER layer not found in template (expected at art > IMAGE_PLACEHOLDER)');
    doc.close(SaveOptions.DONOTSAVECHANGES);
    app.displayDialogs = originalDialogMode;
    exit();
}

// Subfolders that use the normal `back_overlay`; everything else uses `human_abyss_back_overlay`.
// "florest" is the (typo) subfolder in the arcane tier for Floral Patch.
var NORMAL_BACK_SUBFOLDERS = { forest: 1, florest: 1, lantern: 1, tidal: 1, cyber: 1 };

function isNormalBackSubfolder(subfolder) {
    return !!(subfolder && NORMAL_BACK_SUBFOLDERS[subfolder]);
}

// Cache both back-side overlay groups and their inner layer refs.
function buildBackOverlayCache(doc, topGroupName) {
    var topGroup = findLayer(doc, [topGroupName]);
    if (!topGroup) return null;
    var awakenReq = findLayer(doc, [topGroupName, 'AWAKEN_REQ']);
    var special = findLayer(doc, [topGroupName, 'SPECIAL_CLASS '])
        || findLayer(doc, [topGroupName, 'SPECIAL_CLASS']);
    var reqText = awakenReq ? findNamedTextLayer(awakenReq, 'REQUIREMENT') : null;
    var nameText = special ? findNamedTextLayer(special, 'CLASS_NAME') : null;
    var descText = special ? findNamedTextLayer(special, 'CLASS_DESC') : null;
    return {
        topGroup: topGroup,
        awakenReqGroup: awakenReq,
        awakenReqTextLayer: reqText,
        awakenReqTextOrigPos: reqText ? [reqText.textItem.position[0], reqText.textItem.position[1]] : null,
        awakenLabelDiscardLayer: awakenReq ? findLayer(awakenReq, ['DISCARD to awaken:']) : null,
        awakenLabelTextLayer: awakenReq ? findLayer(awakenReq, ['to awaken:']) : null,
        specialClassGroup: special,
        specialClassNameLayer: nameText,
        specialClassDescLayer: descText,
        specialClassNameOrigPos: nameText ? [nameText.textItem.position[0], nameText.textItem.position[1]] : null,
        specialClassDescOrigPos: descText ? [descText.textItem.position[0], descText.textItem.position[1]] : null
    };
}

var normalBackCache = buildBackOverlayCache(doc, 'back_overlay');
var noOriginBackCache = buildBackOverlayCache(doc, 'human_abyss_back_overlay');

if (!normalBackCache) {
    alert('back_overlay group not found in template.');
    doc.close(SaveOptions.DONOTSAVECHANGES);
    app.displayDialogs = originalDialogMode;
    exit();
}
if (!noOriginBackCache) {
    alert('human_abyss_back_overlay group not found in template — spirits without a normal-origin subfolder cannot be exported.');
    doc.close(SaveOptions.DONOTSAVECHANGES);
    app.displayDialogs = originalDialogMode;
    exit();
}

// Cache the original placeholder bounds - must capture BEFORE first replacement
var originalPlaceholderRect = boundsToRect(artPlaceholder.bounds);

try {
    for (var i = 0; i < unique.length; i++) {
        var row = unique[i];
        var tier = row['Tier'];
        var subfolder = row['OriginSubfolder'];

        // Skip spirits without a valid tier/subfolder (cost 11+, unmapped origins)
        if (!tier || !subfolder) {
            skippedItems.push(row['Name'] + ' (no tier/subfolder)');
            continue;
        }

        var artFile = new File(artFolder + '/' + row['ArtRawFile']);
        if (!artFile.exists) {
            failedItems.push(row['Name'] + ' (missing: ' + row['ArtRawFile'] + ')');
            continue;
        }

        try {
            configureTierAndOrigin(doc, tier, subfolder);
            replaceLayerContents(doc, artPlaceholder, artFile, originalPlaceholderRect);
            updateSpiritName(doc, tier, subfolder, row['Name']);

            // Pick the correct back-overlay variant for this spirit's subfolder.
            var activeBack = isNormalBackSubfolder(subfolder) ? normalBackCache : noOriginBackCache;
            var inactiveBack = (activeBack === normalBackCache) ? noOriginBackCache : normalBackCache;

            // Configure AWAKEN_REQ overlay for back side (on the ACTIVE group only)
            var awakenType = row['AwakenType'] || 'none';
            if (activeBack.awakenReqGroup) {
                if (awakenType === 'none') {
                    activeBack.awakenReqGroup.visible = false;
                } else {
                    activeBack.awakenReqGroup.visible = true;
                    var isTextReq = (awakenType === 'text');
                    if (activeBack.awakenLabelTextLayer) activeBack.awakenLabelTextLayer.visible = isTextReq;
                    if (activeBack.awakenLabelDiscardLayer) activeBack.awakenLabelDiscardLayer.visible = !isTextReq;
                    if (isTextReq && activeBack.awakenReqTextLayer) {
                        activeBack.awakenReqTextLayer.visible = true;
                        activeBack.awakenReqTextLayer.textItem.contents = (row['AwakenText'] || '').replace(/^\s+/, '');
                        activeBack.awakenReqTextLayer.textItem.position = activeBack.awakenReqTextOrigPos;
                    } else if (activeBack.awakenReqTextLayer) {
                        activeBack.awakenReqTextLayer.visible = false;
                    }
                }
            }

            // Configure SPECIAL_CLASS overlay for back side (on the ACTIVE group only)
            var hasSpecialClass = row['SpecialClassName'] && row['SpecialClassName'].length > 0;
            if (activeBack.specialClassGroup) {
                activeBack.specialClassGroup.visible = !!hasSpecialClass;
                if (hasSpecialClass) {
                    if (activeBack.specialClassNameLayer) {
                        activeBack.specialClassNameLayer.textItem.contents = row['SpecialClassName'].replace(/^\s+/, '');
                        activeBack.specialClassNameLayer.textItem.position = activeBack.specialClassNameOrigPos;
                    }
                    if (activeBack.specialClassDescLayer) {
                        activeBack.specialClassDescLayer.textItem.contents = (row['SpecialClassDesc'] || '').replace(/^\s+/, '');
                        activeBack.specialClassDescLayer.textItem.position = activeBack.specialClassDescOrigPos;
                    }
                }
            }

            // Export front: hide BOTH back overlay groups
            normalBackCache.topGroup.visible = false;
            noOriginBackCache.topGroup.visible = false;
            savePng(doc, exportFolder, getSideExportFileName(row['GamePrintFile'], 'front'));

            // Export back: show active group, hide inactive; inner toggles already set above
            inactiveBack.topGroup.visible = false;
            activeBack.topGroup.visible = true;
            if (activeBack.awakenReqGroup) activeBack.awakenReqGroup.visible = (awakenType !== 'none');
            if (activeBack.specialClassGroup) activeBack.specialClassGroup.visible = !!hasSpecialClass;
            savePng(doc, exportFolder, getSideExportFileName(row['GamePrintFile'], 'back'));

            successCount++;
        } catch (err) {
            failedItems.push(row['Name'] + ' (' + tier + '/' + subfolder + '): ' + err.message);
        }
    }
} finally {
    doc.close(SaveOptions.DONOTSAVECHANGES);
    app.displayDialogs = originalDialogMode;
}

var msg = 'Export finished! ' + successCount + '/' + unique.length + ' spirits exported.';
msg += '\n  Prints: ' + exportFolder.fsName;
if (skippedItems.length > 0) {
    msg += '\n\nSkipped (' + skippedItems.length + '):\n' + skippedItems.slice(0, 5).join('\n');
    if (skippedItems.length > 5) msg += '\n... and ' + (skippedItems.length - 5) + ' more';
}
if (failedItems.length > 0) {
    msg += '\n\nFailed (' + failedItems.length + '):\n' + failedItems.slice(0, 10).join('\n');
    if (failedItems.length > 10) msg += '\n... and ' + (failedItems.length - 10) + ' more';
}
alert(msg);

// === TIER CONFIGURATION ===

function configureTierAndOrigin(doc, tier, subfolder) {
    // 1. Hide all tiers
    for (var t = 0; t < ALL_TIERS.length; t++) {
        var tierGroup = findLayer(doc, [ALL_TIERS[t]]);
        if (tierGroup) tierGroup.visible = false;
    }

    // 2. Show the target tier
    var activeTier = findLayer(doc, [tier]);
    if (!activeTier) throw new Error('Tier group not found: ' + tier);
    activeTier.visible = true;

    // 3. Hide ALL child layer sets within this tier (catches duplicates like abyss > astral x2)
    var subs = TIER_SUBGROUPS[tier];
    if (subs && subs.length > 0 && activeTier.layers) {
        for (var ch = 0; ch < activeTier.layers.length; ch++) {
            if (activeTier.layers[ch].typename === 'LayerSet') {
                activeTier.layers[ch].visible = false;
            }
        }
    }

    // 4. Show the target origin sub-group (skip for tiers without sub-groups)
    if (subs && subs.length > 0) {
        var activeOrigin = findLayer(doc, [tier, subfolder]);
        if (!activeOrigin) throw new Error('Origin sub-group not found: ' + tier + ' > ' + subfolder);
        activeOrigin.visible = true;
    }

    // 5. Ensure the art group is visible
    var artGroup = findLayer(doc, ['art']);
    if (artGroup) artGroup.visible = true;
}

// === TEXT LAYER UPDATE ===

function updateSpiritName(doc, tier, subfolder, name) {
    // For tiers with sub-groups, find the origin sub-group; for standalone tiers, use the tier group itself
    var subs = TIER_SUBGROUPS[tier];
    var targetGroup = (subs && subs.length > 0)
        ? findLayer(doc, [tier, subfolder])
        : findLayer(doc, [tier]);
    if (!targetGroup) return;

    // First try a layer explicitly named "NAME"
    var textLayer = findNamedTextLayer(targetGroup, 'NAME');

    // Fallback: some tiers (abyss non-astral/void, fairy) have text inside an "icons" sub-group
    // with an arbitrary name. Find the first text layer in that icons group.
    if (!textLayer) {
        var iconsGroup = findLayer(doc, [tier, subfolder, 'icons']);
        if (iconsGroup) {
            textLayer = findTextLayerInGroup(iconsGroup);
        }
    }

    if (textLayer) {
        textLayer.textItem.contents = name || '';
    }
}

function findNamedTextLayer(group, targetName) {
    if (!group || !group.layers) return null;
    for (var i = 0; i < group.layers.length; i++) {
        var layer = group.layers[i];
        if (layer.kind === LayerKind.TEXT && layer.name === targetName) return layer;
        if (layer.typename === 'LayerSet') {
            var found = findNamedTextLayer(layer, targetName);
            if (found) return found;
        }
    }
    return null;
}

function findTextLayerInGroup(group) {
    if (!group || !group.layers) return null;
    for (var i = 0; i < group.layers.length; i++) {
        var layer = group.layers[i];
        if (layer.kind === LayerKind.TEXT) return layer;
        if (layer.typename === 'LayerSet') {
            var found = findTextLayerInGroup(layer);
            if (found) return found;
        }
    }
    return null;
}

// === SAVE ===

function savePng(doc, folder, fileName) {
    var file = new File(folder + '/' + fileName);
    var opts = new ExportOptionsSaveForWeb();
    opts.format = SaveDocumentType.PNG;
    opts.PNG8 = false;
    opts.transparency = true;
    opts.interlaced = false;
    opts.quality = 100;
    if (exportLayerGroupPath && exportLayerGroupPath.length > 0) {
        exportLayerGroupAsPng(doc, exportLayerGroupPath, file, opts, exportTrimToGroupBounds);
    } else {
        doc.exportDocument(file, ExportType.SAVEFORWEB, opts);
    }
}

function getSideExportFileName(baseName, side) {
    var name = baseName || 'game_print.png';
    var dot = name.lastIndexOf('.');
    var stem = dot >= 0 ? name.substring(0, dot) : name;
    var ext = dot >= 0 ? name.substring(dot) : '.png';
    stem = stem.replace(/_game_print$/i, '');
    return stem + '_' + side + '_game_print' + ext;
}

// === HELPERS ===

function validatePath(fileOrFolder, label) {
    if (!fileOrFolder.exists) {
        alert(label + ' not found at: ' + fileOrFolder.fsName);
        exit();
    }
}

function uniqueRows(rows) {
    var map = {};
    var list = [];
    for (var i = 0; i < rows.length; i++) {
        var r = rows[i];
        var key = r['ExportID'] || r['SpiritID'];
        if (!map[key]) {
            map[key] = true;
            list.push(r);
        }
    }
    return list;
}

function readCSV(file) {
    file.open('r');
    var content = file.read();
    file.close();
    if (content === undefined || content === null) {
        return null;
    }
    var normalized = typeof content === 'string' ? content : content.toString();
    var rawLines = normalized.split(/\r?\n/);
    var lines = [];
    for (var i = 0; i < rawLines.length; i++) {
        var trimmed = rawLines[i].replace(/^\s+|\s+$/g, '');
        if (trimmed.length > 0) {
            lines.push(rawLines[i]);
        }
    }
    if (lines.length === 0) return null;
    var parsed = [];
    for (var li = 0; li < lines.length; li++) {
        parsed.push(parseCSVLine(lines[li]));
    }
    return parsed;
}

function parseCSVLine(line) {
    var values = [];
    var current = '';
    var inQuotes = false;
    for (var i = 0; i < line.length; i++) {
        var ch = line.charAt(i);
        if (ch === '"') {
            if (inQuotes && i + 1 < line.length && line.charAt(i + 1) === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (ch === ',' && !inQuotes) {
            values.push(current);
            current = '';
        } else {
            current += ch;
        }
    }
    values.push(current);
    for (var valIndex = 0; valIndex < values.length; valIndex++) {
        values[valIndex] = values[valIndex].replace(/^\s+|\s+$/g, '');
    }
    return values;
}

function findLayer(doc, path) {
    var root = doc;
    for (var i = 0; i < path.length; i++) {
        var name = path[i];
        var next = null;
        var layers = root.layers || [];
        for (var j = 0; j < layers.length; j++) {
            if (layers[j].name === name) {
                next = layers[j];
                break;
            }
        }
        if (!next) return null;
        root = next;
    }
    return root;
}

function exportLayerGroupAsPng(doc, groupPath, file, exportOpts, trimToBounds) {
    var target = findLayer(doc, groupPath);
    if (!target) throw new Error('Export layer group not found: ' + groupPath.join(' > '));
    if (target.typename !== 'LayerSet') throw new Error('Export target is not a layer group (LayerSet): ' + groupPath.join(' > '));

    var mode = getNewDocumentModeFromDocument(doc);
    var tmp = app.documents.add(doc.width, doc.height, doc.resolution, 'tmp_hex_export', mode, DocumentFill.TRANSPARENT);
    try {
        target.duplicate(tmp, ElementPlacement.PLACEATBEGINNING);
        app.activeDocument = tmp;
        if (trimToBounds) {
            tmp.trim(TrimType.TRANSPARENT, true, true, true, true);
        }
        tmp.exportDocument(file, ExportType.SAVEFORWEB, exportOpts);
    } finally {
        tmp.close(SaveOptions.DONOTSAVECHANGES);
        app.activeDocument = doc;
    }
}

function getNewDocumentModeFromDocument(doc) {
    try {
        switch (doc.mode) {
            case DocumentMode.RGB: return NewDocumentMode.RGB;
            case DocumentMode.CMYK: return NewDocumentMode.CMYK;
            case DocumentMode.GRAYSCALE: return NewDocumentMode.GRAYSCALE;
            case DocumentMode.LAB: return NewDocumentMode.LAB;
            case DocumentMode.BITMAP: return NewDocumentMode.BITMAP;
            default: return NewDocumentMode.RGB;
        }
    } catch (e) {
        return NewDocumentMode.RGB;
    }
}

function boundsToRect(bounds) {
    var left = bounds[0].as('px');
    var top = bounds[1].as('px');
    var right = bounds[2].as('px');
    var bottom = bounds[3].as('px');
    var width = right - left;
    var height = bottom - top;
    return {
        left: left,
        top: top,
        right: right,
        bottom: bottom,
        width: width,
        height: height,
        centerX: left + (width / 2),
        centerY: top + (height / 2)
    };
}

function fitLayerToRect(layer, targetRect) {
    var prevUnits = app.preferences.rulerUnits;
    app.preferences.rulerUnits = Units.PIXELS;
    try {
        var current = boundsToRect(layer.bounds);
        if (current.width === 0 || current.height === 0) return;

        var widthScale = (targetRect.width / current.width) * 100;
        var heightScale = (targetRect.height / current.height) * 100;
        layer.resize(widthScale, heightScale, AnchorPosition.MIDDLECENTER);

        var resized = boundsToRect(layer.bounds);
        var deltaX = targetRect.centerX - resized.centerX;
        var deltaY = targetRect.centerY - resized.centerY;
        layer.translate(deltaX, deltaY);
    } finally {
        app.preferences.rulerUnits = prevUnits;
    }
}

function replaceLayerContents(doc, layer, imageFile, targetRect) {
    app.activeDocument = doc;
    doc.activeLayer = layer;

    var action = stringIDToTypeID('placedLayerReplaceContents');
    var desc = new ActionDescriptor();
    desc.putPath(charIDToTypeID('null'), imageFile);
    desc.putInteger(charIDToTypeID('Lnkd'), 0);
    executeAction(action, desc, DialogModes.NO);

    resetSmartObjectTransform();
    fitLayerToRect(doc.activeLayer, targetRect);
}

function resetSmartObjectTransform() {
    var idTrnf = charIDToTypeID('Trnf');
    var desc = new ActionDescriptor();
    var idnull = charIDToTypeID('null');
    var ref = new ActionReference();
    ref.putEnumerated(charIDToTypeID('Lyr '), charIDToTypeID('Ordn'), charIDToTypeID('Trgt'));
    desc.putReference(idnull, ref);
    desc.putEnumerated(charIDToTypeID('FTcs'), charIDToTypeID('QCSt'), charIDToTypeID('Qcsa'));
    var idOfst = charIDToTypeID('Ofst');
    var descOfst = new ActionDescriptor();
    descOfst.putUnitDouble(charIDToTypeID('Hrzn'), charIDToTypeID('#Pxl'), 0);
    descOfst.putUnitDouble(charIDToTypeID('Vrtc'), charIDToTypeID('#Pxl'), 0);
    desc.putObject(idOfst, idOfst, descOfst);
    desc.putUnitDouble(charIDToTypeID('Wdth'), charIDToTypeID('#Prc'), 100);
    desc.putUnitDouble(charIDToTypeID('Hght'), charIDToTypeID('#Prc'), 100);
    desc.putEnumerated(charIDToTypeID('Intr'), charIDToTypeID('Intp'), charIDToTypeID('Bcbc'));
    executeAction(idTrnf, desc, DialogModes.NO);
}
