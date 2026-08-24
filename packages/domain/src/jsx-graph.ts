import { z } from "zod";

export const maximumJsxGraphSourceLength = 30_000;
export const maximumJsxGraphStatements = 250;
export const maximumJsxGraphObjects = 150;
export const maximumJsxGraphSliders = 24;

export type JsxGraphExpression =
  | { kind: "number"; value: number }
  | { kind: "string"; value: string }
  | { kind: "identifier"; name: string }
  | {
      kind: "member";
      object: JsxGraphExpression;
      property: string;
    }
  | {
      kind: "unary";
      operator: "+" | "-" | "!";
      argument: JsxGraphExpression;
    }
  | {
      kind: "binary";
      operator:
        | "+"
        | "-"
        | "*"
        | "/"
        | "%"
        | "^"
        | "<"
        | "<="
        | ">"
        | ">="
        | "="
        | "!="
        | "and"
        | "or";
      left: JsxGraphExpression;
      right: JsxGraphExpression;
    }
  | {
      kind: "call";
      callee: string;
      arguments: Array<{ name?: string; value: JsxGraphExpression }>;
    };

export type JsxGraphBoardStatement = {
  kind: "board";
  line: number;
  x: [JsxGraphExpression, JsxGraphExpression];
  y: [JsxGraphExpression, JsxGraphExpression];
  axes: boolean;
  grid: boolean;
  aspect: number | null;
  clearTraces: boolean;
};

export type JsxGraphStatement =
  | JsxGraphBoardStatement
  | {
      kind: "function";
      line: number;
      name: string;
      parameters: string[];
      expression: JsxGraphExpression;
    }
  | {
      kind: "assignment";
      line: number;
      name: string;
      expression: JsxGraphExpression;
    }
  | {
      kind: "effect";
      line: number;
      expression: Extract<JsxGraphExpression, { kind: "call" }>;
    };

export type JsxGraphProgram = {
  title: string | null;
  description: string;
  board: JsxGraphBoardStatement;
  statements: JsxGraphStatement[];
};

export type JsxGraphSourceMetrics = {
  lineCount: number;
  statementCount: number;
  objectCount: number;
  sliderCount: number;
  expressionNodeCount: number;
  program: JsxGraphProgram;
};

type Token = {
  type: "number" | "string" | "identifier" | "symbol" | "eof";
  value: string;
  offset: number;
};

const identifierPattern = /^[A-Za-z_][A-Za-z0-9_]*$/;
const unsafeSourcePattern =
  /(?:<\s*\/?\s*[a-z!]|\b(?:javascript|data|file|https?|fetch|import|export|eval|constructor|prototype|__proto__|window|document|globalThis|require|script|iframe|foreignObject|image|input|button|onclick|onload)\b|\/\/|\\\\)/i;

const constructors = new Set([
  "angle",
  "arc",
  "arrow",
  "bisector",
  "circle",
  "circumcircle",
  "ellipse",
  "glider",
  "hyperbola",
  "incircle",
  "intersection",
  "line",
  "midpoint",
  "normal",
  "parallel",
  "parabola",
  "perpendicular",
  "point",
  "polygon",
  "ray",
  "reflection",
  "regularPolygon",
  "sector",
  "segment",
  "slider",
  "tangent",
  "tracecurve",
]);

const effects = new Set([
  "implicit",
  "integralArea",
  "label",
  "parametric",
  "plot",
  "polar",
  "region",
  "riemann",
  "slopefield",
  "vectorfield",
]);

const mathFunctions = new Set([
  "abs",
  "acos",
  "acosh",
  "asin",
  "asinh",
  "atan",
  "atan2",
  "atanh",
  "ceil",
  "clamp",
  "cos",
  "cosh",
  "derivative",
  "exp",
  "floor",
  "if",
  "integral",
  "lagrange",
  "ln",
  "log",
  "log10",
  "max",
  "min",
  "pow",
  "round",
  "random",
  "sign",
  "sin",
  "sinh",
  "sqrt",
  "tan",
  "tanh",
]);

const literalIdentifiers = new Set([
  "auto",
  "black",
  "blue",
  "bright",
  "dark",
  "false",
  "green",
  "left",
  "orange",
  "pi",
  "purple",
  "red",
  "right",
  "true",
  "white",
  "yellow",
]);

