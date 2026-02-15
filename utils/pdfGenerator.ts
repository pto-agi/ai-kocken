
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CalculationResult, UserData } from '../types';

const COLORS = {
  primary: [160, 200, 29] as [number, number, number],
  dark: [15, 23, 42] as [number, number, number],
  slateDark: [30, 41, 59] as [number, number, number],
  slateMedium: [71, 85, 105] as [number, number, number],
  slateLight: [241, 245, 249] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  textMain: [51, 65, 85] as [number, number, number]
};

const FONTS = { heading: 'helvetica', body: 'helvetica' };

const safeText = (text: any, fallback = ""): string => {
  if (text === null || text === undefined) return fallback;
  return String(text);
};

const safeArray = (arr: any): any[] => {
  if (Array.isArray(arr)) return arr;
  return [];
};

const getVal = (item: any, keys: string[]): number => {
  if (!item) return 0;
  for (const key of keys) {
    if (item[key] !== undefined && item[key] !== null) {
      const valStr = String(item[key]).replace(/[^0-9.,]/g, '').replace(',', '.');
      const val = parseFloat(valStr);
      return !isNaN(val) ? Math.round(val) : 0;
    }
  }
  return 0;
};

// Dynamisk uträkning av totaler från måltiderna
const getDayTotals = (day: any) => {
  // Support for new dynamic meals structure
  if (Array.isArray(day.meals) && day.meals.length > 0) {
      let kcal = 0, protein = 0, carbs = 0, fat = 0;
      day.meals.forEach((m: any) => {
          const data = m.data || m;
          kcal += getVal(data, ['kcal', 'calories', 'energi']);
          protein += getVal(data, ['protein', 'p', 'proteinGrams']);
          carbs += getVal(data, ['carbs', 'c', 'kolhydrater']);
          fat += getVal(data, ['fat', 'f', 'fett']);
      });
      
      // If calculated totals seem valid (non-zero), return them
      if (kcal > 0) return { kcal, protein, carbs, fat };
  }

  // Fallback to old structure or pre-calculated totals
  const b = day.breakfast?.data || day.breakfast;
  const l = day.lunch?.data || day.lunch;
  const d = day.dinner?.data || day.dinner;

  let kcal =
    getVal(b, ['kcal', 'calories', 'energi']) +
    getVal(l, ['kcal', 'calories', 'energi']) +
    getVal(d, ['kcal', 'calories', 'energi']);

  if (kcal > 100) {
    const protein =
      getVal(b, ['protein', 'p', 'proteinGrams']) +
      getVal(l, ['protein', 'p', 'proteinGrams']) +
      getVal(d, ['protein', 'p', 'proteinGrams']);

    const carbs =
      getVal(b, ['carbs', 'c', 'kolhydrater']) +
      getVal(l, ['carbs', 'c', 'kolhydrater']) +
      getVal(d, ['carbs', 'c', 'kolhydrater']);

    const fat =
      getVal(b, ['fat', 'f', 'fett']) +
      getVal(l, ['fat', 'f', 'fett']) +
      getVal(d, ['fat', 'f', 'fett']);
      
    return { kcal, protein, carbs, fat };
  }

  // Fallback to provided totals
  return {
    kcal: getVal(day.dailyTotals, ['kcal', 'calories', 'totalCalories']),
    protein: getVal(day.dailyTotals, ['protein', 'p']),
    carbs: getVal(day.dailyTotals, ['carbs', 'c']),
    fat: getVal(day.dailyTotals, ['fat', 'f']),
  };
};

const drawPageHeader = (doc: jsPDF, title: string, subtitle?: string) => {
  const pageWidth = doc.internal.pageSize.width;
  doc.setFillColor(COLORS.dark[0], COLORS.dark[1], COLORS.dark[2]);
  doc.rect(0, 0, pageWidth, 25, 'F');
  doc.setFillColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
  doc.rect(0, 24, pageWidth, 1, 'F');
  doc.setTextColor(COLORS.white[0], COLORS.white[1], COLORS.white[2]);
  doc.setFontSize(12);
  doc.setFont(FONTS.heading, 'bold');
  doc.text("PTO Ai Coach", 20, 16);
  if (subtitle) {
    doc.setFontSize(10);
    doc.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
    doc.text(safeText(subtitle).toUpperCase(), pageWidth - 20, 11, { align: 'right' });
  }
  doc.setFontSize(14);
  doc.setTextColor(COLORS.white[0], COLORS.white[1], COLORS.white[2]);
  doc.text(safeText(title), pageWidth - 20, 18, { align: 'right' });
  return 45;
};

