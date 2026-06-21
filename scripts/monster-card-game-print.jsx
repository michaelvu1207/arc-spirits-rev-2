#target photoshop

/**
 * Monster Card Game Print Builder
 * -------------------------------------------
 * Consumes the Monster Cards Art Pack export (monster_cards.csv + art_raw/).
 *
 * What it does:
 * - Opens the template PSD once.
 * - Replaces the smart object layer named "art" with each image in /art_raw.
 * - Updates text layers for name, classification, and barrier/damage.
 * - Clears the "special_text" layer (if present).
 * - Exports PNGs to /game_prints with filenames that include MonsterID.
 *
 * Template expectations:
 * - A smart object layer named "art" exists (anywhere in the layer tree).
 * - Text layers exist with these names (anywhere in the layer tree):
 *   - name
 *   - classication (note: template typo) OR classification
 *   - barrier_value
 *   - damage_value
 *   - special_text (optional; this script will clear it)
 */

// === CONFIGURATION ===
var templateFile = new File('/Users/maikyon/Library/CloudStorage/GoogleDrive-michaelmqvu@gmail.com/My Drive/Arc Spirits/monster_card.psd');
var scriptFolder = File($.fileName).parent;
var packRoot = scriptFolder ? scriptFolder.parent : Folder.current;
var csvFile = new File(packRoot + '/monster_cards.csv');
var artFolder = new Folder(packRoot + '/art_raw');
var exportFolder = new Folder(packRoot + '/game_prints');

validatePath(templateFile, 'Template PSD');
validatePath(csvFile, 'CSV data');
validatePath(artFolder, 'Art raw folder');
if (!exportFolder.exists) exportFolder.create();