const memberProperties = new Set([
  "angle",
  "area",
  "length",
  "perimeter",
  "radius",
  "slope",
  "value",
  "x",
  "y",
]);

const namedArguments = new Set([
  "alpha",
  "center",
  "color",
  "dash",
  "density",
  "drag",
  "fill",
  "fillOpacity",
  "face",
  "from",
  "name",
  "method",
  "radius",
  "rectangles",
  "size",
  "step",
  "strokeOpacity",
  "through",
  "to",
  "trace",
  "value",
  "visible",
  "width",
  "x",
  "y",
]);

const pointFaceNames = new Set([
  "circle",
  "cross",
  "diamond",
  "plus",
  "square",
  "triangleDown",
  "triangleLeft",
  "triangleRight",
  "triangleUp",
]);

const riemannMethodNames = new Set([
  "left",
  "lower",
  "middle",
  "right",
  "trapezoidal",
  "upper",
]);

function tokenizeExpression(source: string): Token[] {
  const tokens: Token[] = [];
  let offset = 0;
  while (offset < source.length) {
    const character = source[offset]!;
    if (/\s/u.test(character)) {
      offset += 1;
      continue;
    }
    if (character === '"') {
      const start = offset;
      offset += 1;
      let value = "";
      let closed = false;
      while (offset < source.length) {
        const next = source[offset]!;
        offset += 1;
        if (next === '"') {
          closed = true;
          break;
        }
        if (next === "\\") {
          const escaped = source[offset];
          offset += 1;
          if (escaped === "n") value += "\n";
          else if (escaped === "t") value += "\t";
          else if (escaped === '"' || escaped === "\\") value += escaped;
          else throw new Error(`Unsupported string escape at column ${offset}`);
        } else {
          value += next;
        }
      }
      if (!closed) throw new Error(`Unclosed string at column ${start + 1}`);
      tokens.push({ type: "string", value, offset: start });
      continue;
    }
    const number = source
      .slice(offset)
      .match(/^(?:\d+(?:\.(?!\.)\d*)?|\.\d+)(?:e[+-]?\d+)?/i);
    if (number) {
      tokens.push({ type: "number", value: number[0], offset });
      offset += number[0].length;
      continue;
    }
    const identifier = source.slice(offset).match(/^[A-Za-z_][A-Za-z0-9_]*/);
    if (identifier) {
      tokens.push({ type: "identifier", value: identifier[0], offset });
      offset += identifier[0].length;
      continue;
    }
    const pair = source.slice(offset, offset + 2);
    if (["<=", ">=", "!=", "==", "&&", "||", ".."].includes(pair)) {
      tokens.push({ type: "symbol", value: pair, offset });
      offset += 2;
      continue;
    }
    if ("+-*/%^<>=!(),.".includes(character)) {
      tokens.push({ type: "symbol", value: character, offset });
      offset += 1;
      continue;
    }
    throw new Error(`Unsupported character at column ${offset + 1}`);
  }
  tokens.push({ type: "eof", value: "", offset: source.length });
  return tokens;
}

class ExpressionParser {
  private index = 0;

  constructor(private readonly tokens: Token[]) {}

  parse(): JsxGraphExpression {
    const expression = this.parseBinary(0);
    const current = this.current();
    if (current.type !== "eof") {
      throw new Error(
        `Unexpected ${current.value} at column ${current.offset + 1}`,
      );
    }
    return expression;
  }

  private current(): Token {
    return this.tokens[this.index]!;
  }

  private next(): Token {
    const token = this.current();
    this.index += 1;
    return token;
  }

  private accept(value: string): boolean {
    if (this.current().value !== value) return false;
    this.index += 1;
    return true;
  }

  private expect(value: string): void {
    if (!this.accept(value)) {
      const token = this.current();
      throw new Error(`Expected ${value} at column ${token.offset + 1}`);
    }
  }

