import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('startform home equipment', () => {
  it('shows conditional home equipment inputs and persists values to startformular', () => {
    const startPath = path.join(process.cwd(), 'pages', 'Start.tsx');
    const start = fs.readFileSync(startPath, 'utf8');

    expect(start).toContain('homeEquipment: string[];');
    expect(start).toContain('homeEquipmentOther: string;');
    expect(start).toContain('form.trainingPlaces.includes(\'Hemma\')');
    expect(start).toContain('Vilken utrustning har du hemma?');
    expect(start).toMatch(/const payload = \{[\s\S]*home_equipment: form\.trainingPlaces\.includes\('Hemma'\) \? form\.homeEquipment : \[\],[\s\S]*home_equipment_other: form\.trainingPlaces\.includes\('Hemma'\) \? \(form\.homeEquipmentOther\.trim\(\) \|\| null\) : null,[\s\S]*\};\n\n\s{4}const \{\s+error\s+\} = await supabase/);
    expect(start).toContain('const notificationBody = buildStartNotificationBody(payload);');
  });
});
