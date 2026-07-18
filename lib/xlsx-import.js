import ExcelJS from "exceljs";

const CHOICE_ALIASES = [
  { letter: "A", headers: ["choice a", "answer 1"] },
  { letter: "B", headers: ["choice b", "answer 2"] },
  { letter: "C", headers: ["choice c", "answer 3"] },
  { letter: "D", headers: ["choice d", "answer 4"] },
  { letter: "E", headers: ["choice e", "answer 5"] },
  { letter: "F", headers: ["choice f", "answer 6"] }
];

const HEADER_ALIASES = {
  order: ["order"],
  question: ["question", "question text"],
  correct: ["correct choice", "correct answer", "correct answer(s)"],
  explanation: ["explanation"],
  category: ["category"],
  image: ["image url", "image"]
};

const GAME_FIELD_ALIASES = {
  name: ["game name"],
  max_players: ["maximum players"],
  preparation_countdown_seconds: ["preparation countdown"],
  leaderboard_duration_seconds: ["leaderboard duration"],
  allow_late_join: ["allow late join"],
  randomize_questions: ["randomize questions"],
  randomize_answers: ["randomize answers"],
  show_correct_answer: ["show correct answer"],
  show_leaderboard_after_question: ["show leaderboard"]
};

function normalize(value) {
  return String(value ?? "").trim();
}

function normalizeHeader(value) {
  return normalize(value).toLowerCase();
}

function cellText(cell) {
  if (cell === null || cell === undefined) return "";
  if (typeof cell === "object" && cell.text !== undefined) return normalize(cell.text);
  if (typeof cell === "object" && cell.result !== undefined) return normalize(cell.result);
  return normalize(cell);
}

function findHeaderIndex(headerRow, aliases) {
  for (let i = 0; i < headerRow.length; i++) {
    if (aliases.includes(normalizeHeader(headerRow[i]))) return i;
  }
  return -1;
}

function toBoolean(raw, fallback) {
  const v = normalizeHeader(raw);
  if (v === "") return fallback;
  return v === "true" || v === "yes" || v === "1";
}