  private parseBinary(minimumPrecedence: number): JsxGraphExpression {
    let left = this.parseUnary();
    const precedences: Readonly<Record<string, number>> = {
      or: 1,
      "||": 1,
      and: 2,
      "&&": 2,
      "=": 3,
      "==": 3,
      "!=": 3,
      "<": 3,
      "<=": 3,
      ">": 3,
      ">=": 3,
      "+": 4,
      "-": 4,
      "*": 5,
      "/": 5,
      "%": 5,
      "^": 6,
    };
    while (true) {
      const token = this.current();
      const rawOperator =
        token.type === "identifier" && ["and", "or"].includes(token.value)
          ? token.value
          : token.value;
      const precedence = precedences[rawOperator];
      if (precedence === undefined || precedence < minimumPrecedence) break;
      this.next();
      const operator =
        rawOperator === "&&"
          ? "and"
          : rawOperator === "||"
            ? "or"
            : rawOperator === "=="
              ? "="
              : rawOperator;
      const right = this.parseBinary(precedence + (operator === "^" ? 0 : 1));
      left = {
        kind: "binary",
        operator: operator as Extract<
          JsxGraphExpression,
          { kind: "binary" }
        >["operator"],
        left,
        right,
      };
    }
    return left;
  }

  private parseUnary(): JsxGraphExpression {
    const token = this.current();
    if (["+", "-", "!"].includes(token.value) || token.value === "not") {
      this.next();
      return {
        kind: "unary",
        operator: (token.value === "not" ? "!" : token.value) as
          "+" | "-" | "!",
        argument: this.parseUnary(),
      };
    }
    return this.parsePostfix();
  }

  private parsePostfix(): JsxGraphExpression {
    let expression = this.parsePrimary();
    while (this.accept(".")) {
      const property = this.next();
      if (
        property.type !== "identifier" ||
        !memberProperties.has(property.value)
      ) {
        throw new Error(
          `Unsupported property at column ${property.offset + 1}`,
        );
      }
      expression = {
        kind: "member",
        object: expression,
        property: property.value,
      };
    }
    return expression;
  }

  private parsePrimary(): JsxGraphExpression {
    const token = this.next();
    if (token.type === "number") {
      const value = Number(token.value);
      if (!Number.isFinite(value) || Math.abs(value) > 1e12) {
        throw new Error(
          `Number is outside the safe range at column ${token.offset + 1}`,
        );
      }
      return { kind: "number", value };
    }
    if (token.type === "string") return { kind: "string", value: token.value };
    if (token.type === "identifier") {
      if (!this.accept("(")) return { kind: "identifier", name: token.value };
      const args: Array<{ name?: string; value: JsxGraphExpression }> = [];
      if (!this.accept(")")) {
        do {
          const current = this.current();
          const next = this.tokens[this.index + 1];
          if (current.type === "identifier" && next?.value === "=") {
            this.next();
            this.next();
            args.push({ name: current.value, value: this.parseBinary(0) });
          } else {
            args.push({ value: this.parseBinary(0) });
          }
        } while (this.accept(","));
        this.expect(")");
      }
      return { kind: "call", callee: token.value, arguments: args };
    }
    if (token.value === "(") {
      const expression = this.parseBinary(0);
      this.expect(")");
      return expression;
    }
    throw new Error(`Expected expression at column ${token.offset + 1}`);
  }
}

export function parseJsxGraphExpression(source: string): JsxGraphExpression {
  return new ExpressionParser(tokenizeExpression(source)).parse();
}

function stripComment(line: string): string {
  let quoted = false;
  let escaped = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index]!;
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === "\\" && quoted) {
      escaped = true;
      continue;
    }
    if (character === '"') quoted = !quoted;
    if (character === "#" && !quoted) return line.slice(0, index).trimEnd();
  }
  return line;
}

function parseQuotedDirective(line: string, name: string): string | null {
  const match = line.match(
    new RegExp(`^${name}\\s+("(?:[^"\\\\]|\\\\.)*")$`, "u"),
  );
  if (!match) return null;
  try {
    const value = JSON.parse(match[1]!) as unknown;
    return typeof value === "string" ? value.trim() : null;
  } catch {
    return null;
  }
}

