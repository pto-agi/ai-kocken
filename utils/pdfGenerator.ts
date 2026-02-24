import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CalculationResult, UserData } from '../types';

const COLORS = {
  primary: [160, 200, 29] as [number, number, number],
  primaryDark: [122, 158, 17] as [number, number, number],
  ink: [15, 23, 42] as [number, number, number],
  slate: [71, 85, 105] as [number, number, number],
  slateLight: [241, 245, 249] as [number, number, number],
  paper: [250, 250, 246] as [number, number, number],
  blush: [245, 232, 238] as [number, number, number],
  mint: [229, 245, 236] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  text: [30, 41, 59] as [number, number, number]
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

const formatStat = (n: number, suffix = '') => {
  if (!n || n <= 0) return '-';
  return `${n}${suffix}`;
};

// Dynamisk uträkning av totaler från måltiderna
const getDayTotals = (day: any) => {
  if (Array.isArray(day.meals) && day.meals.length > 0) {
    let kcal = 0, protein = 0, carbs = 0, fat = 0;
    day.meals.forEach((m: any) => {
      const data = m.data || m;
      kcal += getVal(data, ['kcal', 'calories', 'energi']);
      protein += getVal(data, ['protein', 'p', 'proteinGrams']);
      carbs += getVal(data, ['carbs', 'c', 'kolhydrater']);
      fat += getVal(data, ['fat', 'f', 'fett']);
    });
    if (kcal > 0) return { kcal, protein, carbs, fat };
  }

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

  return {
    kcal: getVal(day.dailyTotals, ['kcal', 'calories', 'totalCalories']),
    protein: getVal(day.dailyTotals, ['protein', 'p']),
    carbs: getVal(day.dailyTotals, ['carbs', 'c']),
    fat: getVal(day.dailyTotals, ['fat', 'f']),
  };
};

const drawPageHeader = (doc: jsPDF, title: string, subtitle?: string) => {
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;

  doc.setFillColor(...COLORS.paper);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  doc.setFillColor(...COLORS.ink);
  doc.rect(0, 0, pageWidth, 22, 'F');
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 21, pageWidth, 1.5, 'F');

  doc.setTextColor(...COLORS.white);
  doc.setFontSize(11);
  doc.setFont(FONTS.heading, 'bold');
  doc.text("My PTO", 18, 15);

  if (subtitle) {
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.primary);
    doc.text(safeText(subtitle).toUpperCase(), pageWidth - 18, 12, { align: 'right' });
  }

  doc.setFontSize(14);
  doc.setTextColor(...COLORS.white);
  doc.text(safeText(title), pageWidth - 18, 18, { align: 'right' });

  return 40;
};

const drawFooter = (doc: jsPDF, pageNumber: number) => {
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.5);
  doc.line(18, pageHeight - 14, pageWidth - 18, pageHeight - 14);
  doc.setFontSize(8);
  doc.setTextColor(140, 140, 140);
  doc.text("Private Training Online", 18, pageHeight - 9);
  doc.text(`Sida ${pageNumber}`, pageWidth - 18, pageHeight - 9, { align: 'right' });
};