var csvRows = readCSV(csvFile);
if (!csvRows || csvRows.length === 0) {
	alert('CSV is empty. Re-export from the Monster Cards admin.');
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

var rowById = {};
for (var iRow = 0; iRow < rows.length; iRow++) {
	var rid = rows[iRow]['MonsterID'];
	if (rid) rowById[rid] = rows[iRow];
}

var artFiles = listImageFiles(artFolder);
if (!artFiles || artFiles.length === 0) {
	alert('No images found in: ' + artFolder.fsName);
	exit();
}

// Suppress all dialogs during batch processing
var originalDialogMode = app.displayDialogs;
app.displayDialogs = DialogModes.NO;

var doc = app.open(templateFile);
var failedItems = [];
var successCount = 0;

// Find smart object layer named "art" anywhere in the PSD
var artPlaceholder = findLayerByNameAndKind(doc, 'art', 'smartobject');
if (!artPlaceholder) {
	alert('Smart object layer named "art" not found in template.');
	doc.close(SaveOptions.DONOTSAVECHANGES);
	app.displayDialogs = originalDialogMode;
	exit();
}

var textLayerName = findTextLayerByName(doc, 'name');
var textLayerClassification =
	findTextLayerByName(doc, 'classication') || findTextLayerByName(doc, 'classification');
var textLayerSpecial = findTextLayerByName(doc, 'special_text');
// barrier_value and damage_value are now rendered by the web layout editor, not here.
// Clear them if they exist so stale text doesn't persist.
var textLayerBarrierValue = findTextLayerByName(doc, 'barrier_value');
var textLayerDamageValue = findTextLayerByName(doc, 'damage_value');

if (!textLayerName) {
	alert('Text layer "name" not found in template.');
	doc.close(SaveOptions.DONOTSAVECHANGES);
	app.displayDialogs = originalDialogMode;
	exit();
}
if (!textLayerClassification) {
	alert('Text layer "classication" (or "classification") not found in template.');
	doc.close(SaveOptions.DONOTSAVECHANGES);
	app.displayDialogs = originalDialogMode;
	exit();
}

// Cache placeholder bounds BEFORE first replacement (name/bounds can change after replace)
var originalPlaceholderRect = boundsToRect(artPlaceholder.bounds);

try {
	for (var i = 0; i < artFiles.length; i++) {
		var artFile = artFiles[i];
		var monsterId = extractUuid(artFile.name);
		if (!monsterId) {
			failedItems.push(artFile.name + ': missing MonsterID UUID in filename.');
			continue;
		}

		var rowData = rowById[monsterId];
		if (!rowData) {
			failedItems.push(artFile.name + ': MonsterID not found in monster_cards.csv.');
			continue;
		}

		try {
			replaceLayerContents(doc, artPlaceholder, artFile, originalPlaceholderRect);
			updateMonsterText(doc, rowData, {
				name: textLayerName,
				classification: textLayerClassification,
				barrier_value: textLayerBarrierValue,
				damage_value: textLayerDamageValue,
				special_text: textLayerSpecial
			});
			// Clear barrier/damage text layers (now rendered by web layout editor)
			savePng(doc, exportFolder, monsterId + '_monster_card.png');
			successCount++;
		} catch (err) {
			failedItems.push(artFile.name + ': ' + (err && err.message ? err.message : String(err)));
		}
	}
} finally {
	doc.close(SaveOptions.DONOTSAVECHANGES);
	app.displayDialogs = originalDialogMode;
}

var msg = 'Export finished! ' + successCount + '/' + artFiles.length + ' files saved to ' + exportFolder.fsName;
if (failedItems.length > 0) {
	msg += '\\n\\nFailed items (' + failedItems.length + '):\\n' + failedItems.slice(0, 10).join('\\n');
	if (failedItems.length > 10) msg += '\\n... and ' + (failedItems.length - 10) + ' more';
}
alert(msg);

// === HELPERS ===
function validatePath(fileOrFolder, label) {
	if (!fileOrFolder.exists) {
		alert(label + ' not found at: ' + fileOrFolder.fsName);
		exit();
	}
}

function listImageFiles(folder) {
	var files = folder.getFiles(function (f) {
		if (!(f instanceof File)) return false;
		// Prefer images, but allow extensionless/unknown files (Photoshop can often sniff content).
		if (/^\\./.test(f.name)) return false;
		if (f.name === '.DS_Store') return false;
		return true;
	});
	// getFiles() returns File|Folder; ensure File[]
	var out = [];
	for (var i = 0; i < files.length; i++) {
		if (files[i] instanceof File) out.push(files[i]);
	}
	return out;
}

function extractUuid(filename) {
	var m = filename.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
	return m ? m[0] : null;
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

function findLayerByNameAndKind(root, targetName, targetKind) {
	// root can be a Document or LayerSet
	var layers = root.layers || [];
	for (var i = 0; i < layers.length; i++) {
		var layer = layers[i];
		if (layer.name === targetName) {
			try {
				// For ArtLayer, layer.kind can be LayerKind.SMARTOBJECT; compare stringID kind for safety
				var kindStr = (layer.kind === LayerKind.SMARTOBJECT) ? 'smartobject' : String(layer.kind);
				if (kindStr === targetKind) return layer;
			} catch (e) {
				// ignore kind lookup
			}
			// If name matches but kind check fails, still allow if targetKind not provided
			if (!targetKind) return layer;
		}
		if (layer.typename === 'LayerSet') {
			var found = findLayerByNameAndKind(layer, targetName, targetKind);
			if (found) return found;
		}
	}
	return null;
}

function findTextLayerByName(root, targetName) {
	// root can be a Document or LayerSet
	var layers = root.layers || [];
	for (var i = 0; i < layers.length; i++) {
		var layer = layers[i];
		if (layer.name === targetName) {
			try {
				if (layer.kind === LayerKind.TEXT) return layer;
			} catch (e) {
				// ignore kind lookup
			}
		}
		if (layer.typename === 'LayerSet') {
			var found = findTextLayerByName(layer, targetName);
			if (found) return found;
		}
	}
	return null;
}

function setTextLayerContents(layer, value) {
	if (!layer) return;
	if (layer.kind === LayerKind.TEXT) {
		layer.textItem.contents = value || '';
	}
}

function normalizeMonsterClassification(raw) {
	var v = (raw || '').toString().replace(/^\s+|\s+$/g, '');
	if (!v) return '';
	var key = v.toLowerCase();
	if (key === 'monster') return 'Monster';
	if (key === 'abyss_guardian') return 'Abyss Guardian';
	if (key === 'boss') return 'Stage Boss';
	if (key === 'final_boss') return 'Final Boss';
	// Fallback: title-case unknown values (and replace underscores).
	var words = v.replace(/_/g, ' ').split(/\s+/);
	for (var i = 0; i < words.length; i++) {
		var w = words[i];
		words[i] = w.length > 0 ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w;
	}
	return words.join(' ');
}

function parseIntOrZero(raw) {
	var n = parseInt(raw, 10);
	return isNaN(n) ? 0 : n;
}

function buildSpecialText(row) {
	// Prefer a dedicated field if the CSV ever adds one.
	var direct = row['SpecialText'] || row['SpecialEffectText'] || '';
	var trimmed = direct ? direct.toString().replace(/^\s+|\s+$/g, '') : '';
	if (trimmed) return trimmed;

	var names = row['SpecialEffectNames'] || '';
	var list = names ? names.toString().split('|') : [];
	var cleaned = [];
	for (var i = 0; i < list.length; i++) {
		var s = list[i] ? list[i].toString().replace(/^\s+|\s+$/g, '') : '';
		if (s) cleaned.push(s);
	}
	if (cleaned.length === 0) return 'No special effects.';
	// Photoshop text layers treat \\r as a line break more reliably than \\n.
	return cleaned.join('\\r');
}

function updateMonsterText(doc, row, layers) {
	// Match template styling: name is typically all caps.
	var name = (row['Name'] || '').toString();
	setTextLayerContents(layers.name, name ? name.toUpperCase() : '');

	var classification = normalizeMonsterClassification(row['Classification']);
	setTextLayerContents(layers.classification, classification);

	// Barrier and damage are now rendered by the web layout editor.
	// Clear them so stale text from previous runs doesn't persist in the PSD.
	setTextLayerContents(layers.barrier_value, '');
	setTextLayerContents(layers.damage_value, '');

	// Special text intentionally disabled for monster cards.
	setTextLayerContents(layers.special_text, '');
}

function savePng(doc, baseFolder, fileName) {
	var file = new File(baseFolder + '/' + fileName);
	var opts = new ExportOptionsSaveForWeb();
	opts.format = SaveDocumentType.PNG;
	opts.PNG8 = false;
	opts.transparency = true;
	opts.interlaced = false;
	opts.quality = 100;
	doc.exportDocument(file, ExportType.SAVEFORWEB, opts);
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