function parseRange(
  value: string,
  line: number,
): [JsxGraphExpression, JsxGraphExpression] {
  const tokens = tokenizeExpression(value);
  let depth = 0;
  const range = tokens.findIndex((token) => {
    if (token.value === "(") depth += 1;
    else if (token.value === ")") depth -= 1;
    return token.value === ".." && depth === 0;
  });
  if (range <= 0 || range >= tokens.length - 2) {
    throw new Error(`Line ${line}: board ranges use lower..upper`);
  }
  const left = value.slice(0, tokens[range]!.offset);
  const right = value.slice(tokens[range]!.offset + 2);
  return [parseJsxGraphExpression(left), parseJsxGraphExpression(right)];
}

function parseBoard(lineValue: string, line: number): JsxGraphBoardStatement {
  const options = lineValue.trim().split(/\s+/u).filter(Boolean);
  let x: [JsxGraphExpression, JsxGraphExpression] = [
    { kind: "number", value: -5 },
    { kind: "number", value: 5 },
  ];
  let y: [JsxGraphExpression, JsxGraphExpression] = [
    { kind: "number", value: -5 },
    { kind: "number", value: 5 },
  ];
  let axes = false;
  let grid = false;
  let aspect: number | null = null;
  let clearTraces = false;
  for (const option of options) {
    if (option === "axes") axes = true;
    else if (option === "grid") grid = true;
    else if (option === "traces" || option === "cleartraces")
      clearTraces = true;
    else if (option.startsWith("x=")) x = parseRange(option.slice(2), line);
    else if (option.startsWith("y=")) y = parseRange(option.slice(2), line);
    else if (option.startsWith("aspect=")) {
      aspect = Number(option.slice(7));
      if (!Number.isFinite(aspect) || aspect < 0.1 || aspect > 10) {
        throw new Error(`Line ${line}: aspect must be between 0.1 and 10`);
      }
    } else {
      throw new Error(`Line ${line}: unsupported board option ${option}`);
    }
  }
  return { kind: "board", line, x, y, axes, grid, aspect, clearTraces };
}

function expressionNodes(expression: JsxGraphExpression): number {
  if (
    expression.kind === "number" ||
    expression.kind === "string" ||
    expression.kind === "identifier"
  )
    return 1;
  if (expression.kind === "member")
    return 1 + expressionNodes(expression.object);
  if (expression.kind === "unary")
    return 1 + expressionNodes(expression.argument);
  if (expression.kind === "binary")
    return (
      1 + expressionNodes(expression.left) + expressionNodes(expression.right)
    );
  return (
    1 +
    expression.arguments.reduce(
      (sum, argument) => sum + expressionNodes(argument.value),
      0,
    )
  );
}

function expressionDependencies(
  expression: JsxGraphExpression,
  result = new Set<string>(),
): Set<string> {
  if (expression.kind === "identifier") result.add(expression.name);
  else if (expression.kind === "member")
    expressionDependencies(expression.object, result);
  else if (expression.kind === "unary")
    expressionDependencies(expression.argument, result);
  else if (expression.kind === "binary") {
    expressionDependencies(expression.left, result);
    expressionDependencies(expression.right, result);
  } else if (expression.kind === "call") {
    result.add(expression.callee);
    expression.arguments.forEach((argument) =>
      expressionDependencies(argument.value, result),
    );
  }
  return result;
}