const drawCover = (doc: jsPDF, targets: any) => {
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;

  doc.setFillColor(...COLORS.paper);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  doc.setFillColor(...COLORS.blush);
  doc.circle(pageWidth - 25, 40, 60, 'F');

  doc.setFillColor(...COLORS.mint);
  doc.circle(15, pageHeight - 10, 80, 'F');

  doc.setFillColor(...COLORS.ink);
  doc.rect(0, 0, pageWidth, 28, 'F');
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 27, pageWidth, 2, 'F');

  doc.setTextColor(...COLORS.white);
  doc.setFont(FONTS.heading, 'bold');
  doc.setFontSize(12);
  doc.text("My PTO", margin, 18);

  doc.setFontSize(36);
  doc.setTextColor(...COLORS.ink);
  doc.text("Veckomeny", margin, 70);
  doc.setFontSize(12);
  doc.setTextColor(...COLORS.slate);
  doc.text("Personlig kostplan för balans, energi och välmående", margin, 80);

  doc.setFontSize(10);
  doc.setTextColor(120, 120, 120);
  doc.text(`Genererad: ${new Date().toLocaleDateString('sv-SE')}`, margin, 90);

  const cardY = 110;
  const cardHeight = 52;
  doc.setFillColor(...COLORS.white);
  doc.roundedRect(margin, cardY, contentWidth, cardHeight, 3, 3, 'F');

  const targetKcal = getVal(targets, ['kcal', 'calories', 'targetCalories']);
  const targetP = getVal(targets, ['p', 'protein']);
  const targetC = getVal(targets, ['c', 'carbs']);
  const targetF = getVal(targets, ['f', 'fat']);

  const colWidth = contentWidth / 4;
  const statY = cardY + 20;

  const drawStat = (label: string, val: string, sub: string, x: number) => {
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.slate);
    doc.setFont(FONTS.heading, 'bold');
    doc.text(label.toUpperCase(), x, statY, { align: 'center' });
    doc.setFontSize(18);
    doc.setTextColor(...COLORS.ink);
    doc.text(val, x, statY + 10, { align: 'center' });
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.primaryDark);
    doc.setFont(FONTS.heading, 'normal');
    doc.text(sub, x, statY + 18, { align: 'center' });
  };

  const startX = margin + colWidth / 2;
  drawStat("Dagligt mål", formatStat(targetKcal), "kcal", startX);
  drawStat("Protein", formatStat(targetP, '%'), "energi", startX + colWidth);
  drawStat("Kolhydrater", formatStat(targetC, '%'), "energi", startX + colWidth * 2);
  drawStat("Fett", formatStat(targetF, '%'), "energi", startX + colWidth * 3);

  doc.setFontSize(12);
  doc.setTextColor(...COLORS.ink);
  doc.setFont(FONTS.heading, 'bold');
  doc.text("Din plan, ditt tempo", margin, cardY + cardHeight + 25);

  doc.setFontSize(10);
  doc.setFont(FONTS.body, 'normal');
  doc.setTextColor(...COLORS.text);
  const intro =
    "Planen är designad för att passa din vardag, dina preferenser och ditt mål. \
Här hittar du veckans översikt, detaljerade recept och en samlad inköpslista.";
  doc.text(doc.splitTextToSize(intro, contentWidth), margin, cardY + cardHeight + 35);
};

