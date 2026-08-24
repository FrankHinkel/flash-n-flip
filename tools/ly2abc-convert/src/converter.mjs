const limits = Object.freeze({
  sourceLength: 1_048_576,
  tokens: 250_000,
  assignmentDepth: 32,
  scores: 8,
  staves: 8,
  events: 20_000,
  unfold: 16,
});

const commandDecorations = new Map([
  ["p", "p"],
  ["pp", "pp"],
  ["ppp", "ppp"],
  ["pppp", "pppp"],
  ["mp", "mp"],
  ["mf", "mf"],
  ["f", "f"],
  ["ff", "ff"],
  ["fff", "fff"],
  ["sf", "sfz"],
  ["sfz", "sfz"],
  ["fp", "f"],
  ["fermata", "fermata"],
  ["trill", "trill"],
  ["prall", "trill"],
  ["mordent", "mordent"],
  ["turn", "turn"],
]);

const structuralCommands = new Set([
  "new",
  "context",
  "PianoStaff",
  "Staff",
  "Voice",
  "score",
  "layout",
  "midi",
  "with",
]);

const ignoredCommands = new Set([
  "override",
  "revert",
  "once",
  "set",
  "unset",
  "bar",
  "break",
  "pageBreak",
  "noBreak",
  "mark",
  "markup",
  "bold",
  "italic",
  "teeny",
  "small",
  "tiny",
  "line",
  "column",
  "center-align",
  "hspace",
  "raise",
  "box",
  "with-url",
  "with-color",
  "abs-fontsize",
  "stemUp",
  "stemDown",
  "stemNeutral",
  "slurUp",
  "slurDown",
  "slurNeutral",
  "tieUp",
  "tieDown",
  "tieNeutral",
  "voiceOne",
  "voiceTwo",
  "voiceThree",
  "voiceFour",
  "oneVoice",
  "autoBeamOff",
  "autoBeamOn",
  "sustainOn",
  "sustainOff",
  "sustainDown",
  "sustainUp",
  "ottava",
  "arpeggio",
  "glissando",
  "breathe",
  "laissezVibrer",
  "accent",
  "tenuto",
  "staccato",
  "rest",
]);

