const fs = require('fs');
const path = require('path');

const appDir = 'C:\\Users\\Manager\\Desktop\\app';
const outDir = 'C:\\Users\\Manager\\.gemini\\antigravity-ide\\scratch\\cantine-app';

// Helper CSV parser for multiline quoted CSVs
function parseCSV(text) {
  const rows = [];
  let currentRow = [];
  let currentCell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentCell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') i++;
      currentRow.push(currentCell.trim());
      if (currentRow.length > 0 && currentRow.some(c => c !== '')) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = '';
    } else {
      currentCell += char;
    }
  }
  if (currentCell || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    rows.push(currentRow);
  }
  return rows;
}

// 1. Staff Auth
const staffText = fs.readFileSync(path.join(appDir, 'cantine staff auth - Sheet1.csv'), 'utf8');
const staffRows = parseCSV(staffText);
const staff = [];
for (let i = 1; i < staffRows.length; i++) {
  const r = staffRows[i];
  if (r[0] && r[1]) {
    staff.push({
      name: r[0],
      pin: String(r[1]).trim(),
      active: String(r[2]).toUpperCase() === 'TRUE',
      role: r[0].toLowerCase().includes('chef') ? 'head_chef' : 'cook'
    });
  }
}

// 2. Prep Inventory
const prepText = fs.readFileSync(path.join(appDir, 'PREP SHEET - Prep Inventory.csv'), 'utf8');
const prepRows = parseCSV(prepText);
const prepInventory = [];
for (let i = 1; i < prepRows.length; i++) {
  const r = prepRows[i];
  if (r[0]) {
    prepInventory.push({
      name: r[0],
      category: r[2] || 'General'
    });
  }
}

// 3. Recipes
const recipeText = fs.readFileSync(path.join(appDir, 'Cantine Recipe Book - Cantine Recipe Book.csv'), 'utf8');
const recipeRows = parseCSV(recipeText);
const recipes = [];
for (let i = 1; i < recipeRows.length; i++) {
  const r = recipeRows[i];
  if (r[0] && r[0] !== 'Recipe Name') {
    const nameLower = (r[0] || '').toLowerCase();
    const catLower = (r[1] || '').toLowerCase();

    // Smart default station assignment
    let station = r[5] || 'Prep';
    if (!r[5]) {
      if (nameLower.includes('sauce') || nameLower.includes('glaze') || nameLower.includes('reduction') || nameLower.includes('soup')) station = 'Sauté';
      else if (nameLower.includes('burger') || nameLower.includes('steak') || nameLower.includes('chicken') || nameLower.includes('grill')) station = 'Grill';
      else if (nameLower.includes('salad') || nameLower.includes('dressing') || nameLower.includes('pantry') || nameLower.includes('pickle')) station = 'Pantry';
      else if (nameLower.includes('fry') || nameLower.includes('fries') || nameLower.includes('chip')) station = 'Fry';
      else if (nameLower.includes('cake') || nameLower.includes('dessert') || nameLower.includes('dough') || catLower.includes('pastry')) station = 'Pastry';
    }

    let workflowType = r[6] || 'Batch Prep';
    if (!r[6]) {
      if (nameLower.includes('spec') || nameLower.includes('plating')) workflowType = 'Plating Spec';
      else if (nameLower.includes('sauce') || nameLower.includes('base') || nameLower.includes('stock')) workflowType = 'Sub-recipe';
    }

    recipes.push({
      name: r[0],
      category: r[1] || 'Uncategorized',
      ingredients: r[2] || '',
      method: r[3] || '',
      notes: r[4] || '',
      station: station,
      workflowType: workflowType,
      status: r[7] || 'Active',
      dietary: r[8] || '',
      photoUrl: r[9] || ''
    });
  }
}

// 4. Suppliers (from inventory app script config)
const suppliers = [
  { id: 'HILLCREST', name: 'Hillcrest Foodservice', rep: 'Becky', phone: '216-350-5938', email: '' },
  { id: 'HAZEROT', name: 'Northern Haserot', rep: 'Allison', phone: '216-379-1768', email: '' },
  { id: 'EURO', name: 'Euro USA', rep: 'Tom', phone: '216-701-7752', email: '' },
  { id: 'EUCLID FISH', name: 'Euclid Fish Co', rep: 'Geoff', phone: '615-969-2728', email: '' },
  { id: 'MICHAELS MEATS', name: 'Michaels Meats', rep: 'Ted', phone: '216-339-4375', email: '' },
  { id: 'STONE OVEN', name: 'Stone Oven Wholesale', rep: 'Stone Oven Bakery', phone: '', email: 'STONE.OVEN5@GMAIL.COM' },
  { id: 'STONEY CREEK', name: 'Pebble Creek / Stoney Creek Produce', rep: 'Nick', phone: '', email: 'NICK@PEBBLECREEKPRODUCE.COM' },
  { id: 'CANTONESE', name: 'Cantonese Market', rep: 'Tim', phone: '216-407-4293', email: '' }
];

