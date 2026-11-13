/**
 * Builds a Parallel Decisions request from the demo form.
 * Schema: https://docs.parallel.ai/api-reference/decisions/decisions
 * POST https://api.parallel.ai/v1/decisions
 */

export const DECISIONS_URL = "https://api.parallel.ai/v1/decisions";
export const QUESTION_NAME_PATTERN = /^[A-Za-z0-9_-]+$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const COUNTRY_PATTERN = /^[a-z]{2}$/;
const MAX_INSTRUCTIONS = 4000;
const MAX_RENDERED_QUESTION = 5000;

export class DecisionInputError extends Error {
  constructor(message) {
    super(message);
    this.name = "DecisionInputError";
  }
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function parseState(value) {
  if (value == null || value === "") return {};
  if (typeof value === "object") return value;
  if (typeof value !== "string") {
    throw new DecisionInputError("state must be text or JSON.");
  }
  const trimmed = value.trim();
  if (!trimmed) return {};
  const completeJsonNumber = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/;
  const looksLikeJson =
    trimmed.startsWith("{") ||
    trimmed.startsWith("[") ||
    trimmed.startsWith('"') ||
    trimmed === "null" ||
    trimmed === "true" ||
    trimmed === "false" ||
    completeJsonNumber.test(trimmed);
  if (looksLikeJson) {
    try {
      return JSON.parse(trimmed);
    } catch {
      throw new DecisionInputError("state looks like JSON but did not parse.");
    }
  }
  return { context: trimmed };
}

function parseLines(value) {
  if (Array.isArray(value)) return value.map((line) => text(String(line))).filter(Boolean);
  return text(typeof value === "string" ? value : "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function parseChoiceCriteria(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const criteria = {};
    for (const [key, description] of Object.entries(value)) {
      const name = key.trim();
      const detail = text(typeof description === "string" ? description : "");
      if (!name || !detail) {
        throw new DecisionInputError("Each choice option needs a name and a description.");
      }
      criteria[name] = detail;
    }
    return assertChoice(criteria);
  }
  const criteria = {};
  for (const line of parseLines(value)) {
    const splitAt = line.indexOf("|");
    if (splitAt === -1) {
      throw new DecisionInputError('Choice criteria use one "name | description" per line.');
    }
    const name = line.slice(0, splitAt).trim();
    const description = line.slice(splitAt + 1).trim();
    if (!name || !description) {
      throw new DecisionInputError('Choice criteria use one "name | description" per line.');
    }
    if (Object.hasOwn(criteria, name)) {
      throw new DecisionInputError(`Duplicate choice option "${name}".`);
    }
    criteria[name] = description;
  }
  return assertChoice(criteria);
}

function assertChoice(criteria) {
  const count = Object.keys(criteria).length;
  if (count < 2 || count > 255) {
    throw new DecisionInputError("A choice question needs 2 to 255 options.");
  }
  return criteria;
}

function parseScoreCriteria(value) {
  const levels = Array.isArray(value)
    ? value.map((level) => text(typeof level === "string" ? level : "")).filter(Boolean)
    : parseLines(value);
  if (levels.length < 2 || levels.length > 10) {
    throw new DecisionInputError("A score question needs 2 to 10 levels, one per line, lowest to highest.");
  }
  return levels;
}

function buildQuestion(input) {
  const type = input.type;
  const instructions = text(input.instructions);
  if (!instructions) throw new DecisionInputError("Enter a decision question in instructions.");
  if (instructions.length > MAX_INSTRUCTIONS) {
    throw new DecisionInputError(`instructions exceeds ${MAX_INSTRUCTIONS} characters.`);
  }

  switch (type) {
    case "noul": {
      const question = { type: "noul", instructions };
      const whenTrue = text(input.trueCriteria);
      const whenFalse = text(input.falseCriteria);
      if (whenTrue || whenFalse) {
        if (!whenTrue || !whenFalse) {
          throw new DecisionInputError("Predicate criteria need both a true description and a false description, or neither.");
        }
        question.criteria = { true: whenTrue, false: whenFalse };
      }
      return question;
    }
    case "choice":
      return { type: "choice", instructions, criteria: parseChoiceCriteria(input.criteria) };
    case "score":
      return { type: "score", instructions, criteria: parseScoreCriteria(input.criteria) };
    default:
      throw new DecisionInputError("type must be noul, choice, or score.");
  }
}

export function buildDecisionBody(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new DecisionInputError("Request body must be a JSON object.");
  }
  const name = text(input.name) || "decision";
  if (!QUESTION_NAME_PATTERN.test(name)) {
    throw new DecisionInputError("Question name must contain only letters, numbers, underscores, and hyphens.");
  }
  const question = buildQuestion({
    ...input,
    type: input.type == null || input.type === "" ? "noul" : input.type,
  });
  const rendered = name.length + JSON.stringify(question).length;
  if (rendered > MAX_RENDERED_QUESTION) {
    throw new DecisionInputError(`Rendered question exceeds ${MAX_RENDERED_QUESTION} characters (name, instructions, criteria, and formatting).`);
  }

  const body = {
    state: parseState(input.state),
    questions: { [name]: question },
  };

  const advanced = {};
  const afterDate = text(input.afterDate);
  if (afterDate) {
    if (!DATE_PATTERN.test(afterDate) || Number.isNaN(Date.parse(`${afterDate}T00:00:00Z`))) {
      throw new DecisionInputError("afterDate must be YYYY-MM-DD.");
    }
    advanced.after_date = afterDate;
  }
  const location = text(input.location).toLowerCase();
  if (location) {
    if (!COUNTRY_PATTERN.test(location)) {
      throw new DecisionInputError("location must be an ISO 3166-1 alpha-2 code such as us or gb.");
    }
    advanced.location = location;
  }
  if (input.includeExcerpts === false) advanced.include_excerpts = false;
  if (Object.keys(advanced).length > 0) body.advanced_settings = advanced;
  return body;
}
