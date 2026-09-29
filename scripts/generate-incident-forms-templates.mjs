/**
 * Генерирует шаблоны бланков для журнала происшествий:
 *   templates/incident-forms/rule-violation-act.docx
 *   templates/incident-forms/property-damage-act.docx
 *   templates/incident-forms/guest-explanation.docx
 *
 * Бланки-заготовки: реквизиты гостиницы подставляются автоматически
 * ({hotel_name} и т.п.), остальные поля заполняются от руки.
 *
 * Запуск: node scripts/generate-incident-forms-templates.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "templates", "incident-forms");

const FONT = "Times New Roman";
const SZ = 20; // ~10pt
const SZ_SMALL = 17;
const SZ_TITLE = 26;
const SZ_SECTION = 21;
const SZ_HOTEL = 22;

function txt(text, opts = {}) {
  return new TextRun({
    text,
    font: FONT,
    size: opts.size ?? SZ,
    bold: opts.bold,
    italics: opts.italics,
    color: opts.color,
  });
}

function ph(tag, opts = {}) {
  return txt(tag, opts);
}

function para(children, opts = {}) {
  return new Paragraph({
    alignment: opts.align,
    spacing: { before: opts.before ?? 0, after: opts.after ?? 90, line: opts.line ?? 260 },
    children: Array.isArray(children) ? children : [children],
  });
}

function cell(children, opts = {}) {
  return new TableCell({
    width: opts.width ? { size: opts.width, type: WidthType.DXA } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 60, bottom: 60, left: 90, right: 90 },
    borders: opts.borders,
    columnSpan: opts.colSpan,
    children: Array.isArray(children) ? children : [children],
  });
}

const noBorders = {
  top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
};

const thinBorders = {
  top: { style: BorderStyle.SINGLE, size: 1, color: "999999" },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: "999999" },
  left: { style: BorderStyle.SINGLE, size: 1, color: "999999" },
  right: { style: BorderStyle.SINGLE, size: 1, color: "999999" },
};

const headerLine = {
  top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  bottom: { style: BorderStyle.SINGLE, size: 6, color: "2563EB" },
  left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
};

function hotelHeader() {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: noBorders,
    rows: [
      new TableRow({
        children: [
          cell(para([txt("{hotel_name}", { size: SZ_HOTEL, bold: true })], { after: 0 }), {
            width: 4500,
            borders: headerLine,
          }),
          cell(
            [
              para([ph("{hotel_legal_name}", { size: SZ_SMALL })], { align: AlignmentType.RIGHT, after: 30 }),
              para([ph("{hotel_city}", { size: SZ_SMALL }), txt(", ", { size: SZ_SMALL }), ph("{hotel_address}", { size: SZ_SMALL })], { align: AlignmentType.RIGHT, after: 30 }),
              para([txt("Тел.: ", { size: SZ_SMALL }), ph("{hotel_phone}", { size: SZ_SMALL })], { align: AlignmentType.RIGHT, after: 0 }),
            ],
            { width: 4860, borders: headerLine }
          ),
        ],
      }),
    ],
  });
}

function title(text) {
  return para([txt(text, { size: SZ_TITLE, bold: true })], {
    align: AlignmentType.CENTER,
    before: 120,
    after: 40,
  });
}

function sectionTitle(text) {
  return para([txt(text, { size: SZ_SECTION, bold: true })], { before: 120, after: 50 });
}

/** Строка «Метка: ___» с подчёркиванием на всю оставшуюся ширину. */
function fieldLine(label, opts = {}) {
  const underscores = "_".repeat(opts.len ?? 70);
  return para(
    [txt(`${label}: `, { size: SZ }), txt(underscores, { size: SZ })],
    { after: opts.after ?? 110 }
  );
}

/** Пустые линии для заполнения от руки. */
function blankLines(count) {
  const rows = [];
  for (let i = 0; i < count; i++) {
    rows.push(para([txt("_".repeat(96), { size: SZ })], { after: 150 }));
  }
  return rows;
}

function legalNote(text) {
  return para([txt(text, { size: SZ_SMALL, italics: true, color: "555555" })], { after: 60 });
}

function cityDateRow() {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: noBorders,
    rows: [
      new TableRow({
        children: [
          cell(para([ph("г. {hotel_city}", { size: SZ })], { after: 0 }), { width: 4680, borders: noBorders }),
          cell(para([txt("«___» _____________ 20___ г.", { size: SZ })], { after: 0 }), {
            width: 4680,
            borders: noBorders,
            align: AlignmentType.RIGHT,
          }),
        ],
      }),
    ],
  });
}