function validateExpression(
  expression: JsxGraphExpression,
  symbols: ReadonlySet<string>,
  parameters: ReadonlySet<string>,
  line: number,
): void {
  const visit = (value: JsxGraphExpression, depth: number) => {
    if (depth > 48)
      throw new Error(`Line ${line}: expression is too deeply nested`);
    if (value.kind === "identifier") {
      if (
        !symbols.has(value.name) &&
        !parameters.has(value.name) &&
        !literalIdentifiers.has(value.name)
      ) {
        throw new Error(`Line ${line}: unknown identifier ${value.name}`);
      }
      return;
    }
    if (value.kind === "member") {
      if (!memberProperties.has(value.property)) {
        throw new Error(`Line ${line}: unsupported property ${value.property}`);
      }
      visit(value.object, depth + 1);
      return;
    }
    if (value.kind === "unary") visit(value.argument, depth + 1);
    else if (value.kind === "binary") {
      visit(value.left, depth + 1);
      visit(value.right, depth + 1);
    } else if (value.kind === "call") {
      if (
        !mathFunctions.has(value.callee) &&
        !constructors.has(value.callee) &&
        !effects.has(value.callee) &&
        !symbols.has(value.callee)
      ) {
        throw new Error(`Line ${line}: unsupported function ${value.callee}`);
      }
      const names = value.arguments.flatMap((argument) =>
        argument.name ? [argument.name] : [],
      );
      if (names.some((name) => !namedArguments.has(name))) {
        throw new Error(`Line ${line}: unsupported named argument`);
      }
      if (new Set(names).size !== names.length) {
        throw new Error(`Line ${line}: named arguments must be unique`);
      }
      const positionalCount = value.arguments.filter(
        (argument) => !argument.name,
      ).length;
      if (value.callee === "random" && positionalCount !== 3) {
        throw new Error(`Line ${line}: random requires minimum, maximum, seed`);
      }
      if (
        value.callee === "lagrange" &&
        (positionalCount < 2 || positionalCount > 16)
      ) {
        throw new Error(`Line ${line}: lagrange requires 2 to 16 points`);
      }
      if (value.callee === "tracecurve" && positionalCount !== 2) {
        throw new Error(`Line ${line}: tracecurve requires two objects`);
      }
      const face = value.arguments.find(
        (argument) => argument.name === "face",
      )?.value;
      if (face && (face.kind !== "string" || !pointFaceNames.has(face.value))) {
        throw new Error(`Line ${line}: unsupported point face`);
      }
      const method = value.arguments.find(
        (argument) => argument.name === "method",
      )?.value;
      if (
        method &&
        (method.kind !== "string" || !riemannMethodNames.has(method.value))
      ) {
        throw new Error(`Line ${line}: unsupported Riemann method`);
      }
      value.arguments.forEach((argument) => visit(argument.value, depth + 1));
    }
  };
  visit(expression, 0);
}

