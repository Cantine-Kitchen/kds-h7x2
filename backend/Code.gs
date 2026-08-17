/**
 * CANTINE RESTAURANT APP - UNIFIED BACKEND SCRIPT
 * Single Google Apps Script managing Auth, Recipes, Inventory, Suppliers, Prep Board, & Schedule
 */

const CONFIG = {
  staffSheet: 'Staff',
  recipeSheet: 'Recipes',
  inventorySheet: 'Inventory',
  suppliersSheet: 'Suppliers',
  prepInventorySheet: 'Prep Inventory',
  dailyPrepSheet: 'Daily Prep List',
  scheduleSheet: 'Schedule'
};

/** SERVE THE WEB APP & API RESPONSES */
function doGet(e) {
  var action = e && e.parameter ? e.parameter.action : '';
  var callback = e && e.parameter ? e.parameter.callback : '';

  if (action === 'getLivePrep' || action === 'api') {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var props = PropertiesService.getDocumentProperties();
    var liveItemsStr = props.getProperty('livePrepItems');
    var liveNotesStr = props.getProperty('livePassdownNotes');
    var liveSchedStr = props.getProperty('liveSchedule');
    var liveSchedulesStr = props.getProperty('liveSchedules');
    var liveCleanStr = props.getProperty('liveCleaning');
    var liveEightySixStr = props.getProperty('liveEightysix');
    var liveVipStr = props.getProperty('liveVipNotes');

    var liveData = {
      prepItems: liveItemsStr ? JSON.parse(liveItemsStr) : getActivePrepList_(ss),
      passdownNotes: liveNotesStr ? JSON.parse(liveNotesStr) : getPassdownNotes_(),
      schedule: liveSchedStr ? JSON.parse(liveSchedStr) : getScheduleData_(ss),
      schedules: liveSchedulesStr ? JSON.parse(liveSchedulesStr) : {},
      cleaning: liveCleanStr ? JSON.parse(liveCleanStr) : {},
      eightySixList: liveEightySixStr ? JSON.parse(liveEightySixStr) : [],
      vipNotes: liveVipStr ? JSON.parse(liveVipStr) : []
    };

    if (action === 'api') {
      liveData = getAllAppData_();
    }

    if (callback) {
      return ContentService.createTextOutput(callback + '(' + JSON.stringify(liveData) + ')')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return ContentService.createTextOutput(JSON.stringify(liveData))
      .setMimeType(ContentService.MimeType.JSON);
  }

  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('Cantine Kitchen Hub')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** HANDLE ALL API POST REQUESTS */
function doPost(e) {
  var headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json"
  };

  try {
    var contents = JSON.parse(e.postData.contents);
    var action = contents.action;
    var result = {};

    switch (action) {
      case 'updatePrepItems':
        result = updateLivePrepList_(contents.prepItems, contents.passdownNotes, contents.schedule, contents.cleaning, contents.eightySixList, contents.vipNotes, contents.schedules);
        break;
      case 'updateSchedule':
        result = updateLivePrepList_(null, null, contents.schedule, null, null, null, contents.schedules);
        break;
      case 'validatePin':
        result = validatePin_(contents.pin);
        break;
      case 'getInitialData':
        result = getAllAppData_();
        break;
      case 'togglePrepItem':
        result = togglePrepItemStatus_(contents.rowNum, contents.newState);
        break;
      case 'makeItemStandard':
        result = makeItemStandard_(contents.rowNum);
        break;
      case 'resetToCheckFirst':
        result = resetToCheckFirst_(contents.rowNum);
        break;
      case 'addMidShiftItem':
        result = addMidShiftItem_(contents.itemName);
        break;
      case 'submitPrepList':
        result = submitNativePrepList_(contents.selections, contents.customText);
        break;
      case 'addPassdownNote':
        result = addPassdownNote_(contents.noteText);
        break;
      case 'clearPassdownNotes':
        result = clearPassdownNotes_();
        break;
      case 'submitOrder':
        result = submitOrderAndGetMessages_(contents.orderPayload, contents.submitterName);
        break;
      default:
        result = { error: 'Unknown action' };
    }

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      valid: false,
      error: "Server Error: " + err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function updateLivePrepList_(prepItems, passdownNotes, schedule, cleaning, eightySixList, vipNotes, schedules) {
  var props = PropertiesService.getDocumentProperties();
  if (prepItems) props.setProperty('livePrepItems', JSON.stringify(prepItems));
  if (passdownNotes) props.setProperty('livePassdownNotes', JSON.stringify(passdownNotes));
  if (schedule) props.setProperty('liveSchedule', JSON.stringify(schedule));
  if (schedules) props.setProperty('liveSchedules', JSON.stringify(schedules));
  if (cleaning) props.setProperty('liveCleaning', JSON.stringify(cleaning));
  if (eightySixList) props.setProperty('liveEightysix', JSON.stringify(eightySixList));
  if (vipNotes) props.setProperty('liveVipNotes', JSON.stringify(vipNotes));
  return { success: true };
}

/** PIN AUTHENTICATION */
function validatePin_(pin) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(CONFIG.staffSheet);
  if (!sh) return { valid: false, error: 'Staff sheet not found' };

  var staffData = sh.getDataRange().getValues();
  for (var i = 1; i < staffData.length; i++) {
    var sheetName = staffData[i][0];
    var sheetPin = String(staffData[i][1]).trim();
    var sheetActive = staffData[i][2];

    if (sheetPin === String(pin).trim() && (sheetActive === true || String(sheetActive).toUpperCase() === 'TRUE')) {
      return { valid: true, name: sheetName, role: staffData[i][3] || 'cook' };
    }
  }
  return { valid: false, error: 'Invalid PIN' };
}

/** MASTER DATA FETCH */
function getAllAppData_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var props = PropertiesService.getDocumentProperties();
  var liveSchedStr = props.getProperty('liveSchedule');
  
  return {
    staff: getStaffData_(ss),
    suppliers: getSuppliersData_(ss),
    inventory: getInventoryData_(ss),
    recipes: getRecipesData_(ss),
    prepList: getActivePrepList_(ss),
    prepInventory: getPrepInventoryData_(ss),
    schedule: liveSchedStr ? JSON.parse(liveSchedStr) : getScheduleData_(ss),
    passdownNotes: getPassdownNotes_()
  };
}

function getScheduleData_(ss) {
  var sh = ss.getSheetByName(CONFIG.scheduleSheet);
  if (!sh) return [];
  var data = sh.getDataRange().getValues();
  var result = [];

  for (var i = 0; i < data.length; i++) {
    var name = String(data[i][0] || '').trim();
    if (name && name !== 'legend  --->' && name !== 'Staff Name' && name !== 'Name') {
      result.push({
        name: name,
        availability: data[i][1] || '',
        shifts: {
          MON: data[i][2] || 'x',
          TUE: data[i][3] || 'x',
          WED: data[i][4] || 'x',
          THUR: data[i][5] || 'x',
          FRI: data[i][6] || 'x',
          SAT: data[i][7] || 'x',
          SUN: data[i][8] || 'x'
        }
      });
    }
  }
  return result;
}

function getStaffData_(ss) {
  var sh = ss.getSheetByName(CONFIG.staffSheet);
  if (!sh) return [];
  var data = sh.getDataRange().getValues();
  var result = [];
  for (var i = 1; i < data.length; i++) {
    if (data[i][0]) {
      result.push({ name: data[i][0], pin: data[i][1], active: data[i][2], role: data[i][3] || 'cook' });
    }
  }
  return result;
}

function getSuppliersData_(ss) {
  var sh = ss.getSheetByName(CONFIG.suppliersSheet);
  if (!sh) return [];
  var data = sh.getDataRange().getValues();
  var result = [];
  for (var i = 1; i < data.length; i++) {
    if (data[i][0]) {
      result.push({
        id: String(data[i][0]).toUpperCase().trim(),
        name: data[i][1] || data[i][0],
        rep: data[i][2] || '',
        phone: data[i][3] || '',
        email: data[i][4] || ''
      });
    }
  }
  return result;
}

function getRecipesData_(ss) {
  var sh = ss.getSheetByName(CONFIG.recipeSheet);
  if (!sh) return [];
  var data = sh.getDataRange().getValues();
  var result = [];
  for (var i = 1; i < data.length; i++) {
    if (data[i][0]) {
      result.push({
        name: data[i][0],
        category: data[i][1] || 'Uncategorized',
        ingredients: data[i][2] || '',
        method: data[i][3] || '',
        notes: data[i][4] || '',
        station: data[i][5] || 'Prep',
        workflowType: data[i][6] || 'Batch Prep',
        status: data[i][7] || 'Active',
        dietary: data[i][8] || '',
        photoUrl: data[i][9] || '',
        tags: data[i][10] || ''
      });
    }
  }
  return result;
}

function getInventoryData_(ss) {
  var sh = ss.getSheetByName(CONFIG.inventorySheet);
  if (!sh) return [];
  var data = sh.getDataRange().getValues();
  var result = [];
  for (var i = 1; i < data.length; i++) {
    if (data[i][0]) {
      result.push({
        row: i + 1,
        name: data[i][0],
        category: data[i][1] || 'General',
        orderSize: data[i][2] || '',
        supplier: data[i][3] || 'Unknown',
        par: data[i][4] || null,
        parSized: data[i][5] || '',
        notes: data[i][6] || ''
      });
    }
  }
  return result;
}

function getPrepInventoryData_(ss) {
  var sh = ss.getSheetByName(CONFIG.prepInventorySheet);
  if (!sh) return [];
  var data = sh.getDataRange().getValues();
  var result = [];
  for (var i = 1; i < data.length; i++) {
    if (data[i][0]) {
      result.push({ name: data[i][0], category: data[i][2] || 'General' });
    }
  }
  return result;
}

function getActivePrepList_(ss) {
  var sh = ss.getSheetByName(CONFIG.dailyPrepSheet);
  if (!sh) return [];
  var data = sh.getDataRange().getValues();
  var result = [];
  for (var i = 0; i < data.length; i++) {
    var cellA = data[i][0];
    var itemName = String(data[i][1] || '').trim();
    var status = String(data[i][2] || '').trim();
    var isCheckbox = typeof cellA === 'boolean';
    var isHeader = status === 'HEADER';

    if ((isCheckbox || isHeader) && itemName !== '') {
      result.push({
        row: i + 1,
        isDone: isCheckbox ? cellA : false,
        name: itemName,
        status: status
      });
    }
  }
  return result;
}

function togglePrepItemStatus_(rowNum, newState) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.dailyPrepSheet);
  sheet.getRange(rowNum, 1).setValue(newState);
  SpreadsheetApp.flush();
  return { success: true, newState: newState };
}