function toInt(raw, fallback) {
  const n = parseInt(normalize(raw), 10);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Find the worksheet to use for questions: prefer a sheet literally named
 * "Questions"; otherwise use the first sheet whose header row contains a
 * "question" column plus at least two choice columns (covers single-sheet
 * exports such as Kahoot's bulk question export).
 */
function findQuestionsSheet(workbook) {
  const named = workbook.worksheets.find((ws) => normalizeHeader(ws.name) === "questions");
  if (named) return named;

  for (const ws of workbook.worksheets) {
    const headerRow = ws.getRow(1).values.slice(1).map(cellText);
    const hasQuestion = findHeaderIndex(headerRow, HEADER_ALIASES.question) !== -1;
    const choiceCount = CHOICE_ALIASES.filter((c) => findHeaderIndex(headerRow, c.headers) !== -1).length;
    if (hasQuestion && choiceCount >= 2) return ws;
  }
  return null;
}

function parseGameSheet(workbook) {
  const ws = workbook.worksheets.find((s) => normalizeHeader(s.name) === "game");
  if (!ws) return null;

  const settings = {};
  ws.eachRow((row) => {
    const values = row.values.slice(1);
    const field = normalizeHeader(cellText(values[0]));
    const raw = values[1];

    for (const [canonical, aliases] of Object.entries(GAME_FIELD_ALIASES)) {
      if (aliases.includes(field)) {
        if (canonical === "name") settings.name = cellText(raw);
        else if (["allow_late_join", "randomize_questions", "randomize_answers", "show_correct_answer", "show_leaderboard_after_question"].includes(canonical)) {
          settings[canonical] = toBoolean(cellText(raw), undefined);
        } else {
          settings[canonical] = toInt(cellText(raw), undefined);
        }
      }
    }
  });

  return Object.keys(settings).length > 0 ? settings : null;
}

function parseScoringSheet(workbook) {
  const ws = workbook.worksheets.find((s) => normalizeHeader(s.name) === "scoring");
  if (!ws) return null;

  const headerRow = ws.getRow(1).values.slice(1).map(cellText);
  const startIdx = findHeaderIndex(headerRow, ["start second"]);
  const endIdx = findHeaderIndex(headerRow, ["end second"]);
  const pointsIdx = findHeaderIndex(headerRow, ["points"]);
  if (startIdx === -1 || endIdx === -1 || pointsIdx === -1) return null;

  const bands = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const values = ws.getRow(r).values.slice(1);
    const startSec = toInt(cellText(values[startIdx]), null);
    const endSec = toInt(cellText(values[endIdx]), null);
    const points = toInt(cellText(values[pointsIdx]), null);
    if (startSec === null && endSec === null && points === null) continue;
    bands.push({ start_ms: startSec * 1000, end_ms: endSec * 1000, points, display_order: bands.length + 1 });
  }
  if (bands.length === 0) return null;
  bands[bands.length - 1].is_final_band = true;
  bands.forEach((b, i) => {
    if (i !== bands.length - 1) b.is_final_band = false;
  });
  return bands;
}

/**
 * Parse and validate an uploaded workbook buffer into a game-ready shape.
 * Never persists anything and never makes network requests (image URLs are
 * format-checked only, not fetched, to avoid SSRF via untrusted uploads).
 */
export async function parseQuestionsWorkbook(buffer) {
  const errors = [];
  const warnings = [];

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer);
  } catch (err) {
    return { questions: [], gameSettings: null, scoringBands: null, errors: [`Could not read the file: ${err.message}`], warnings: [] };
  }

  const sheet = findQuestionsSheet(workbook);
  if (!sheet) {
    return {
      questions: [],
      gameSettings: null,
      scoringBands: null,
      errors: ["No worksheet with a recognizable Question column and at least two choice columns was found."],
      warnings: []
    };
  }

  const headerRow = sheet.getRow(1).values.slice(1).map(cellText);
  const idx = {
    order: findHeaderIndex(headerRow, HEADER_ALIASES.order),
    question: findHeaderIndex(headerRow, HEADER_ALIASES.question),
    correct: findHeaderIndex(headerRow, HEADER_ALIASES.correct),
    explanation: findHeaderIndex(headerRow, HEADER_ALIASES.explanation),
    category: findHeaderIndex(headerRow, HEADER_ALIASES.category),
    image: findHeaderIndex(headerRow, HEADER_ALIASES.image)
  };
  if (findHeaderIndex(headerRow, ["time limit", "time limit (sec)", "duration"]) !== -1) {
    warnings.push('A "Time Limit" column was found but is ignored: every question always runs a fixed 30-second timer.');
  }

  const choiceColumns = CHOICE_ALIASES.map((c) => ({ letter: c.letter, index: findHeaderIndex(headerRow, c.headers) })).filter(
    (c) => c.index !== -1
  );

  if (idx.question === -1) {
    return { questions: [], gameSettings: null, scoringBands: null, errors: ['No "Question" column was found.'], warnings: [] };
  }
  if (choiceColumns.length < 2) {
    return {
      questions: [],
      gameSettings: null,
      scoringBands: null,
      errors: ["At least two choice columns (Choice A/B or Answer 1/2) are required."],
      warnings: []
    };
  }

  const questions = [];
  const seenOrders = new Set();
  let autoOrder = 0;

  for (let r = 2; r <= sheet.rowCount; r++) {
    const values = sheet.getRow(r).values.slice(1);
    const questionText = cellText(values[idx.question]);

    const rawChoices = choiceColumns.map((c) => ({ letter: c.letter, text: cellText(values[c.index]) }));
    const nonEmptyChoices = rawChoices.filter((c) => c.text !== "");

    // Ignore fully blank trailing rows silently.
    if (questionText === "" && nonEmptyChoices.length === 0) continue;

    autoOrder += 1;
    const rowLabel = `Row ${r}`;

    if (questionText === "") {
      errors.push(`Questions, ${rowLabel}: Question text is empty`);
      continue;
    }
    if (nonEmptyChoices.length < 2) {
      errors.push(`Questions, ${rowLabel}: at least two choices are required`);
      continue;
    }

    let order = idx.order !== -1 ? toInt(cellText(values[idx.order]), null) : null;
    if (order === null) order = autoOrder;
    if (seenOrders.has(order)) {
      errors.push(`Questions, ${rowLabel}: duplicate Order value ${order}`);
      continue;
    }
    seenOrders.add(order);

    // Determine correct choice.
    const rawCorrect = idx.correct !== -1 ? cellText(values[idx.correct]) : "";
    const tokens = rawCorrect.split(/[,;/]+/).map((t) => t.trim()).filter(Boolean);
    if (tokens.length > 1) {
      warnings.push(`${rowLabel}: multiple correct answers given, only the first was used.`);
    }
    const firstToken = tokens[0] || "";

    let correctLetter = null;
    if (/^[A-Fa-f]$/.test(firstToken)) {
      correctLetter = firstToken.toUpperCase();
    } else if (/^\d+$/.test(firstToken)) {
      const position = parseInt(firstToken, 10); // 1-based position among populated choice columns
      correctLetter = nonEmptyChoices[position - 1]?.letter ?? null;
    }

    if (!correctLetter || !nonEmptyChoices.some((c) => c.letter === correctLetter)) {
      errors.push(`Questions, ${rowLabel}: Correct Choice is "${rawCorrect || "(blank)"}" but that choice is blank or missing`);
      continue;
    }

    if (questionText.length > 500) {
      warnings.push(`${rowLabel}: Question text exceeds 500 characters and may display poorly on mobile.`);
    }

    const imageUrl = idx.image !== -1 ? cellText(values[idx.image]) : "";
    if (imageUrl && !/^https:\/\//i.test(imageUrl)) {
      warnings.push(`${rowLabel}: Image URL is not HTTPS and will be ignored.`);
    }

    questions.push({
      question_order: order,
      question_text: questionText,
      category: idx.category !== -1 ? cellText(values[idx.category]) || null : null,
      explanation: idx.explanation !== -1 ? cellText(values[idx.explanation]) || null : null,
      image_url: imageUrl && /^https:\/\//i.test(imageUrl) ? imageUrl : null,
      choices: nonEmptyChoices.map((c, i) => ({
        choice_key: c.letter,
        choice_text: c.text,
        is_correct: c.letter === correctLetter,
        display_order: i + 1
      }))
    });
  }

  if (questions.length === 0 && errors.length === 0) {
    errors.push("No valid questions were found in the worksheet.");
  }

  // Renumber sequentially so gaps left by skipped/invalid rows don't break question_order.
  questions
    .sort((a, b) => a.question_order - b.question_order)
    .forEach((q, i) => {
      q.question_order = i + 1;
    });

  const gameSettings = parseGameSheet(workbook);
  const scoringBands = parseScoringSheet(workbook);

  return { questions, gameSettings, scoringBands, errors, warnings };
}
