#target photoshop

/**
 * Medium Hex Tile Proof Export
 * ----------------------------
 * Uses every PNG in `front/`, replaces both smart objects (`HEX` and `HEX2`)
 * with the same face image, then exports one PNG per face into `proofed/`.
 *
 * PSD verified with psd-tools:
 * - canvas: 825x750
 * - top-level smart objects: HEX, HEX2
 */

// === CONFIGURATION ===
var templateFile = new File('/Users/maikyon/Downloads/Medium Hex Tile Set.psd');
var scriptFolder = File($.fileName).parent;
var packRoot = scriptFolder ? scriptFolder.parent : Folder.current;
var sourceFolder = new Folder(packRoot);
var outputFolder = new Folder(packRoot + '/proofed');

validatePath(templateFile, 'Template PSD');
validatePath(sourceFolder, 'Export folder');
if (!outputFolder.exists) outputFolder.create();

var faceFiles = listPngFiles(sourceFolder);
if (!faceFiles || faceFiles.length === 0) {
	alert('No PNG files found in: ' + sourceFolder.fsName);
	exit();
}

var originalDialogMode = app.displayDialogs;
app.displayDialogs = DialogModes.NO;

var doc = app.open(templateFile);
var failedItems = [];
var successCount = 0;

var hexLayer = findLayerByName(doc, 'HEX');
var hex2Layer = findLayerByName(doc, 'HEX2');

if (!hexLayer || !hex2Layer) {
	alert('Could not find required layers HEX and HEX2 in template.');
	doc.close(SaveOptions.DONOTSAVECHANGES);
	app.displayDialogs = originalDialogMode;
	exit();
}

var hexRect = boundsToRect(hexLayer.bounds);
var hex2Rect = boundsToRect(hex2Layer.bounds);

try {
	for (var i = 0; i < faceFiles.length; i++) {
		var faceFile = faceFiles[i];
		var baseName = fileBaseName(faceFile.name);
		var outName = baseName + '.png';

		try {
			replaceLayerContents(doc, hexLayer, faceFile, hexRect);
			replaceLayerContents(doc, hex2Layer, faceFile, hex2Rect);
			savePng(doc, outputFolder, outName);
			successCount++;
		} catch (err) {
			failedItems.push(faceFile.name + ': ' + err.message);
		}
	}
} finally {
	doc.close(SaveOptions.DONOTSAVECHANGES);
	app.displayDialogs = originalDialogMode;
}

var msg = 'Proof export finished! ' + successCount + '/' + faceFiles.length + ' exported.';
msg += '\nOutput: ' + outputFolder.fsName;
if (failedItems.length > 0) {
	msg += '\n\nFailed (' + failedItems.length + '):\n' + failedItems.slice(0, 10).join('\n');
	if (failedItems.length > 10) msg += '\n... and ' + (failedItems.length - 10) + ' more';
}
alert(msg);

// === HELPERS ===

function validatePath(fileOrFolder, label) {
	if (!fileOrFolder.exists) {
		alert(label + ' not found at: ' + fileOrFolder.fsName);
		exit();
	}
}

function listPngFiles(folder) {
	var files = folder.getFiles(function (f) {
		return f instanceof File && /\.png$/i.test(f.name);
	});
	return files || [];
}

function fileBaseName(fileName) {
	return fileName.replace(/\.[^\.]+$/, '');
}

function findLayerByName(container, targetName) {
	var layers = container.layers || [];
	for (var i = 0; i < layers.length; i++) {
		var layer = layers[i];
		if (layer.name === targetName) return layer;
		if (layer.typename === 'LayerSet') {
			var found = findLayerByName(layer, targetName);
			if (found) return found;
		}
	}
	return null;
}

function savePng(doc, folder, fileName) {
	var file = new File(folder + '/' + fileName);
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
		centerX: left + width / 2,
		centerY: top + height / 2
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