function makeItemStandard_(rowNum) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.dailyPrepSheet);
  var currentStatus = String(sheet.getRange(rowNum, 3).getValue());
  var newStatus = currentStatus.indexOf("BRUNCH") !== -1 ? "RESOLVED_CHECK BRUNCH" : "RESOLVED_CHECK";
  sheet.getRange(rowNum, 3).setValue(newStatus);
  sheet.getRange(rowNum, 4).setValue("");
  SpreadsheetApp.flush();
  return { success: true };
}

function resetToCheckFirst_(rowNum) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.dailyPrepSheet);
  var currentStatus = String(sheet.getRange(rowNum, 3).getValue());
  var newStatus = currentStatus.indexOf("BRUNCH") !== -1 ? "CHECK FIRST BRUNCH" : "CHECK FIRST";
  sheet.getRange(rowNum, 3).setValue(newStatus);
  sheet.getRange(rowNum, 4).setValue("Verify before making");
  sheet.getRange(rowNum, 1).setValue(false);
  SpreadsheetApp.flush();
  return { success: true };
}

function addMidShiftItem_(itemName) {
  if (!itemName || String(itemName).trim() === "") return { success: false };
  var props = PropertiesService.getDocumentProperties();
  var currentItems = props.getProperty('midShiftItems') || '';
  var updated = currentItems ? currentItems + ',' + String(itemName).trim() : String(itemName).trim();
  props.setProperty('midShiftItems', updated);
  return { success: true };
}

function addPassdownNote_(noteText) {
  if (!noteText || String(noteText).trim() === "") return { success: false };
  var props = PropertiesService.getDocumentProperties();
  var currentNotes = props.getProperty('passdownNotes') || '';
  var timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "h:mm a");
  var formattedNote = "[" + timestamp + "] " + String(noteText).trim();
  var updated = currentNotes ? currentNotes + '|||' + formattedNote : formattedNote;
  props.setProperty('passdownNotes', updated);
  return { success: true };
}

function clearPassdownNotes_() {
  PropertiesService.getDocumentProperties().setProperty('passdownNotes', '');
  return { success: true };
}

function getPassdownNotes_() {
  var props = PropertiesService.getDocumentProperties();
  var notesStr = props.getProperty('passdownNotes') || '';
  return notesStr ? notesStr.split('|||') : [];
}