function signatureBlock(rows) {
  const children = [];
  for (const [role, hint] of rows) {
    children.push(
      new Paragraph({
        spacing: { before: 120, after: 20, line: 260 },
        children: [
          txt(`${role}: `, { size: SZ, bold: true }),
          txt("_________________ / ", { size: SZ }),
          txt("_______________________", { size: SZ }),
        ],
      })
    );
    if (hint) {
      children.push(
        new Paragraph({
          spacing: { after: 40 },
          children: [txt(`                    (подпись)                        (${hint})`, { size: SZ_SMALL, color: "777777" })],
        })
      );
    }
  }
  return children;
}

function baseSection(children) {
  return {
    properties: { page: { margin: { top: 720, right: 720, bottom: 720, left: 720 } } },
    children,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. АКТ О НАРУШЕНИИ ПРАВИЛ ПРОЖИВАНИЯ
// ─────────────────────────────────────────────────────────────────────────────
const ruleViolationAct = new Document({
  sections: [
    baseSection([
      hotelHeader(),
      title("АКТ"),
      para([txt("о нарушении правил проживания / общественного порядка / контрольно-пропускного режима", { size: SZ, bold: true })], {
        align: AlignmentType.CENTER,
        after: 120,
      }),
      cityDateRow(),
      para([
        txt("Настоящий акт составлен администратором ", { size: SZ }),
        txt("____________________________________", { size: SZ }),
        txt(" (Ф.И.О., должность)", { size: SZ_SMALL, color: "777777" }),
      ], { before: 120, after: 110 }),
      para([
        txt("в присутствии свидетелей: ", { size: SZ }),
        txt("________________________________________________________", { size: SZ }),
      ], { after: 140 }),

      sectionTitle("1. Сведения о нарушителе"),
      fieldLine("Ф.И.О. гостя / данные бронирования"),
      fieldLine("Номер комнаты / койко-место"),
      fieldLine("Дата и время нарушения"),

      sectionTitle("2. Существо нарушения"),
      legalNote(
        "Указать, какие правила нарушены (правила проживания, общественный порядок, пропускной режим) и в чём конкретно выразилось нарушение."
      ),
      ...blankLines(4),

      sectionTitle("3. Предъявленные требования и реакция гостя"),
      legalNote(
        "Гостю сделано устное предупреждение и предъявлено законное требование прекратить нарушение (п. правил проживания). Указать реакцию гостя."
      ),
      ...blankLines(3),

      sectionTitle("4. Принятые меры"),
      para([txt("☐ Устное предупреждение     ☐ Повторное требование     ☐ Отказ в дальнейшем оказании услуг", { size: SZ })], { after: 90 }),
      para([txt("☐ Вызвана полиция (время вызова: ______, № КУСП/талона: ______)", { size: SZ })], { after: 140 }),

      legalNote(
        "Основание: Правила предоставления гостиничных услуг в РФ (ПП РФ № 1853); правила проживания, доведённые до сведения гостя; ст. 20.1 КоАП РФ (мелкое хулиганство) — при нецензурной брани, приставании к гражданам, повреждении имущества."
      ),

      ...signatureBlock([
        ["Администратор", "Ф.И.О."],
        ["Свидетель", "Ф.И.О."],
        ["Свидетель", "Ф.И.О."],
      ]),
      para([
        txt("От подписи и дачи объяснений гость отказался / отсутствовал (нужное подчеркнуть): ", { size: SZ }),
        txt("____________", { size: SZ }),
      ], { before: 160, after: 40 }),
      para([txt("Дата составления акта: {print_date}", { size: SZ, bold: true })], { before: 120, after: 0 }),
    ]),
  ],
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. АКТ О ПОВРЕЖДЕНИИ ИМУЩЕСТВА
// ─────────────────────────────────────────────────────────────────────────────
function damageTableRow(cells, opts = {}) {
  return new TableRow({
    children: cells.map((c, i) =>
      cell(para([txt(c, { size: opts.size ?? SZ_SMALL, bold: opts.bold })], { after: 0, align: i === 0 ? AlignmentType.CENTER : undefined }), {
        borders: thinBorders,
        width: [900, 4200, 1800, 2160][i],
      })
    ),
  });
}

const damageEmptyRow = () =>
  new TableRow({
    children: [900, 4200, 1800, 2160].map((w) =>
      cell(para([txt(" ", { size: SZ })], { after: 0 }), { borders: thinBorders, width: w })
    ),
  });

const propertyDamageAct = new Document({
  sections: [
    baseSection([
      hotelHeader(),
      title("АКТ"),
      para([txt("о повреждении имущества гостиницы", { size: SZ, bold: true })], {
        align: AlignmentType.CENTER,
        after: 120,
      }),
      cityDateRow(),
      para([
        txt("Настоящий акт составлен администратором ", { size: SZ }),
        txt("____________________________________", { size: SZ }),
        txt(" (Ф.И.О., должность)", { size: SZ_SMALL, color: "777777" }),
      ], { before: 120, after: 110 }),
      para([
        txt("о том, что по вине гостя ", { size: SZ }),
        txt("__________________________________", { size: SZ }),
        txt(" (Ф.И.О. / бронирование, комната № ______)", { size: SZ_SMALL, color: "777777" }),
      ], { after: 110 }),
      para([txt("причинён ущерб имуществу гостиницы:", { size: SZ })], { after: 90 }),

      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        layout: TableLayoutType.FIXED,
        rows: [
          damageTableRow(["№", "Наименование имущества и характер повреждения", "Кол-во", "Сумма ущерба, ₽"], { bold: true, size: SZ_SMALL }),
          ...Array.from({ length: 5 }).map(() => damageEmptyRow()),
          new TableRow({
            children: [
              cell(para([txt("Итого:", { size: SZ, bold: true })], { after: 0, align: AlignmentType.RIGHT }), {
                borders: thinBorders,
                colSpan: 3,
              }),
              cell(para([txt("__________ ₽", { size: SZ, bold: true })], { after: 0 }), { borders: thinBorders }),
            ],
          }),
        ],
      }),

      sectionTitle("Обстоятельства причинения ущерба"),
      ...blankLines(3),

      legalNote(
        "К акту приобщаются: фотографии/видеозапись, объяснение гостя, расчёт стоимости восстановительного ремонта / замены."
      ),
      legalNote(
        "Основание: в соответствии с Правилами предоставления гостиничных услуг в РФ (ПП РФ № 1853) и правилами проживания потребитель возмещает реальный ущерб при утрате или повреждении по его вине имущества гостиницы."
      ),

      para([txt("Гость с актом ознакомлен, ущерб признаёт / не признаёт (нужное подчеркнуть).", { size: SZ })], { before: 120, after: 40 }),

      ...signatureBlock([
        ["Администратор", "Ф.И.О."],
        ["Гость", "Ф.И.О."],
        ["Свидетель", "Ф.И.О."],
      ]),
      para([txt("Дата составления акта: {print_date}", { size: SZ, bold: true })], { before: 120, after: 0 }),
    ]),
  ],
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. ОБЪЯСНЕНИЕ ГОСТЯ
// ─────────────────────────────────────────────────────────────────────────────
const guestExplanation = new Document({
  sections: [
    baseSection([
      hotelHeader(),
      para([
        txt("Администрации ", { size: SZ }),
        ph("{hotel_name}", { size: SZ, bold: true }),
      ], { align: AlignmentType.RIGHT, before: 120, after: 20 }),
      para([ph("{hotel_legal_name}", { size: SZ_SMALL })], { align: AlignmentType.RIGHT, after: 120 }),

      title("ОБЪЯСНЕНИЕ"),
      cityDateRow(),

      para([
        txt("Я, ", { size: SZ }),
        txt("________________________________________________________________", { size: SZ }),
      ], { before: 140, after: 20 }),
      para([txt("                                                   (Ф.И.О. полностью)", { size: SZ_SMALL, color: "777777" })], { after: 90 }),
      fieldLine("Проживаю в комнате / место №", { len: 30, after: 60 }),
      fieldLine("Документ, удостоверяющий личность", { len: 45, after: 110 }),

      para([txt("по факту происшествия, имевшего место «___» ___________ 20___ г., поясняю следующее:", { size: SZ })], { after: 120 }),

      ...blankLines(9),

      para([
        txt("С правилами проживания и порядком возмещения ущерба ознакомлен(а). Изложенное с моих слов записано верно.", { size: SZ_SMALL, italics: true, color: "555555" }),
      ], { before: 60, after: 160 }),

      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        layout: TableLayoutType.FIXED,
        borders: noBorders,
        rows: [
          new TableRow({
            children: [
              cell(para([txt("Дата: «___» __________ 20___ г.", { size: SZ })], { after: 0 }), { borders: noBorders, width: 4680 }),
              cell(para([txt("Подпись: ______________ / ____________", { size: SZ })], { after: 0 }), { borders: noBorders, width: 4680, align: AlignmentType.RIGHT }),
            ],
          }),
        ],
      }),
      para([
        txt("Объяснение принял администратор: _________________ / ______________________", { size: SZ }),
      ], { before: 160, after: 0 }),
    ]),
  ],
});

// ─────────────────────────────────────────────────────────────────────────────
const FILES = [
  ["rule-violation-act.docx", ruleViolationAct],
  ["property-damage-act.docx", propertyDamageAct],
  ["guest-explanation.docx", guestExplanation],
];

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const [name, doc] of FILES) {
  const buffer = await Packer.toBuffer(doc);
  const out = path.join(OUT_DIR, name);
  fs.writeFileSync(out, buffer);
  console.log("Created:", out);
}