export function parseJsxGraphSource(sourceValue: string): JsxGraphProgram {
  const source = sourceValue.replaceAll("\r\n", "\n").trim();
  if (!source || source.length > maximumJsxGraphSourceLength) {
    throw new Error("JSXGraph source must contain 1 to 30,000 characters");
  }
  if (/\r|[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(source)) {
    throw new Error("JSXGraph source contains unsupported control characters");
  }
  if (unsafeSourcePattern.test(source)) {
    throw new Error("JSXGraph source contains executable or external content");
  }
  if (/\b[A-Za-z_][A-Za-z0-9_]*3D\b/i.test(source)) {
    throw new Error("JSXGraph 3D objects are reserved for a later version");
  }
  const lines = source.split("\n");
  if (lines.length > 750 || lines.some((line) => line.length > 1_200)) {
    throw new Error("JSXGraph source is too large or has an oversized line");
  }

  let title: string | null = null;
  let description = "";
  let board: JsxGraphBoardStatement | null = null;
  const statements: JsxGraphStatement[] = [];
  for (const [index, rawLine] of lines.entries()) {
    const lineNumber = index + 1;
    const line = stripComment(rawLine).trim();
    if (!line) continue;
    if (line.startsWith("title ")) {
      const parsed = parseQuotedDirective(line, "title");
      if (!parsed || title !== null)
        throw new Error(`Line ${lineNumber}: invalid or duplicate title`);
      title = parsed;
      continue;
    }
    if (line.startsWith("describe ")) {
      const parsed = parseQuotedDirective(line, "describe");
      if (!parsed || description)
        throw new Error(`Line ${lineNumber}: invalid or duplicate description`);
      description = parsed;
      continue;
    }
    if (line === "board" || line.startsWith("board ")) {
      if (board)
        throw new Error(`Line ${lineNumber}: only one board is allowed`);
      board = parseBoard(line.slice(5), lineNumber);
      statements.push(board);
      continue;
    }
    const functionMatch = line.match(
      /^([A-Za-z_][A-Za-z0-9_]*)\s*\(([^()]*)\)\s*=\s*(.+)$/u,
    );
    if (functionMatch) {
      const parameters = functionMatch[2]!
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);
      if (
        parameters.length > 4 ||
        parameters.some((parameter) => !identifierPattern.test(parameter))
      ) {
        throw new Error(`Line ${lineNumber}: function parameters are invalid`);
      }
      statements.push({
        kind: "function",
        line: lineNumber,
        name: functionMatch[1]!,
        parameters,
        expression: parseJsxGraphExpression(functionMatch[3]!),
      });
      continue;
    }
    const assignmentMatch = line.match(
      /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/u,
    );
    if (assignmentMatch) {
      statements.push({
        kind: "assignment",
        line: lineNumber,
        name: assignmentMatch[1]!,
        expression: parseJsxGraphExpression(assignmentMatch[2]!),
      });
      continue;
    }
    const expression = parseJsxGraphExpression(line);
    if (
      expression.kind !== "call" ||
      (!effects.has(expression.callee) && !constructors.has(expression.callee))
    ) {
      throw new Error(
        `Line ${lineNumber}: expected an assignment or drawing command`,
      );
    }
    statements.push({ kind: "effect", line: lineNumber, expression });
  }

  if (!description)
    throw new Error(
      'JSXGraph source requires describe "..." for accessibility',
    );
  if (!board) board = parseBoard("x=-5..5 y=-5..5 axes", 0);
  if (statements.length > maximumJsxGraphStatements) {
    throw new Error(
      `JSXGraph source exceeds ${maximumJsxGraphStatements} statements`,
    );
  }
  const named = statements.filter(
    (
      statement,
    ): statement is Extract<
      JsxGraphStatement,
      { kind: "function" | "assignment" }
    > => statement.kind === "function" || statement.kind === "assignment",
  );
  const symbols = new Set(named.map(({ name }) => name));
  if (symbols.size !== named.length)
    throw new Error("JSXGraph identifiers must be unique");
  const objectCount = statements.filter(
    (statement) =>
      statement.kind === "effect" ||
      (statement.kind === "assignment" &&
        statement.expression.kind === "call" &&
        (constructors.has(statement.expression.callee) ||
          effects.has(statement.expression.callee))),
  ).length;
  const sliderCount = statements.filter(
    (statement) =>
      (statement.kind === "assignment" || statement.kind === "effect") &&
      statement.expression.kind === "call" &&
      statement.expression.callee === "slider",
  ).length;
  if (
    objectCount > maximumJsxGraphObjects ||
    sliderCount > maximumJsxGraphSliders
  ) {
    throw new Error("JSXGraph source exceeds its object or slider limits");
  }
  for (const statement of statements) {
    if (statement.kind === "board") {
      [...statement.x, ...statement.y].forEach((expression) =>
        validateExpression(expression, symbols, new Set(), statement.line),
      );
    } else if (statement.kind === "function") {
      validateExpression(
        expressionOrThrow(statement),
        symbols,
        new Set(statement.parameters),
        statement.line,
      );
    } else {
      validateExpression(
        statement.expression,
        symbols,
        new Set(["x", "y", "t"]),
        statement.line,
      );
    }
  }

  const dependencies = new Map<string, Set<string>>();
  for (const statement of named) {
    const ignored = new Set(
      statement.kind === "function" ? statement.parameters : [],
    );
    const deps = expressionDependencies(statement.expression);
    dependencies.set(
      statement.name,
      new Set(
        [...deps].filter(
          (dependency) => symbols.has(dependency) && !ignored.has(dependency),
        ),
      ),
    );
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (name: string) => {
    if (visiting.has(name))
      throw new Error(`JSXGraph dependency cycle contains ${name}`);
    if (visited.has(name)) return;
    visiting.add(name);
    dependencies.get(name)?.forEach(visit);
    visiting.delete(name);
    visited.add(name);
  };
  dependencies.forEach((_, name) => visit(name));
  return { title, description, board, statements };
}

function expressionOrThrow(
  statement: Extract<JsxGraphStatement, { kind: "function" }>,
): JsxGraphExpression {
  return statement.expression;
}

export function validateJsxGraphSource(source: string): JsxGraphSourceMetrics {
  const program = parseJsxGraphSource(source);
  const expressions: JsxGraphExpression[] = [];
  for (const statement of program.statements) {
    if (statement.kind === "board")
      expressions.push(...statement.x, ...statement.y);
    else expressions.push(statement.expression);
  }
  const expressionNodeCount = expressions.reduce(
    (sum, expression) => sum + expressionNodes(expression),
    0,
  );
  if (expressionNodeCount > 5_000)
    throw new Error("JSXGraph expressions exceed their complexity limit");
  return {
    lineCount: source.replaceAll("\r\n", "\n").split("\n").length,
    statementCount: program.statements.length,
    objectCount: program.statements.filter(
      (statement) =>
        statement.kind === "effect" ||
        (statement.kind === "assignment" &&
          statement.expression.kind === "call" &&
          (constructors.has(statement.expression.callee) ||
            effects.has(statement.expression.callee))),
    ).length,
    sliderCount: program.statements.filter(
      (statement) =>
        (statement.kind === "assignment" || statement.kind === "effect") &&
        statement.expression.kind === "call" &&
        statement.expression.callee === "slider",
    ).length,
    expressionNodeCount,
    program,
  };
}

export const jsxGraphBlockSchema = z
  .object({
    type: z.literal("jsxGraph"),
    version: z.literal(1),
    source: z.string().min(1).max(maximumJsxGraphSourceLength),
    label: z.string().trim().min(1).max(300),
    description: z.string().trim().min(1).max(5_000),
  })
  .strict()
  .superRefine((block, context) => {
    try {
      const program = parseJsxGraphSource(block.source);
      if (program.description !== block.description) {
        throw new Error(
          "Structured description must match the source description",
        );
      }
    } catch (error) {
      context.addIssue({
        code: "custom",
        path: ["source"],
        message:
          error instanceof Error ? error.message : "Invalid JSXGraph source",
      });
    }
  });

export type JsxGraphBlock = z.infer<typeof jsxGraphBlockSchema>;

export const jsxGraphExamples = {
  geometry: `title "Dynamisches Dreieck"
describe "Die Punkte A, B und C sind beweglich. Höhe, Lotfuß und Umkreis folgen der Konstruktion."

board x=-6..6 y=-5..5 axes grid aspect=1

A = point(-3, -1, drag=true)
B = point(3, -1, drag=true)
C = point(0, 3, drag=true)
triangle = polygon(A, B, C, fill=blue, alpha=0.12)
base = line(A, B)
height = perpendicular(base, C)
H = intersection(base, height)
k = circumcircle(A, B, C)
M = midpoint(A, B)`,
  function: `title "Sinusfunktion mit Parametern"
describe "Die Regler a, b und c verändern Amplitude, Verschiebung und Frequenz der Sinusfunktion."

board x=-7..7 y=-5..5 axes grid

a = slider(0, 4, value=1, step=0.1)
b = slider(-3, 3, value=0, step=0.1)
c = slider(0.2, 4, value=1, step=0.1)
f(x) = a * sin(c*x) + b
F = plot(f, color=blue)
G = plot(derivative(f), color=yellow, dash=true)
riemann(f, from=0, to=pi, rectangles=12, color=green)`,
  curves: `title "Kurven und Felder"
describe "Eine parametrische Lissajous-Kurve, eine implizite Kreisgleichung und ein Vektorfeld werden gemeinsam dargestellt."

board x=-4..4 y=-4..4 axes grid aspect=1

parametric(t, sin(3*t), sin(4*t), from=0, to=2*pi, color=blue)
implicit(x^2 + y^2 - 4, color=yellow)
vectorfield(x, y, -y, x, density=12, color=green)`,
  interpolation: `title "Interpolation und Integralspur"
describe "Drei bewegliche Punkte bestimmen ein Lagrange-Polynom. Der Gleiter steuert die Integralfläche und die Spur des Stammfunktionspunkts."

board x=-3..3 y=-3..10 axes traces

A = point(-2, random(5, 10, 11), drag=true, name="", size=2)
B = point(0, 2, drag=true, name="", size=2)
C = point(0.5, random(7, 8, 23), drag=true, name="", size=2)
f = lagrange(A, B, C)
P = plot(f, from=-3, to=3, name="", color=blue, width=3)
S = glider(P, x=0.25, y=f(0.25), name="ziehen", color=black, size=5)
integralArea(f, from=A.x, to=S.x, color=yellow, fillOpacity=0.2)
G(x) = integral(f, A.x, x)
F = point(S.x, G(S.x), name="F", trace=true, face="square", size=5)
T = tracecurve(S, F, name="", color=purple)`,
} as const;