// 5. Schedule
const schedText = fs.readFileSync(path.join(appDir, 'CANTINE SCHEDULE - Sheet1.csv'), 'utf8');
const schedRows = parseCSV(schedText);
const schedule = [];
for (let i = 2; i < schedRows.length; i++) {
  const r = schedRows[i];
  if (r[0] && r[0] !== 'legend  --->') {
    schedule.push({
      name: r[0],
      availability: r[1] || '',
      shifts: {
        MON: r[2] || 'x',
        TUE: r[3] || 'x',
        WED: r[4] || 'x',
        THUR: r[5] || 'x',
        FRI: r[6] || 'x',
        SAT: r[7] || 'x',
        SUN: r[8] || 'x'
      }
    });
  }
}

// 6. Inventory items parsed from headers of Form Responses CSV
const invText = fs.readFileSync(path.join(appDir, 'INVENTORY - Form Responses 1.csv'), 'utf8');
const invRows = parseCSV(invText);
const invHeaders = invRows[0] || [];
const uniqueItems = new Set();
const inventory = [];

invHeaders.forEach(h => {
  if (h && h !== 'Timestamp' && !uniqueItems.has(h.toLowerCase())) {
    uniqueItems.add(h.toLowerCase());
    
    // Assign reasonable supplier / category based on item name keywords
    let supp = 'HILLCREST';
    let cat = 'Dry Goods';
    const nameLower = h.toLowerCase();

    if (nameLower.includes('bun') || nameLower.includes('bread') || nameLower.includes('focaccia') || nameLower.includes('pugliese') || nameLower.includes('muffin') || nameLower.includes('toast') || nameLower.includes('loaf')) {
      supp = 'STONE OVEN';
      cat = 'Bakery & Breads';
    } else if (nameLower.includes('chicken') || nameLower.includes('beef') || nameLower.includes('pancetta') || nameLower.includes('bacon') || nameLower.includes('burger') || nameLower.includes('sausage') || nameLower.includes('veal') || nameLower.includes('ham') || nameLower.includes('short rib')) {
      supp = 'MICHAELS MEATS';
      cat = 'Proteins';
    } else if (nameLower.includes('fish') || nameLower.includes('prawn') || nameLower.includes('calamari') || nameLower.includes('octopus') || nameLower.includes('shrimp')) {
      supp = 'EUCLID FISH';
      cat = 'Proteins';
    } else if (nameLower.includes('cheese') || nameLower.includes('burrata') || nameLower.includes('cream') || nameLower.includes('butter') || nameLower.includes('yogurt') || nameLower.includes('mozzarella') || nameLower.includes('crème')) {
      supp = 'EURO';
      cat = 'Dairy & Cheese';
    } else if (nameLower.includes('beet') || nameLower.includes('berry') || nameLower.includes('grape') || nameLower.includes('cilantro') || nameLower.includes('eggplant') || nameLower.includes('parsley') || nameLower.includes('chive') || nameLower.includes('jalapeño') || nameLower.includes('potato') || nameLower.includes('shallot') || nameLower.includes('brussels') || nameLower.includes('tomato') || nameLower.includes('melon') || nameLower.includes('lettuce') || nameLower.includes('mushroom') || nameLower.includes('cabbage') || nameLower.includes('squash') || nameLower.includes('tarragon') || nameLower.includes('dill') || nameLower.includes('thyme')) {
      supp = 'STONEY CREEK';
      cat = 'Produce';
    }

    inventory.push({
      name: h,
      category: cat,
      orderSize: 'unit',
      supplier: supp,
      par: 3,
      parSized: 'units',
      notes: ''
    });
  }
});

const masterData = {
  staff,
  suppliers,
  inventory,
  prepInventory,
  prepItems: prepInventory.map(p => ({ name: p.name, category: p.category, status: 'STANDARD', isDone: false })),
  recipes,
  schedule,
  passdownNotes: []
};

const jsContent = `window.CANTINE_SEED_DATA = ${JSON.stringify(masterData, null, 2)};\n`;
fs.writeFileSync(path.join(outDir, 'data.js'), jsContent, 'utf8');

console.log(`Successfully generated data.js!`);
console.log(`Staff count: ${staff.length}`);
console.log(`Prep inventory count: ${prepInventory.length}`);
console.log(`Recipes count: ${recipes.length}`);
console.log(`Inventory items count: ${inventory.length}`);
console.log(`Schedule count: ${schedule.length}`);