const pitchPattern =
  /^([a-h])(isis|eses|ss|ff|is|es|s|f)?([',]*)(?:[!?])?(\d+)?(\.*)(?:\*(\d+)(?:\/(\d+))?)?(?:[-_^+].*)?$/u;
const restPattern =
  /^([rRs])(\d+)?(\.*)(?:\*(\d+)(?:\/(\d+))?)?(?:[-_^+].*)?$/u;
const durationPattern = /^(\d+)(\.*)(?:\*(\d+)(?:\/(\d+))?)?$/u;

const gcd = (left, right) => {
  let a = Math.abs(left);
  let b = Math.abs(right);
  while (b) [a, b] = [b, a % b];
  return a || 1;
};

const fraction = (num, den = 1) => {
  if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0)
    throw new Error("Invalid musical duration");
  const sign = den < 0 ? -1 : 1;
  const divisor = gcd(num, den);
  return { num: (sign * num) / divisor, den: Math.abs(den) / divisor };
};

const addFraction = (left, right) =>
  fraction(left.num * right.den + right.num * left.den, left.den * right.den);
const multiplyFraction = (left, right) =>
  fraction(left.num * right.num, left.den * right.den);
const compareFraction = (left, right) =>
  left.num * right.den - right.num * left.den;

const diagnostic = (severity, code, message, offset = 0) => ({
  severity,
  code,
  message,
  offset,
});

const safeMetadata = (value, fallback) => {
  const normalized = String(value ?? "")
    .replace(/[\u0000-\u001f\u007f<>&]/gu, " ")
    .replace(/\b(?:javascript|data|file|https?|ftp):/giu, " ")
    .replace(/\bon[a-z][a-z0-9_-]*\s*=/giu, " ")
    .replace(/\burl\s*\(|@import|expression\s*\(/giu, " ")
    .replace(/\s+/gu, " ")
    .trim();
  return normalized.slice(0, 200) || fallback;
};

function assertSafeSource(source) {
  if (typeof source !== "string" || source.length === 0)
    throw new Error("LilyPond source is empty");
  if (source.length > limits.sourceLength)
    throw new Error("LilyPond source exceeds the 1 MiB limit");
  if (/\u0000|[\u0001-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(source))
    throw new Error("LilyPond source contains unsupported control characters");
}

function consumeScheme(source, start) {
  let index = start + 1;
  if (source[index] === '"') {
    index += 1;
    while (index < source.length) {
      if (source[index] === "\\") index += 2;
      else if (source[index] === '"') return index + 1;
      else index += 1;
    }
    return source.length;
  }
  if (source[index] === "'" || source[index] === "`") index += 1;
  if (source[index] !== "(") {
    while (index < source.length && !/[\s{}<>]/u.test(source[index]))
      index += 1;
    return index;
  }
  let depth = 0;
  let quoted = false;
  for (; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (character === "\\") index += 1;
      else if (character === '"') quoted = false;
      continue;
    }
    if (character === '"') quoted = true;
    else if (character === "(") depth += 1;
    else if (character === ")" && --depth === 0) return index + 1;
  }
  return source.length;
}

export function tokenizeLilypond(source) {
  assertSafeSource(source);
  const tokens = [];
  let index = 0;
  const push = (kind, value, start) => {
    tokens.push({ kind, value, offset: start });
    if (tokens.length > limits.tokens)
      throw new Error("LilyPond source exceeds the token limit");
  };

  while (index < source.length) {
    const character = source[index];
    if (/\s/u.test(character)) {
      index += 1;
      continue;
    }
    if (character === "%" && source[index + 1] === "{") {
      const end = source.indexOf("%}", index + 2);
      index = end < 0 ? source.length : end + 2;
      continue;
    }
    if (character === "%") {
      const end = source.indexOf("\n", index + 1);
      index = end < 0 ? source.length : end + 1;
      continue;
    }
    if (character === '"') {
      const start = index++;
      let value = "";
      while (index < source.length) {
        if (source[index] === "\\") {
          value += source[index + 1] ?? "";
          index += 2;
        } else if (source[index] === '"') {
          index += 1;
          break;
        } else value += source[index++];
      }
      push("string", value, start);
      continue;
    }
    if (character === "#") {
      const start = index;
      index = consumeScheme(source, index);
      push("scheme", source.slice(start, index), start);
      continue;
    }
    if (character === "\\") {
      const start = index++;
      if (source[index] === "\\") {
        index += 1;
        push("command", "\\", start);
        continue;
      }
      const match = source.slice(index).match(/^[A-Za-z][A-Za-z0-9-]*/u);
      if (match) {
        index += match[0].length;
        push("command", match[0], start);
      } else {
        push("symbol", "\\", start);
      }
      continue;
    }
    const pair = source.slice(index, index + 2);
    if (pair === "<<" || pair === ">>") {
      push("symbol", pair, index);
      index += 2;
      continue;
    }
    if ("{}<>=[]()~|".includes(character)) {
      push("symbol", character, index++);
      continue;
    }
    const start = index;
    while (
      index < source.length &&
      !/[\s%"#\\{}<>=\[\]()~|]/u.test(source[index])
    )
      index += 1;
    push("word", source.slice(start, index), start);
  }
  return tokens;
}

function groupAt(tokens, start, open = "{", close = "}") {
  if (tokens[start]?.kind !== "symbol" || tokens[start]?.value !== open)
    return null;
  let depth = 0;
  for (let index = start; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token?.kind !== "symbol") continue;
    if (token.value === open) depth += 1;
    else if (token.value === close && --depth === 0)
      return { tokens: tokens.slice(start + 1, index), end: index + 1 };
  }
  return null;
}

function expressionAt(tokens, start) {
  const token = tokens[start];
  if (!token) return null;
  if (
    token.kind === "command" &&
    (token.value === "context" || token.value === "new") &&
    tokens[start + 1]?.kind === "word" &&
    (tokens[start + 1].value === "Staff" || tokens[start + 1].value === "Voice")
  ) {
    let cursor = start + 2;
    if (tokens[cursor]?.kind === "symbol" && tokens[cursor]?.value === "=")
      cursor += 2;
    return expressionAt(tokens, cursor);
  }
  if (token.kind === "command" && token.value === "relative") {
    const base =
      tokens[start + 1]?.kind === "word" ? tokens[start + 1].value : "c'";
    const groupStart =
      tokens[start + 1]?.kind === "word" ? start + 2 : start + 1;
    const group = groupAt(tokens, groupStart);
    return group
      ? { tokens: group.tokens, relativeBase: base, end: group.end }
      : null;
  }
  if (
    token.kind === "symbol" &&
    (token.value === "{" || token.value === "<<")
  ) {
    const group = groupAt(
      tokens,
      start,
      token.value,
      token.value === "{" ? "}" : ">>",
    );
    return group ? { tokens: group.tokens, end: group.end } : null;
  }
  if (token.kind === "command") return { tokens: [token], end: start + 1 };
  return null;
}

function collectAssignments(tokens) {
  const assignments = new Map();
  for (let index = 0; index < tokens.length - 2; index += 1) {
    if (
      tokens[index]?.kind !== "word" ||
      tokens[index + 1]?.kind !== "symbol" ||
      tokens[index + 1]?.value !== "="
    )
      continue;
    const expression = expressionAt(tokens, index + 2);
    if (expression) assignments.set(tokens[index].value, expression);
  }
  return assignments;
}

function collectHeader(tokens) {
  const headerIndex = tokens.findIndex(
    (token) => token.kind === "command" && token.value === "header",
  );
  if (headerIndex < 0) return {};
  const group = groupAt(tokens, headerIndex + 1);
  if (!group) return {};
  const header = {};
  for (let index = 0; index < group.tokens.length - 2; index += 1) {
    const name = group.tokens[index];
    const equals = group.tokens[index + 1];
    const value = group.tokens[index + 2];
    if (
      name?.kind === "word" &&
      equals?.kind === "symbol" &&
      equals.value === "=" &&
      value?.kind === "string"
    )
      header[name.value] = value.value;
    else if (
      name?.kind === "word" &&
      equals?.kind === "symbol" &&
      equals.value === "=" &&
      value?.kind === "command" &&
      value.value === "markup"
    ) {
      const markup = groupAt(group.tokens, index + 3);
      const text = markup?.tokens.find((token) => token.kind === "string");
      if (text) header[name.value] = text.value;
    }
  }
  return header;
}

function detectPitchLanguage(tokens) {
  for (let index = 0; index < tokens.length - 1; index += 1) {
    const command = tokens[index];
    const value = tokens[index + 1];
    if (
      command?.kind === "command" &&
      ((command.value === "include" &&
        value?.kind === "string" &&
        /(?:^|\/)deutsch\.ly$/iu.test(value.value)) ||
        (command.value === "language" &&
          value?.kind === "string" &&
          value.value.toLowerCase() === "deutsch"))
    )
      return "deutsch";
  }
  return "default";
}

function collectScores(tokens) {
  const scores = [];
  for (let index = 0; index < tokens.length - 1; index += 1) {
    if (tokens[index]?.kind !== "command" || tokens[index]?.value !== "score")
      continue;
    const group = groupAt(tokens, index + 1);
    if (!group) continue;
    scores.push(group.tokens);
    index = group.end - 1;
    if (scores.length > limits.scores)
      throw new Error("LilyPond source exceeds the eight-score limit");
  }
  return scores;
}

function collectStaves(scoreTokens) {
  const staves = [];
  for (let index = 0; index < scoreTokens.length - 1; index += 1) {
    const command = scoreTokens[index];
    if (
      command?.kind !== "command" ||
      (command.value !== "new" && command.value !== "context")
    )
      continue;
    const type = scoreTokens[index + 1];
    if (type?.kind !== "word" || type.value !== "Staff") continue;
    let cursor = index + 2;
    let name;
    if (
      scoreTokens[cursor]?.kind === "symbol" &&
      scoreTokens[cursor]?.value === "="
    ) {
      const nameToken = scoreTokens[cursor + 1];
      if (nameToken?.kind === "word" || nameToken?.kind === "string")
        name = nameToken.value;
      cursor += 2;
    }
    while (
      scoreTokens[cursor]?.kind === "command" &&
      scoreTokens[cursor]?.value === "with"
    ) {
      const withGroup = groupAt(scoreTokens, cursor + 1);
      cursor = withGroup?.end ?? cursor + 1;
    }
    const expression = expressionAt(scoreTokens, cursor);
    if (expression) {
      staves.push({ name, expression });
      index = Math.max(index, expression.end - 1);
    }
    if (staves.length > limits.staves)
      throw new Error("LilyPond score exceeds the eight-staff limit");
  }
  return staves;
}

function collectVoiceExpressions(expression) {
  const voices = [];
  const tokens = expression.tokens;
  for (let index = 0; index < tokens.length - 1; index += 1) {
    const command = tokens[index];
    const type = tokens[index + 1];
    if (
      command?.kind !== "command" ||
      (command.value !== "new" && command.value !== "context") ||
      type?.kind !== "word" ||
      type.value !== "Voice"
    )
      continue;
    let cursor = index + 2;
    let name;
    if (tokens[cursor]?.kind === "symbol" && tokens[cursor]?.value === "=") {
      const nameToken = tokens[cursor + 1];
      if (nameToken?.kind === "word" || nameToken?.kind === "string")
        name = nameToken.value;
      cursor += 2;
    }
    while (
      tokens[cursor]?.kind === "command" &&
      tokens[cursor]?.value === "with"
    ) {
      const withGroup = groupAt(tokens, cursor + 1);
      cursor = withGroup?.end ?? cursor + 1;
    }
    const voiceExpression = expressionAt(tokens, cursor);
    if (voiceExpression) {
      voices.push({ name, expression: voiceExpression });
      index = Math.max(index, voiceExpression.end - 1);
    }
  }
  return voices.length > 0 ? voices : [{ name: undefined, expression }];
}

function splitSimultaneousBranches(tokens) {
  const branches = [];
  let start = 0;
  let braceDepth = 0;
  let simultaneousDepth = 0;
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token?.kind === "symbol") {
      if (token.value === "{") braceDepth += 1;
      else if (token.value === "}") braceDepth -= 1;
      else if (token.value === "<<") simultaneousDepth += 1;
      else if (token.value === ">>") simultaneousDepth -= 1;
    }
    if (
      token?.kind === "command" &&
      token.value === "\\" &&
      braceDepth === 0 &&
      simultaneousDepth === 0
    ) {
      branches.push(tokens.slice(start, index));
      start = index + 1;
    }
  }
  if (branches.length === 0) return null;
  branches.push(tokens.slice(start));
  return branches.filter((branch) => branch.length > 0);
}

function expandExpression(expression, assignments, diagnostics, stack = []) {
  if (stack.length > limits.assignmentDepth)
    throw new Error("LilyPond variable expansion exceeds 32 levels");
  const expanded = [];
  if (expression.relativeBase)
    expanded.push({
      kind: "relative",
      value: expression.relativeBase,
      offset: 0,
    });
  for (const token of expression.tokens) {
    if (token.kind === "command" && assignments.has(token.value)) {
      if (stack.includes(token.value))
        throw new Error(`Recursive LilyPond variable: ${token.value}`);
      expanded.push(
        ...expandExpression(
          assignments.get(token.value),
          assignments,
          diagnostics,
          [...stack, token.value],
        ),
      );
    } else expanded.push(token);
  }
  return expanded;
}

function accidentalForSuffix(suffix = "") {
  if (suffix === "isis" || suffix === "ss") return 2;
  if (suffix === "is" || suffix === "s") return 1;
  if (suffix === "eses" || suffix === "ff") return -2;
  if (suffix === "es" || suffix === "f") return -1;
  return 0;
}

const letterIndex = (letter) => "cdefgab".indexOf(letter);
const naturalPitchClass = Object.freeze({
  c: 0,
  d: 2,
  e: 4,
  f: 5,
  g: 7,
  a: 9,
  b: 11,
});

function absolutePitch(token, pitchLanguage = "default") {
  const match = token.match(pitchPattern);
  if (!match) return null;
  const marks = match[3] ?? "";
  const octave =
    3 +
    [...marks].filter((mark) => mark === "'").length -
    [...marks].filter((mark) => mark === ",").length;
  const rawLetter = match[1];
  const letter = rawLetter === "h" ? "b" : rawLetter;
  const accidental =
    pitchLanguage === "deutsch" && rawLetter === "b" && !match[2]
      ? -1
      : accidentalForSuffix(match[2]);
  return {
    letter,
    accidental,
    octave,
    midi: (octave + 1) * 12 + naturalPitchClass[letter] + accidental,
  };
}

function relativePitch(token, previous, pitchLanguage = "default") {
  const parsed = absolutePitch(token, pitchLanguage);
  if (!parsed) return null;
  if (!previous) return parsed;
  let octave = previous.octave;
  const difference = letterIndex(parsed.letter) - letterIndex(previous.letter);
  if (difference > 3) octave -= 1;
  else if (difference < -3) octave += 1;
  const marks = token.match(pitchPattern)?.[3] ?? "";
  octave += [...marks].filter((mark) => mark === "'").length;
  octave -= [...marks].filter((mark) => mark === ",").length;
  return {
    ...parsed,
    octave,
    midi:
      (octave + 1) * 12 + naturalPitchClass[parsed.letter] + parsed.accidental,
  };
}

function pitchToAbc(pitch) {
  const accidental =
    pitch.accidental === 0
      ? "="
      : pitch.accidental > 0
        ? "^".repeat(pitch.accidental)
        : "_".repeat(-pitch.accidental);
  const upper = pitch.letter.toUpperCase();
  if (pitch.octave >= 5)
    return `${accidental}${pitch.letter}${"'".repeat(pitch.octave - 5)}`;
  return `${accidental}${upper}${",".repeat(Math.max(0, 4 - pitch.octave))}`;
}

function duration64(denominator, dots) {
  if (![1, 2, 4, 8, 16, 32, 64, 128].includes(denominator))
    throw new Error(`Unsupported LilyPond duration: ${denominator}`);
  let result = fraction(64, denominator);
  let addition = result;
  for (let index = 0; index < dots; index += 1) {
    addition = fraction(addition.num, addition.den * 2);
    result = addFraction(result, addition);
  }
  return result;
}

function durationToAbc(duration) {
  if (duration.num === duration.den) return "";
  if (duration.den === 1) return String(duration.num);
  if (duration.num === 1) return `/${duration.den}`;
  return `${duration.num}/${duration.den}`;
}

function parseKeyPitch(word, pitchLanguage = "default") {
  const match = word?.match(/^([a-h])(isis|eses|is|es|ss|ff|s|f)?$/u);
  if (!match) return "C";
  const rawLetter = match[1];
  const letter = rawLetter === "h" ? "b" : rawLetter;
  const accidental =
    pitchLanguage === "deutsch" && rawLetter === "b" && !match[2]
      ? -1
      : accidentalForSuffix(match[2]);
  return `${letter.toUpperCase()}${accidental > 0 ? "#".repeat(accidental) : "b".repeat(-accidental)}`;
}

function parseStaff(tokens, staffIndex, diagnostics, options = {}) {
  const pitchLanguage = options.pitchLanguage ?? "default";
  const state = {
    index: 0,
    previous: null,
    relative: false,
    durationDenominator: 4,
    durationDots: 0,
    clef: staffIndex === 0 ? "treble" : "bass",
    initialClef: staffIndex === 0 ? "treble" : "bass",
    key: "C",
    initialKey: "C",
    meter: "4/4",
    initialMeter: "4/4",
    tempo: 60,
    initialTempo: 60,
    measurePosition: fraction(0),
    measureTarget: fraction(64),
    fullMeasureTarget: fraction(64),
    timeScale: fraction(1),
    output: [],
    eventCount: 0,
    noteCount: 0,
    restCount: 0,
    chordCount: 0,
    lastEventIndex: -1,
    pendingDecorations: [],
    ignored: new Set(),
    explicitBars: 0,
    pendingBar: false,
    totalDuration: fraction(0),
    staffChanges: 0,
  };

  const issue = (severity, code, message, token = tokens[state.index]) =>
    diagnostics.push(diagnostic(severity, code, message, token?.offset ?? 0));
  const warn = (code, message, token = tokens[state.index]) =>
    issue("warning", code, message, token);
  const error = (code, message, token = tokens[state.index]) =>
    issue("error", code, message, token);

  const append = (value) => {
    if (!value) return;
    state.output.push(value);
  };

  const appendBar = (value = "|") => {
    state.pendingBar = false;
    const previous = state.output.at(-1);
    if (previous === "|" && value === "|") return;
    append(value);
  };

  const flushPendingBar = () => {
    if (state.pendingBar) appendBar();
  };

  const decorate = (name) => {
    const decoration = `!${name}!`;
    if (state.lastEventIndex >= 0)
      state.output[state.lastEventIndex] =
        `${decoration}${state.output[state.lastEventIndex]}`;
    else state.pendingDecorations.push(decoration);
  };

  const setMeter = (meter) => {
    const match = meter?.match(/^(\d{1,2})\/(\d{1,2})$/u);
    if (!match) {
      warn("unsupported-meter", `Unsupported meter ${meter ?? ""}`);
      return;
    }
    state.meter = meter;
    state.fullMeasureTarget = fraction(Number(match[1]) * 64, Number(match[2]));
    state.measureTarget = state.fullMeasureTarget;
  };

  const finishMeasureIfNeeded = (actualDuration) => {
    state.measurePosition = addFraction(state.measurePosition, actualDuration);
    const comparison = compareFraction(
      state.measurePosition,
      state.measureTarget,
    );
    if (comparison === 0) {
      state.pendingBar = true;
      state.measurePosition = fraction(0);
      state.measureTarget = state.fullMeasureTarget;
    } else if (comparison > 0) {
      error(
        "measure-overflow",
        "A converted voice exceeds its inferred measure duration",
      );
      state.pendingBar = true;
      state.measurePosition = fraction(0);
      state.measureTarget = state.fullMeasureTarget;
    }
  };

  const emitEvent = (
    text,
    nominalDuration,
    { grace = false, kind = "note" } = {},
  ) => {
    flushPendingBar();
    if (++state.eventCount > limits.events)
      throw new Error("Converted tune exceeds the 20,000-event limit");
    if (kind === "note") state.noteCount += 1;
    else state.restCount += 1;
    const prefix = state.pendingDecorations.join("");
    state.pendingDecorations = [];
    append(`${prefix}${text}${durationToAbc(nominalDuration)}`);
    state.lastEventIndex = state.output.length - 1;
    if (!grace) {
      const actualDuration = multiplyFraction(nominalDuration, state.timeScale);
      state.totalDuration = addFraction(state.totalDuration, actualDuration);
      finishMeasureIfNeeded(actualDuration);
    }
  };

  const snapshot = () => ({
    previous: state.previous,
    relative: state.relative,
    durationDenominator: state.durationDenominator,
    durationDots: state.durationDots,
    clef: state.clef,
    initialClef: state.initialClef,
    key: state.key,
    initialKey: state.initialKey,
    meter: state.meter,
    initialMeter: state.initialMeter,
    tempo: state.tempo,
    initialTempo: state.initialTempo,
    measurePosition: state.measurePosition,
    measureTarget: state.measureTarget,
    fullMeasureTarget: state.fullMeasureTarget,
    timeScale: state.timeScale,
    output: [...state.output],
    eventCount: state.eventCount,
    noteCount: state.noteCount,
    restCount: state.restCount,
    chordCount: state.chordCount,
    lastEventIndex: state.lastEventIndex,
    pendingDecorations: [...state.pendingDecorations],
    explicitBars: state.explicitBars,
    pendingBar: state.pendingBar,
    totalDuration: state.totalDuration,
    staffChanges: state.staffChanges,
  });

  const restore = (saved) => {
    for (const [name, value] of Object.entries(saved)) state[name] = value;
  };

  const consumeDuration = (wordMatch, pitch) => {
    if (pitch && wordMatch?.[4]) {
      state.durationDenominator = Number(wordMatch[4]);
      state.durationDots = wordMatch[5]?.length ?? 0;
    } else if (!pitch && wordMatch?.[2]) {
      state.durationDenominator = Number(wordMatch[2]);
      state.durationDots = wordMatch[3]?.length ?? 0;
    }
    const multiplierNumerator = Number(wordMatch?.[pitch ? 6 : 4] ?? "1");
    const multiplierDenominator = Number(wordMatch?.[pitch ? 7 : 5] ?? "1");
    return multiplyFraction(
      duration64(state.durationDenominator, state.durationDots),
      fraction(multiplierNumerator, multiplierDenominator),
    );
  };

  const consumePitch = (word, anchor = state.previous) => {
    const pitch = state.relative
      ? relativePitch(word, anchor, pitchLanguage)
      : absolutePitch(word, pitchLanguage);
    if (!pitch) throw new Error(`Unsupported LilyPond pitch: ${word}`);
    return pitch;
  };

  const parseSequence = (sequence, options = {}) => {
    const previousTokens = tokens;
    const previousIndex = state.index;
    tokens = sequence;
    state.index = 0;
    const grace = options.grace ?? false;
    while (state.index < tokens.length) {
      const token = tokens[state.index];
      if (!token) break;
      if (token.kind === "relative") {
        state.relative = true;
        state.previous = absolutePitch(token.value, pitchLanguage);
        state.index += 1;
        continue;
      }
      if (token.kind === "scheme") {
        warn("scheme-ignored", "Embedded Scheme was ignored", token);
        state.index += 1;
        continue;
      }
      if (token.kind === "string") {
        state.index += 1;
        continue;
      }
      if (token.kind === "word") {
        const pitchMatch = token.value.match(pitchPattern);
        const restMatch = token.value.match(restPattern);
        if (pitchMatch) {
          const pitch = consumePitch(token.value);
          state.previous = pitch;
          emitEvent(pitchToAbc(pitch), consumeDuration(pitchMatch, true), {
            grace,
          });
        } else if (restMatch) {
          emitEvent(
            restMatch[1].toLowerCase() === "s" ? "x" : "z",
            consumeDuration(restMatch, false),
            {
              grace,
              kind: "rest",
            },
          );
        }
        state.index += 1;
        continue;
      }
      if (token.kind === "symbol") {
        if (token.value === "{") {
          const group = groupAt(tokens, state.index);
          if (!group) throw new Error("Unclosed LilyPond music block");
          parseSequence(group.tokens, { grace });
          state.index = group.end;
          continue;
        }
        if (token.value === "<<") {
          const group = groupAt(tokens, state.index, "<<", ">>");
          if (!group) throw new Error("Unclosed simultaneous music block");
          const branches = splitSimultaneousBranches(group.tokens);
          if (!branches) {
            parseSequence(group.tokens, { grace });
            state.index = group.end;
            continue;
          }
          const baseline = snapshot();
          const convertedBranches = [];
          for (const branch of branches) {
            restore({
              ...baseline,
              output: [],
              eventCount: 0,
              noteCount: 0,
              restCount: 0,
              chordCount: 0,
              lastEventIndex: -1,
              totalDuration: fraction(0),
            });
            parseSequence(branch, { grace });
            flushPendingBar();
            convertedBranches.push(snapshot());
          }
          const audibleBranches = convertedBranches.filter(
            (branch) => branch.noteCount > 0,
          );
          const activeBranches =
            audibleBranches.length > 0 ? audibleBranches : convertedBranches;
          const primary = activeBranches[0];
          if (
            activeBranches.some(
              (branch) =>
                compareFraction(branch.totalDuration, primary.totalDuration) !==
                0,
            )
          )
            error(
              "simultaneous-duration-mismatch",
              "Simultaneous LilyPond branches have different durations",
              token,
            );
          restore({
            ...primary,
            output: [
              ...baseline.output,
              activeBranches.length === 1
                ? activeBranches[0].output.join(" ")
                : `(& ${activeBranches
                    .map((branch) => branch.output.join(" "))
                    .join(" & ")} &)`,
            ],
            eventCount:
              baseline.eventCount +
              activeBranches.reduce(
                (sum, branch) => sum + branch.eventCount,
                0,
              ),
            noteCount:
              baseline.noteCount +
              activeBranches.reduce((sum, branch) => sum + branch.noteCount, 0),
            restCount:
              baseline.restCount +
              activeBranches.reduce((sum, branch) => sum + branch.restCount, 0),
            chordCount:
              baseline.chordCount +
              activeBranches.reduce(
                (sum, branch) => sum + branch.chordCount,
                0,
              ),
            totalDuration: addFraction(
              baseline.totalDuration,
              primary.totalDuration,
            ),
            lastEventIndex: baseline.output.length,
            staffChanges:
              baseline.staffChanges +
              activeBranches.reduce(
                (sum, branch) => sum + branch.staffChanges,
                0,
              ),
          });
          state.index = group.end;
          continue;
        }
        if (token.value === "<") {
          const group = groupAt(tokens, state.index, "<", ">");
          if (!group) throw new Error("Unclosed LilyPond chord");
          const pitchWords = group.tokens.filter(
            (item) => item.kind === "word" && pitchPattern.test(item.value),
          );
          if (pitchWords.length === 0) {
            warn(
              "empty-chord",
              "Chord without supported pitches was ignored",
              token,
            );
            state.index = group.end;
            continue;
          }
          const first = consumePitch(pitchWords[0].value, state.previous);
          const pitches = [first];
          for (const pitchWord of pitchWords.slice(1))
            pitches.push(consumePitch(pitchWord.value, pitches.at(-1)));
          state.previous = first;
          let duration = duration64(
            state.durationDenominator,
            state.durationDots,
          );
          const durationToken = tokens[group.end];
          const durationMatch =
            durationToken?.kind === "word"
              ? durationToken.value.match(durationPattern)
              : null;
          if (durationMatch) {
            state.durationDenominator = Number(durationMatch[1]);
            state.durationDots = durationMatch[2]?.length ?? 0;
            duration = duration64(
              state.durationDenominator,
              state.durationDots,
            );
            duration = multiplyFraction(
              duration,
              fraction(
                Number(durationMatch[3] ?? "1"),
                Number(durationMatch[4] ?? "1"),
              ),
            );
            state.index = group.end + 1;
          } else state.index = group.end;
          state.chordCount += 1;
          emitEvent(`[${pitches.map(pitchToAbc).join("")}]`, duration, {
            grace,
          });
          continue;
        }
        if (token.value === "~") append("-");
        else if (token.value === "(") append("(");
        else if (token.value === ")") append(")");
        else if (token.value === "|") {
          flushPendingBar();
          appendBar();
          state.explicitBars += 1;
          state.measurePosition = fraction(0);
          state.measureTarget = state.fullMeasureTarget;
        }
        state.index += 1;
        continue;
      }

      if (token.kind === "command") {
        const name = token.value;
        if (name === "\\") {
          error(
            "orphan-simultaneous-separator",
            "A simultaneous voice separator appeared outside a supported block",
            token,
          );
          state.index += 1;
          continue;
        }
        if (commandDecorations.has(name)) {
          decorate(commandDecorations.get(name));
          state.index += 1;
          continue;
        }
        if (name === "clef") {
          const value = tokens[state.index + 1];
          const clef = value?.value?.toLowerCase();
          let nextClef;
          if (clef?.includes("bass")) nextClef = "bass";
          else if (clef?.includes("treble")) nextClef = "treble";
          else
            warn("unsupported-clef", `Unsupported clef ${clef ?? ""}`, token);
          if (nextClef) {
            state.clef = nextClef;
            if (state.eventCount === 0) state.initialClef = nextClef;
            else append(`[K:${state.key} clef=${nextClef}]`);
          }
          state.index += 2;
          continue;
        }
        if (name === "key") {
          const pitch = tokens[state.index + 1]?.value;
          const mode = tokens[state.index + 2];
          state.key = `${parseKeyPitch(pitch, pitchLanguage)}${mode?.kind === "command" && mode.value === "minor" ? "m" : ""}`;
          if (state.eventCount === 0) state.initialKey = state.key;
          else append(`[K:${state.key}]`);
          state.index += mode?.kind === "command" ? 3 : 2;
          continue;
        }
        if (name === "time") {
          setMeter(tokens[state.index + 1]?.value);
          if (state.eventCount === 0) state.initialMeter = state.meter;
          else append(`[M:${state.meter}]`);
          state.index += 2;
          continue;
        }
        if (name === "tempo") {
          let cursor = state.index + 1;
          let bpm;
          while (cursor < Math.min(tokens.length, state.index + 9)) {
            const value = tokens[cursor]?.value;
            if (/^\d{2,3}$/u.test(value ?? "")) bpm = Number(value);
            cursor += 1;
          }
          if (bpm && bpm >= 20 && bpm <= 350) state.tempo = bpm;
          if (bpm && bpm >= 20 && bpm <= 350) {
            if (state.eventCount === 0) state.initialTempo = bpm;
            else append(`[Q:1/4=${bpm}]`);
          }
          state.index += 1;
          continue;
        }
        if (name === "partial") {
          const value = tokens[state.index + 1]?.value?.match(durationPattern);
          if (value)
            state.measureTarget = duration64(
              Number(value[1]),
              value[2]?.length ?? 0,
            );
          else
            warn("unsupported-partial", "Unsupported pickup duration", token);
          state.index += 2;
          continue;
        }
        if (name === "relative") {
          const base = tokens[state.index + 1]?.value ?? "c'";
          const groupStart = state.index + 2;
          const group = groupAt(tokens, groupStart);
          if (!group) throw new Error("Invalid relative music block");
          const oldRelative = state.relative;
          const oldPrevious = state.previous;
          state.relative = true;
          state.previous = absolutePitch(base, pitchLanguage);
          parseSequence(group.tokens, { grace });
          state.relative = oldRelative;
          state.previous = oldPrevious;
          state.index = group.end;
          continue;
        }
        if (
          name === "grace" ||
          name === "appoggiatura" ||
          name === "acciaccatura"
        ) {
          const group = groupAt(tokens, state.index + 1);
          flushPendingBar();
          append("{");
          if (group) parseSequence(group.tokens, { grace: true });
          else {
            const single = tokens[state.index + 1];
            if (
              !single ||
              single.kind !== "word" ||
              (!pitchPattern.test(single.value) &&
                !restPattern.test(single.value))
            )
              throw new Error(`Invalid ${name} block`);
            parseSequence([single], { grace: true });
          }
          append("}");
          state.index = group?.end ?? state.index + 2;
          continue;
        }
        if (name === "tuplet" || name === "times") {
          const ratioToken = tokens[state.index + 1];
          const ratio = ratioToken?.value?.match(/^(\d+)\/(\d+)$/u);
          const group = groupAt(tokens, state.index + 2);
          if (!ratio || !group) throw new Error(`Invalid ${name} block`);
          const left = Number(ratio[1]);
          const right = Number(ratio[2]);
          const factor =
            name === "tuplet" ? fraction(right, left) : fraction(left, right);
          const count = name === "tuplet" ? left : right;
          append(
            count === 3 && factor.num === 2 && factor.den === 3
              ? "(3"
              : `(${count}:${factor.num}:${count}`,
          );
          const oldScale = state.timeScale;
          state.timeScale = multiplyFraction(state.timeScale, factor);
          parseSequence(group.tokens, { grace });
          state.timeScale = oldScale;
          state.index = group.end;
          continue;
        }
        if (name === "repeat") {
          const kind = tokens[state.index + 1]?.value;
          const count = Number(tokens[state.index + 2]?.value ?? "2");
          const group = groupAt(tokens, state.index + 3);
          if (!group) throw new Error("Invalid LilyPond repeat block");
          if (kind === "volta") {
            append("|:");
            parseSequence(group.tokens, { grace });
            append(":|");
          } else if (kind === "unfold") {
            if (!Number.isInteger(count) || count < 1 || count > limits.unfold)
              throw new Error("repeat unfold exceeds the limit of 16");
            for (let repeat = 0; repeat < count; repeat += 1)
              parseSequence(group.tokens, { grace });
          } else {
            warn(
              "unsupported-repeat",
              `Unsupported repeat kind ${kind ?? ""}`,
              token,
            );
            parseSequence(group.tokens, { grace });
          }
          state.index = group.end;
          continue;
        }
        if (name === "alternative") {
          const alternatives = groupAt(tokens, state.index + 1);
          if (!alternatives) throw new Error("Invalid alternative block");
          let cursor = 0;
          let alternative = 1;
          while (cursor < alternatives.tokens.length) {
            const group = groupAt(alternatives.tokens, cursor);
            if (!group) {
              cursor += 1;
              continue;
            }
            append(`[${alternative++}`);
            parseSequence(group.tokens, { grace });
            cursor = group.end;
          }
          state.index = alternatives.end;
          continue;
        }
        if (name === "change") {
          state.staffChanges += 1;
          let cursor = state.index + 1;
          if (tokens[cursor]?.value === "Staff") cursor += 1;
          if (tokens[cursor]?.value === "=") cursor += 1;
          if (
            tokens[cursor]?.kind === "word" ||
            tokens[cursor]?.kind === "string"
          )
            cursor += 1;
          state.index = cursor;
          continue;
        }
        if (name === "include") {
          warn("include-ignored", "LilyPond include was not read", token);
          state.index += 2;
          continue;
        }
        if (!ignoredCommands.has(name) && !structuralCommands.has(name))
          state.ignored.add(name);
        state.index += 1;
        continue;
      }
      state.index += 1;
    }
    tokens = previousTokens;
    state.index = previousIndex;
  };

  parseSequence(tokens);
  flushPendingBar();
  for (const command of state.ignored)
    diagnostics.push(
      diagnostic(
        "warning",
        "command-ignored",
        `Unsupported LilyPond command was ignored: \\${command}`,
      ),
    );
  return {
    abc: state.output.join(" ").replace(/\s+/gu, " ").trim(),
    clef: state.initialClef,
    key: state.initialKey,
    meter: state.initialMeter,
    tempo: state.initialTempo,
    events: state.eventCount,
    notes: state.noteCount,
    rests: state.restCount,
    chords: state.chordCount,
    ignoredCommands: [...state.ignored].sort(),
    duration: state.totalDuration,
    staffChanges: state.staffChanges,
  };
}

export function inspectLilypondSource(source) {
  const tokens = tokenizeLilypond(source);
  const assignments = collectAssignments(tokens);
  const scores = collectScores(tokens);
  const versionIndex = tokens.findIndex(
    (token) => token.kind === "command" && token.value === "version",
  );
  const version =
    versionIndex >= 0 ? tokens[versionIndex + 1]?.value : undefined;
  const commands = [
    ...new Set(
      tokens
        .filter((token) => token.kind === "command")
        .map((token) => token.value),
    ),
  ].sort();
  return {
    version,
    pitchLanguage: detectPitchLanguage(tokens),
    header: collectHeader(tokens),
    tokenCount: tokens.length,
    assignmentCount: assignments.size,
    scoreCount: scores.length,
    staffCounts: scores.map((score) => collectStaves(score).length),
    schemeCount: tokens.filter((token) => token.kind === "scheme").length,
    includes: commands.includes("include"),
    commands,
  };
}

export function convertLilypondSource(source, options = {}) {
  const tokens = tokenizeLilypond(source);
  const header = collectHeader(tokens);
  const assignments = collectAssignments(tokens);
  const scoreBlocks = collectScores(tokens);
  const diagnostics = [];
  const inspection = inspectLilypondSource(source);

  if (inspection.schemeCount > 0)
    diagnostics.push(
      diagnostic(
        "warning",
        "scheme-present",
        `${inspection.schemeCount} embedded Scheme token(s) were kept inert`,
      ),
    );
  if (inspection.includes)
    diagnostics.push(
      diagnostic(
        "warning",
        "include-present",
        "LilyPond includes are not resolved by converter stage 1",
      ),
    );
  if (scoreBlocks.length === 0)
    throw new Error("No LilyPond score block was found");

  const tunes = scoreBlocks.map((scoreTokens, scoreIndex) => {
    const staves = collectStaves(scoreTokens);
    if (staves.length === 0)
      throw new Error(`Score ${scoreIndex + 1} contains no supported Staff`);
    const convertedStaves = staves.flatMap((staff, staffIndex) => {
      const voices = collectVoiceExpressions(staff.expression);
      const hand = staffIndex === 0 ? "RH" : staffIndex === 1 ? "LH" : null;
      const converted = voices.map((voice, voiceIndex) => {
        const expanded = expandExpression(
          voice.expression,
          assignments,
          diagnostics,
        );
        return {
          id: hand
            ? voices.length === 1
              ? hand
              : `${hand}${voiceIndex + 1}`
            : `V${staffIndex + 1}_${voiceIndex + 1}`,
          name: voice.name ?? staff.name,
          staffIndex,
          ...parseStaff(expanded, staffIndex, diagnostics, {
            pitchLanguage: inspection.pitchLanguage,
          }),
        };
      });
      const referenceDuration = converted[0]?.duration;
      if (
        referenceDuration &&
        converted.some(
          (voice) => compareFraction(voice.duration, referenceDuration) !== 0,
        )
      )
        diagnostics.push(
          diagnostic(
            "error",
            "staff-voice-duration-mismatch",
            `Staff ${staff.name ?? staffIndex + 1} contains voices with different total durations`,
          ),
        );
      return converted;
    });
    if (convertedStaves.some((staff) => staff.events === 0))
      throw new Error(
        `Score ${scoreIndex + 1} contains an empty converted Staff`,
      );
    if (convertedStaves.length > 12)
      throw new Error(`Score ${scoreIndex + 1} exceeds the twelve-voice limit`);
    const tuneDuration = convertedStaves[0]?.duration;
    if (
      tuneDuration &&
      convertedStaves.some(
        (voice) => compareFraction(voice.duration, tuneDuration) !== 0,
      )
    )
      diagnostics.push(
        diagnostic(
          "error",
          "score-voice-duration-mismatch",
          `Score ${scoreIndex + 1} contains voices with different total durations`,
        ),
      );

    const primary = convertedStaves[0];
    const baseTitle = safeMetadata(
      options.title ?? header.title ?? header.mutopiatitle,
      "Untitled LilyPond import",
    );
    const piece = safeMetadata(header.piece, "");
    const titleBase =
      piece && !baseTitle.toLowerCase().includes(piece.toLowerCase())
        ? `${baseTitle} – ${piece}`
        : baseTitle;
    const title =
      scoreBlocks.length > 1
        ? `${titleBase} – Teil ${scoreIndex + 1}`
        : titleBase;
    const composer = safeMetadata(
      header.composer ?? header.mutopiacomposer,
      "Unknown composer",
    );
    const opus = safeMetadata(header.opus ?? header.mutopiaopus, "");
    const lines = [
      `X:${scoreIndex + 1}`,
      `T:${title}`,
      `C:${composer}`,
      ...(opus ? [`N:${opus}`] : []),
      `M:${primary.meter}`,
      "L:1/64",
      `Q:1/4=${primary.tempo}`,
      `K:${primary.key}`,
      ...convertedStaves.map((staff) => `V:${staff.id} clef=${staff.clef}`),
      ...convertedStaves.map((staff) => `[V:${staff.id}] ${staff.abc}`),
    ];
    return {
      index: scoreIndex + 1,
      abc: lines.join("\n"),
      staves: convertedStaves,
    };
  });

  return {
    abc: tunes.map((tune) => tune.abc).join("\n\n"),
    report: {
      format: "fnf-ly2abc-report",
      version: 1,
      source: {
        lilypondVersion: inspection.version ?? null,
        tokenCount: inspection.tokenCount,
        assignmentCount: inspection.assignmentCount,
        scoreCount: inspection.scoreCount,
        schemeCount: inspection.schemeCount,
        includes: inspection.includes,
      },
      tunes: tunes.map((tune) => ({
        index: tune.index,
        eventCount: tune.staves.reduce((sum, staff) => sum + staff.events, 0),
        staves: tune.staves.map((staff) => ({
          id: staff.id,
          sourceName: staff.name ?? null,
          clef: staff.clef,
          key: staff.key,
          meter: staff.meter,
          tempo: staff.tempo,
          events: staff.events,
          notes: staff.notes,
          rests: staff.rests,
          chords: staff.chords,
          duration64: `${staff.duration.num}/${staff.duration.den}`,
          staffChanges: staff.staffChanges,
          ignoredCommands: staff.ignoredCommands,
        })),
      })),
      diagnostics,
      complete: diagnostics.length === 0,
      safeToUse: !diagnostics.some(({ severity }) => severity === "error"),
    },
  };
}

export { limits as ly2abcLimits };
