import csv
import re
import math

pricing_file = r"C:\Users\Manager\Desktop\app\pricing.csv"

def parse_pack_size_to_numeric(pack_str, uom_str):
    if not pack_str:
        return ""
    
    p = pack_str.strip().upper()
    uom = uom_str.strip().lower() if uom_str else ""

    # Replace common abbreviations
    p = p.replace('#CW', ' LB').replace('# CW', ' LB').replace('#', ' LB')
    p = p.replace('LBS', ' LB').replace('POUND', ' LB').replace('POUNDS', ' LB')
    p = p.replace('GALLON', ' GAL').replace('GALLONS', ' GAL')
    p = p.replace('QUART', ' QT').replace('QUARTS', ' QT')
    p = p.replace('PINT', ' PT').replace('PINTS', ' PT')
    p = p.replace('OUNCE', ' OZ').replace('OUNCES', ' OZ').replace('FL OZ', ' OZ')
    p = p.replace('DOZEN', ' DZ').replace('COUNT', ' CT').replace('EACH', ' EA')
    
    # Handle fractions
    p = p.replace('1/2 GAL', '64 OZ').replace('1/4 GAL', '32 OZ')
    p = p.replace('1/2 LB', '8 OZ').replace('1/4 LB', '4 OZ').replace('3/4 LB', '12 OZ')
    p = p.replace('1/2 BU', '240 OZ').replace('1/4 BU', '120 OZ')

    # #10 Can special case (foodservice #10 can = 106 oz)
    if '#10' in p or 'NO 10' in p or 'NO. 10' in p:
        m = re.search(r'(\d+)\s*X', p)
        num_cans = float(m.group(1)) if m else 1.0
        return round(num_cans * 106.0, 2)

    # Bushel special case (1 Bushel = 30 lbs = 480 oz)
    if 'BU' in p or 'BUSHEL' in p:
        m = re.search(r'(\d+(?:\.\d+)?)\s*BU', p)
        if m:
            return round(float(m.group(1)) * 480.0, 2)
        return 480.0

    # Pattern: N x M UNIT (e.g., "8 x 6.5 LB", "4 x 13 LB", "15 x 2 LB", "6 x 6 OZ", "4 x 1 GAL")
    m = re.search(r'(\d+(?:\.\d+)?)\s*(?:X|/)\s*(\d+(?:\.\d+)?)\s*(LB|OZ|GAL|QT|PT|DZ|CT|EA|KG|G|GRM|GRAMS|ML|LIT|LITER)?', p)
    if m:
        count = float(m.group(1))
        size = float(m.group(2))
        unit = m.group(3) if m.group(3) else ("OZ" if "per oz" in uom else ("LB" if "per lb" in uom else ""))

        if not unit:
            if "per oz" in uom: unit = "OZ"
            elif "per lb" in uom: unit = "LB"
            elif "per egg" in uom or "per ea" in uom: unit = "EA"
            else: unit = "LB"

        if unit in ["LB", "LBS"]: return round(count * size * 16.0, 2)
        if unit in ["OZ"]: return round(count * size, 2)
        if unit in ["GAL"]: return round(count * size * 128.0, 2)
        if unit in ["QT"]: return round(count * size * 32.0, 2)
        if unit in ["PT"]: return round(count * size * 16.0, 2)
        if unit in ["DZ"]: return round(count * size * 12.0, 2)
        if unit in ["CT", "EA"]: return round(count * size, 2)
        if unit in ["KG"]: return round(count * size * 35.274, 2)
        if unit in ["G", "GRM", "GRAMS"]: return round(count * size * 0.035274, 2)
        if unit in ["ML"]: return round(count * size * 0.033814, 2)
        if unit in ["LIT", "LITER"]: return round(count * size * 33.814, 2)

    # Pattern: Single quantity with unit (e.g. "50 LB", "10 LB", "1 GAL", "30 LB")
    m = re.search(r'(\d+(?:\.\d+)?)\s*(LB|OZ|GAL|QT|PT|DZ|CT|EA|KG|G|GRM|ML|LITER)?', p)
    if m:
        size = float(m.group(1))
        unit = m.group(2) if m.group(2) else ("OZ" if "per oz" in uom else ("LB" if "per lb" in uom else ""))

        if not unit:
            if "per oz" in uom: unit = "OZ"
            elif "per lb" in uom: unit = "LB"
            elif "per case" in uom: unit = "LB"
            else: unit = "LB"

        if unit in ["LB", "LBS"]: return round(size * 16.0, 2)
        if unit in ["OZ"]: return round(size, 2)
        if unit in ["GAL"]: return round(size * 128.0, 2)
        if unit in ["QT"]: return round(size * 32.0, 2)
        if unit in ["PT"]: return round(size * 16.0, 2)
        if unit in ["DZ"]: return round(size * 12.0, 2)
        if unit in ["CT", "EA"]: return round(size, 2)
        if unit in ["KG"]: return round(size * 35.274, 2)

    return p

rows = []
unparsed = []

with open(pricing_file, mode='r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    fieldnames = reader.fieldnames
    
    for row in reader:
        pack_size = row['Pack Size']
        uom = row['Unit Measure']
        case_price_str = row['Case Price ($)'].replace('$', '').replace(',', '').strip()
        
        try:
            case_price = float(case_price_str)
        except ValueError:
            case_price = 0.0

        calc_qty = parse_pack_size_to_numeric(pack_size, uom)
        
        is_num = False
        numeric_val = 0.0
        try:
            numeric_val = float(calc_qty)
            is_num = True
        except ValueError:
            is_num = False

        if is_num and numeric_val > 0 and case_price > 0:
            cost_per_unit = round(case_price / numeric_val, 4)
        else:
            try:
                cost_per_unit = float(row['Cost per Unit ($)'])
            except ValueError:
                cost_per_unit = 0.0
            unparsed.append((row['Ingredient Name'], pack_size, uom, calc_qty))

        row['Pack Size (oz)'] = str(calc_qty)
        row['Cost per Unit ($)'] = str(cost_per_unit)
        rows.append(row)

with open(pricing_file, mode='w', newline='', encoding='utf-8') as f:
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(rows)

print(f"Processed {len(rows)} rows. Remaining unparsed text rows: {len(unparsed)}")
for u in unparsed[:20]:
    print("  UNPARSED:", u)