const drawFooter = (doc: jsPDF, pageNumber: number) => {
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.5);
  doc.line(20, pageHeight - 15, pageWidth - 20, pageHeight - 15);
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text("Private Training Online - Din strategiska hälsopartner", 20, pageHeight - 10);
  doc.text(`Sida ${pageNumber}`, pageWidth - 20, pageHeight - 10, { align: 'right' });
};

export const generateWeeklySchedulePDF = (fullPlan: any[], targets: any) => {
  try {
    if (!fullPlan || !Array.isArray(fullPlan) || fullPlan.length === 0) {
      throw new Error("Ingen data.");
    }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 20;
    const contentWidth = pageWidth - (margin * 2);
    let currentPage = 1;

    const targetKcal = getVal(targets, ['kcal', 'calories', 'targetCalories']);
    const targetP = getVal(targets, ['p', 'protein']);
    const targetC = getVal(targets, ['c', 'carbs']);
    const targetF = getVal(targets, ['f', 'fat']);

    // SIDA 1: DASHBOARD
    doc.setFillColor(COLORS.dark[0], COLORS.dark[1], COLORS.dark[2]);
    doc.rect(0, 0, pageWidth, 140, 'F');
    doc.setFillColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
    doc.circle(pageWidth - 30, 40, 60, 'F');
    doc.setFillColor(COLORS.dark[0], COLORS.dark[1], COLORS.dark[2]);
    doc.rect(0, 100, pageWidth, 40, 'F');

    doc.setTextColor(COLORS.white[0], COLORS.white[1], COLORS.white[2]);
    doc.setFontSize(12);
    doc.setFont(FONTS.heading, 'bold');
    doc.text("DIN PERSONLIGA PLAN", margin, 50);
    doc.setFontSize(42);
    doc.text("VECKOMENY", margin, 65);
    doc.setFontSize(14);
    doc.setFont(FONTS.heading, 'normal');
    doc.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
    doc.text("Skapad av PTO Ai Coach", margin, 75);
    doc.setFontSize(10);
    doc.setTextColor(180, 180, 180);
    doc.text(`Genererad: ${new Date().toLocaleDateString('sv-SE')}`, margin, 85);

    const cardY = 110;
    const cardHeight = 60;

    doc.setFillColor(220, 220, 220);
    doc.roundedRect(margin + 2, cardY + 2, contentWidth, cardHeight, 3, 3, 'F');
    doc.setFillColor(COLORS.white[0], COLORS.white[1], COLORS.white[2]);
    doc.roundedRect(margin, cardY, contentWidth, cardHeight, 3, 3, 'F');

    const colWidth = contentWidth / 4;
    const statsY = cardY + 25;

    const drawStat = (label: string, val: string, sub: string, x: number) => {
      doc.setFontSize(8);
      doc.setFont(FONTS.heading, 'bold');
      doc.setTextColor(COLORS.slateMedium[0], COLORS.slateMedium[1], COLORS.slateMedium[2]);
      doc.text(safeText(label).toUpperCase(), x, statsY, { align: 'center' });
      doc.setFontSize(18);
      doc.setTextColor(COLORS.dark[0], COLORS.dark[1], COLORS.dark[2]);
      doc.text(safeText(val), x, statsY + 10, { align: 'center' });
      doc.setFontSize(8);
      doc.setFont(FONTS.heading, 'normal');
      doc.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
      doc.text(safeText(sub), x, statsY + 18, { align: 'center' });
    };

    const startX = margin + (colWidth / 2);
    drawStat("DAGLIGT MÅL", `${targetKcal}`, "kcal", startX);
    drawStat("PROTEIN", `${targetP}%`, "av energi", startX + colWidth);
    drawStat("KOLHYDRATER", `${targetC}%`, "av energi", startX + (colWidth * 2));
    drawStat("FETT", `${targetF}%`, "av energi", startX + (colWidth * 3));

    let yPos = cardY + cardHeight + 40;
    doc.setTextColor(COLORS.dark[0], COLORS.dark[1], COLORS.dark[2]);
    doc.setFontSize(16);
    doc.setFont(FONTS.heading, 'bold');
    doc.text("Välkommen till din vecka", margin, yPos);

    yPos += 10;
    doc.setFontSize(10);
    doc.setFont(FONTS.body, 'normal');
    doc.setTextColor(COLORS.textMain[0], COLORS.textMain[1], COLORS.textMain[2]);
    const introText =
      "Här är din strategiska matsedel. Planen är balanserad för att optimera din energi och dina resultat. På nästa sida hittar du en översikt, följt av detaljerade recept och en inköpslista.";
    doc.text(doc.splitTextToSize(introText, contentWidth), margin, yPos);

    drawFooter(doc, currentPage);

    // SIDA 2: ÖVERBLICK
    doc.addPage();
    currentPage++;
    yPos = drawPageHeader(doc, "Överblick", "Veckans Schema");
    drawFooter(doc, currentPage);

    const tableData = fullPlan.map((day) => {
      const totals = getDayTotals(day);
      let bText = "-", lText = "-", dText = "-";

      // Attempt to extract intelligent overview columns even if meals structure varies
      if (Array.isArray(day.meals) && day.meals.length > 0) {
          // Fuzzy match for standard meals or use index
          const b = day.meals.find((m: any) => m.type?.toLowerCase().includes('frukost')) || day.meals[0];
          // Find lunch: look for 'lunch' or take 2nd meal if >= 3 meals
          const l = day.meals.find((m: any) => m.type?.toLowerCase().includes('lunch')) || (day.meals.length >= 2 ? day.meals[1] : null);
          // Find dinner: look for 'middag' or take last meal
          const d = day.meals.find((m: any) => m.type?.toLowerCase().includes('middag')) || day.meals[day.meals.length - 1];

          bText = b?.name || b?.title || "-";
          // Prevent duplicates in the view if meal count is low
          if (l && l !== b) lText = l?.name || l?.title || "-";
          if (d && d !== l && d !== b) dText = d?.name || d?.title || "-";
      } else {
          // Legacy support
          bText = day.breakfast?.title || day.breakfast?.name || "-";
          lText = day.lunch?.title || day.lunch?.name || "-";
          dText = day.dinner?.title || day.dinner?.name || "-";
      }

      return [
        safeText(day.day, "Dag"),
        safeText(bText),
        safeText(lText),
        safeText(dText),
        `${totals.kcal} kcal`,
      ];
    });

    autoTable(doc, {
      startY: yPos + 10,
      head: [["DAG", "FRUKOST", "LUNCH", "MIDDAG", "TOTALT"]],
      body: tableData,
      theme: "grid",
      headStyles: { fillColor: COLORS.dark, textColor: COLORS.white, fontStyle: "bold", fontSize: 9 },
      alternateRowStyles: { fillColor: COLORS.slateLight },
      styles: { font: "helvetica", fontSize: 8, cellPadding: 5, overflow: "linebreak", textColor: COLORS.slateDark },
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 25 }, 4: { fontStyle: "bold", textColor: COLORS.primary, cellWidth: 25 } },
    });

    // SIDOR 3+: RECEPT
    const checkSpace = (requiredSpace: number) => {
      if (yPos + requiredSpace > pageHeight - 20) {
        doc.addPage();
        currentPage++;
        drawPageHeader(doc, "Recept", "Fortsättning");
        drawFooter(doc, currentPage);
        yPos = 35;
        return true;
      }
      return false;
    };

    fullPlan.forEach((day, index) => {
      if (!day) return;

      const totals = getDayTotals(day);

      doc.addPage();
      currentPage++;
      yPos = drawPageHeader(doc, safeText(day.day, `Dag ${index + 1}`), `Dag ${index + 1}`);
      drawFooter(doc, currentPage);
      yPos = 45;

      doc.setFontSize(22);
      doc.setTextColor(COLORS.dark[0], COLORS.dark[1], COLORS.dark[2]);
      doc.setFont(FONTS.heading, "bold");
      doc.text(safeText(day.day).toUpperCase(), margin, yPos);

      doc.setFontSize(9);
      doc.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
      doc.text(
        `DAGENS TOTALT: ${totals.kcal} KCAL  |  P: ${totals.protein}g  C: ${totals.carbs}g  F: ${totals.fat}g`,
        margin,
        yPos + 7
      );

      yPos += 20;

      // Construct flat list of meals to render
      let mealsToRender = [];
      if (Array.isArray(day.meals) && day.meals.length > 0) {
          mealsToRender = day.meals.map((m: any) => ({
              label: m.type || "Måltid",
              data: m
          }));
      } else {
          if (day.breakfast) mealsToRender.push({ label: "Frukost", data: day.breakfast });
          if (day.lunch) mealsToRender.push({ label: "Lunch", data: day.lunch });
          if (day.dinner) mealsToRender.push({ label: "Middag", data: day.dinner });
      }

      mealsToRender.forEach((meal) => {
        const data = meal.data || meal;
        if (!data) return;

        const mKcal = getVal(data, ["kcal", "calories", "energi"]);
        const mProt = getVal(data, ["protein", "proteinGrams", "p"]);
        const mCarb = getVal(data, ["carbs", "c", "kolhydrater"]);
        const mFat = getVal(data, ["fat", "f", "fett"]);

        const ingredients = safeArray(data.ingredients);
        const rawInstructions = data.instructions || "Inga instruktioner.";
        const mealName = data.name || data.title || "Namnlös måltid";

        doc.setFontSize(14);
        doc.setFont(FONTS.heading, "bold");
        const titleWidth = contentWidth - 60;
        const titleLines = doc.splitTextToSize(safeText(mealName), titleWidth);
        const titleHeight = titleLines.length * 6;

        doc.setFontSize(10);
        const ingredientsHeight = Math.max(ingredients.length * 5, 10) + 15;
        const instructionLines = doc.splitTextToSize(safeText(rawInstructions), contentWidth - 20);
        const instructionsHeight = instructionLines.length * 5 + 15;

        const totalMealHeight = 40 + titleHeight + ingredientsHeight + instructionsHeight;

        checkSpace(totalMealHeight);

        const startY = yPos;

        doc.setFillColor(COLORS.slateLight[0], COLORS.slateLight[1], COLORS.slateLight[2]);
        doc.roundedRect(margin, startY, contentWidth, totalMealHeight - 10, 2, 2, "F");

        doc.setFillColor(COLORS.dark[0], COLORS.dark[1], COLORS.dark[2]);
        doc.roundedRect(margin, startY, 30, 8, 2, 0, "F");
        doc.setTextColor(COLORS.white[0], COLORS.white[1], COLORS.white[2]);
        doc.setFontSize(8);
        doc.setFont(FONTS.heading, "bold");
        doc.text(safeText(meal.label).toUpperCase(), margin + 15, startY + 5.5, { align: "center" });

        yPos += 18;

        doc.setTextColor(COLORS.dark[0], COLORS.dark[1], COLORS.dark[2]);
        doc.setFontSize(14);
        doc.text(titleLines, margin + 10, yPos);

        doc.setFontSize(9);
        doc.setTextColor(COLORS.slateMedium[0], COLORS.slateMedium[1], COLORS.slateMedium[2]);
        doc.setFont(FONTS.heading, "normal");
        doc.text(
          `${mKcal} kcal | P ${mProt}g • C ${mCarb}g • F ${mFat}g`,
          margin + contentWidth - 10,
          yPos,
          { align: "right" }
        );

        yPos += titleHeight + 2;

        doc.setDrawColor(220, 220, 220);
        doc.line(margin + 10, yPos, pageWidth - margin - 10, yPos);
        yPos += 8;

        const textX = margin + 10;
        doc.setFontSize(9);
        doc.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
        doc.setFont(FONTS.heading, "bold");
        doc.text("INGREDIENSER", textX, yPos);
        yPos += 5;

        doc.setTextColor(COLORS.textMain[0], COLORS.textMain[1], COLORS.textMain[2]);
        doc.setFont(FONTS.body, "normal");

        if (ingredients.length > 0) {
          ingredients.forEach((ing: string) => {
            doc.text(`• ${safeText(ing)}`, textX, yPos);
            yPos += 5;
          });
        } else {
          doc.text("• Inga ingredienser listade.", textX, yPos);
          yPos += 5;
        }

        yPos += 5;
        doc.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
        doc.setFont(FONTS.heading, "bold");
        doc.text("GÖR SÅ HÄR", textX, yPos);
        yPos += 5;

        doc.setTextColor(COLORS.textMain[0], COLORS.textMain[1], COLORS.textMain[2]);
        doc.setFont(FONTS.body, "normal");
        doc.text(instructionLines, textX, yPos);

        yPos += instructionLines.length * 5 + 20;
      });
    });

    // SISTA SIDAN: INKÖPSLISTA
    doc.addPage();
    currentPage++;
    yPos = drawPageHeader(doc, "Inköpslista", "Veckans behov");
    drawFooter(doc, currentPage);

    let allIngredients: string[] = [];
    fullPlan.forEach((day) => {
      if (!day) return;
      
      const meals = Array.isArray(day.meals) && day.meals.length > 0 
        ? day.meals 
        : [day.breakfast, day.lunch, day.dinner];

      meals.forEach((meal: any) => {
        const ings = meal?.data?.ingredients || meal?.ingredients;
        if (Array.isArray(ings)) {
          allIngredients.push(...ings);
        }
      });
    });

    const uniqueIngredients = [...new Set(allIngredients.map((i) => safeText(i).trim()))]
      .filter((i) => i.length > 0)
      .sort();

    yPos = 40;
    doc.setFontSize(16);
    doc.setTextColor(COLORS.dark[0], COLORS.dark[1], COLORS.dark[2]);
    doc.setFont(FONTS.heading, "bold");
    doc.text("Din Inköpslista", margin, yPos);

    yPos += 8;
    doc.setFontSize(10);
    doc.setTextColor(COLORS.slateMedium[0], COLORS.slateMedium[1], COLORS.slateMedium[2]);
    doc.setFont(FONTS.body, "normal");
    doc.text("Bocka av det du har hemma. Ingredienserna är samlade från alla veckans recept.", margin, yPos);
    yPos += 15;

    const col1X = margin;
    const col2X = pageWidth / 2 + 10;
    let isCol1 = true;
    let startY = yPos;

    doc.setFontSize(9);
    doc.setTextColor(COLORS.textMain[0], COLORS.textMain[1], COLORS.textMain[2]);

    if (uniqueIngredients.length === 0) {
      doc.text("Inga specifika ingredienser hittades.", margin, yPos);
    } else {
      uniqueIngredients.forEach((item) => {
        const x = isCol1 ? col1X : col2X;
        doc.text(`☐  ${item}`, x, startY);
        startY += 6;

        if (startY > pageHeight - 25) {
          if (isCol1) {
            isCol1 = false;
            startY = yPos;
          } else {
            doc.addPage();
            currentPage++;
            drawPageHeader(doc, "Inköpslista", "Fortsättning");
            drawFooter(doc, currentPage);
            isCol1 = true;
            startY = 40;
            yPos = 40;
          }
        }
      });
    }

    const fileName = `Veckomeny_PTO_${new Date().toISOString().split('T')[0]}.pdf`;
    // Use Blob URL download to avoid large data-URI issues in some browsers
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      const blob = doc.output('blob') as Blob;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } else {
      doc.save(fileName);
    }
  } catch (err) {
    console.error("PDF error:", err);
    throw err;
  }
};

export const generateRecipePDF = (_title: string, _content: string, _tags: string[]) => {
  throw new Error("generateRecipePDF används inte i denna build.");
};

export const generateMealPlanPDF = (_results: CalculationResult, _userData: UserData) => {
  throw new Error("generateMealPlanPDF används inte i denna build.");
};