export const generateWeeklySchedulePDF = (fullPlan: any[], targets: any) => {
  try {
    if (!fullPlan || !Array.isArray(fullPlan) || fullPlan.length === 0) {
      throw new Error("Ingen data.");
    }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 18;
    const contentWidth = pageWidth - margin * 2;
    let currentPage = 1;

    drawCover(doc, targets);
    drawFooter(doc, currentPage);

    // SIDA 2: ÖVERBLICK
    doc.addPage();
    currentPage++;
    let yPos = drawPageHeader(doc, "Överblick", "Veckans Schema");

    const tableData = fullPlan.map((day) => {
      const totals = getDayTotals(day);
      let bText = "-", lText = "-", dText = "-";

      if (Array.isArray(day.meals) && day.meals.length > 0) {
        const b = day.meals.find((m: any) => m.type?.toLowerCase().includes('frukost')) || day.meals[0];
        const l = day.meals.find((m: any) => m.type?.toLowerCase().includes('lunch')) || (day.meals.length >= 2 ? day.meals[1] : null);
        const d = day.meals.find((m: any) => m.type?.toLowerCase().includes('middag')) || day.meals[day.meals.length - 1];

        bText = b?.name || b?.title || "-";
        if (l && l !== b) lText = l?.name || l?.title || "-";
        if (d && d !== l && d !== b) dText = d?.name || d?.title || "-";
      } else {
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
      startY: yPos + 8,
      head: [["DAG", "FRUKOST", "LUNCH", "MIDDAG", "TOTALT"]],
      body: tableData,
      theme: "striped",
      headStyles: { fillColor: COLORS.ink, textColor: COLORS.white, fontStyle: "bold", fontSize: 9 },
      alternateRowStyles: { fillColor: COLORS.slateLight },
      styles: { font: "helvetica", fontSize: 8, cellPadding: 5, overflow: "linebreak", textColor: COLORS.slate },
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 24 }, 4: { fontStyle: "bold", textColor: COLORS.primaryDark, cellWidth: 24 } },
    });

    drawFooter(doc, currentPage);

    // SIDOR 3+: RECEPT
    const checkSpace = (requiredSpace: number) => {
      if (yPos + requiredSpace > pageHeight - 20) {
        doc.addPage();
        currentPage++;
        yPos = drawPageHeader(doc, "Recept", "Fortsättning");
        drawFooter(doc, currentPage);
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

      doc.setFontSize(20);
      doc.setTextColor(...COLORS.ink);
      doc.setFont(FONTS.heading, "bold");
      doc.text(safeText(day.day).toUpperCase(), margin, yPos);

      doc.setFontSize(9);
      doc.setTextColor(...COLORS.primaryDark);
      doc.text(
        `DAGENS TOTALT: ${totals.kcal} KCAL  |  P: ${totals.protein}g  K: ${totals.carbs}g  F: ${totals.fat}g`,
        margin,
        yPos + 7
      );

      yPos += 18;

      let mealsToRender = [] as any[];
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

        doc.setFontSize(13);
        doc.setFont(FONTS.heading, "bold");
        const titleWidth = contentWidth - 50;
        const titleLines = doc.splitTextToSize(safeText(mealName), titleWidth);
        const titleHeight = titleLines.length * 6;

        doc.setFontSize(9);
        const ingredientsHeight = Math.max(ingredients.length * 5, 10) + 14;
        const instructionLines = doc.splitTextToSize(safeText(rawInstructions), contentWidth - 20);
        const instructionsHeight = instructionLines.length * 5 + 14;

        const totalMealHeight = 38 + titleHeight + ingredientsHeight + instructionsHeight;
        checkSpace(totalMealHeight);

        const startY = yPos;

        doc.setFillColor(...COLORS.white);
        doc.roundedRect(margin, startY, contentWidth, totalMealHeight - 8, 3, 3, "F");

        doc.setFillColor(...COLORS.primary);
        doc.roundedRect(margin, startY, 28, 8, 2, 0, "F");
        doc.setTextColor(...COLORS.ink);
        doc.setFontSize(8);
        doc.setFont(FONTS.heading, "bold");
        doc.text(safeText(meal.label).toUpperCase(), margin + 14, startY + 5.5, { align: "center" });

        yPos += 18;

        doc.setTextColor(...COLORS.ink);
        doc.setFontSize(13);
        doc.text(titleLines, margin + 10, yPos);

        doc.setFontSize(9);
        doc.setTextColor(...COLORS.slate);
        doc.setFont(FONTS.heading, "normal");
        doc.text(
          `${mKcal} kcal | P ${mProt}g • K ${mCarb}g • F ${mFat}g`,
          margin + contentWidth - 10,
          yPos,
          { align: "right" }
        );

        yPos += titleHeight + 2;

        doc.setDrawColor(230, 230, 230);
        doc.line(margin + 10, yPos, pageWidth - margin - 10, yPos);
        yPos += 8;

        const textX = margin + 10;
        doc.setFontSize(9);
        doc.setTextColor(...COLORS.primaryDark);
        doc.setFont(FONTS.heading, "bold");
        doc.text("INGREDIENSER", textX, yPos);
        yPos += 5;

        doc.setTextColor(...COLORS.text);
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
        doc.setTextColor(...COLORS.primaryDark);
        doc.setFont(FONTS.heading, "bold");
        doc.text("GÖR SÅ HÄR", textX, yPos);
        yPos += 5;

        doc.setTextColor(...COLORS.text);
        doc.setFont(FONTS.body, "normal");
        doc.text(instructionLines, textX, yPos);

        yPos += instructionLines.length * 5 + 18;
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

    yPos = 45;
    doc.setFontSize(16);
    doc.setTextColor(...COLORS.ink);
    doc.setFont(FONTS.heading, "bold");
    doc.text("Din Inköpslista", margin, yPos);

    yPos += 8;
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.slate);
    doc.setFont(FONTS.body, "normal");
    doc.text("Bocka av det du har hemma. Samlad från alla veckans recept.", margin, yPos);
    yPos += 15;

    const col1X = margin;
    const col2X = pageWidth / 2 + 6;
    let isCol1 = true;
    let startY = yPos;

    doc.setFontSize(9);
    doc.setTextColor(...COLORS.text);

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
            yPos = drawPageHeader(doc, "Inköpslista", "Fortsättning");
            drawFooter(doc, currentPage);
            isCol1 = true;
            startY = 45;
            yPos = 45;
          }
        }
      });
    }

    const fileName = `Veckomeny_PTO_${new Date().toISOString().split('T')[0]}.pdf`;
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
