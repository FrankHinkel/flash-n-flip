import {
  parseJsxGraphSource,
  type JsxGraphBlock,
  type JsxGraphExpression,
  type JsxGraphProgram,
} from "@flashcards/domain/jsx-graph";

type JxgModule = typeof import("jsxgraph");
type JxgNamespace = typeof JXG;
type Board = JXG.Board;
type Element = JXG.GeometryElement & Record<string, unknown>;

type RuntimeValue = number | string | boolean | Element | RuntimeFunction;
type RuntimeFunction = (...args: number[]) => number;
type Binding =
  | { kind: "element"; value: Element }
  | { kind: "value"; get: () => RuntimeValue }
  | {
      kind: "function";
      parameters: string[];
      expression: JsxGraphExpression;
    };

type Runtime = {
  board: Board;
  jxg: JxgNamespace;
  program: JsxGraphProgram;
  bindings: Map<string, Binding>;
  sliderIndex: number;
};

const colorTokens: Readonly<Record<string, string>> = {
  black: "#10182b",
  blue: "#315fac",
  bright: "#f5f7ff",
  dark: "#18212f",
  green: "#377759",
  orange: "#a05a16",
  purple: "#7357a8",
  red: "#a3283d",
  white: "#ffffff",
  yellow: "#d6ad32",
};

const finite = (value: unknown): number => {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    Math.abs(value) > 1e12
  ) {
    throw new Error("JSXGraph expression produced an unsafe number");
  }
  return value;
};

const boolean = (value: RuntimeValue): boolean =>
  typeof value === "boolean" ? value : Boolean(value);

function elementValue(element: Element, property: string): number {
  const methodNames: Readonly<Record<string, string[]>> = {
    angle: ["Value"],
    area: ["Area", "Value"],
    length: ["L", "Value"],
    perimeter: ["Perimeter"],
    radius: ["Radius", "getRadius"],
    slope: ["Slope", "getSlope"],
    value: ["Value"],
    x: ["X"],
    y: ["Y"],
  };
  for (const name of methodNames[property] ?? []) {
    const method = element[name];
    if (typeof method === "function") return finite(method.call(element));
  }
  if (property === "perimeter") {
    const borders = element.borders;
    if (Array.isArray(borders)) {
      return borders.reduce((sum, border) => {
        const length = (border as Element).L;
        return (
          sum + (typeof length === "function" ? finite(length.call(border)) : 0)
        );
      }, 0);
    }
  }
  throw new Error(`JSXGraph element does not expose ${property}`);
}

function numericIntegral(
  fn: RuntimeFunction,
  start: number,
  end: number,
): number {
  const intervals = 160;
  const width = (end - start) / intervals;
  let sum = fn(start) + fn(end);
  for (let index = 1; index < intervals; index += 1) {
    sum += fn(start + index * width) * (index % 2 === 0 ? 2 : 4);
  }
  return finite((sum * width) / 3);
}

function evaluate(
  expression: JsxGraphExpression,
  runtime: Runtime,
  locals: Readonly<Record<string, RuntimeValue>> = {},
): RuntimeValue {
  if (expression.kind === "number" || expression.kind === "string")
    return expression.value;
  if (expression.kind === "identifier") {
    if (expression.name === "pi") return Math.PI;
    if (expression.name === "e") return Math.E;
    if (expression.name === "true") return true;
    if (expression.name === "false") return false;
    if (expression.name in locals) return locals[expression.name]!;
    if (expression.name in colorTokens) return expression.name;
    const binding = runtime.bindings.get(expression.name);
    if (!binding) throw new Error(`Unknown JSXGraph value ${expression.name}`);
    if (binding.kind === "element") {
      const value = binding.value.Value;
      return typeof value === "function" && binding.value.elType === "slider"
        ? finite(value.call(binding.value))
        : binding.value;
    }
    if (binding.kind === "value") return binding.get();
    return (...values: number[]) =>
      finite(
        evaluate(binding.expression, runtime, {
          ...locals,
          ...Object.fromEntries(
            binding.parameters.map((parameter, index) => [
              parameter,
              values[index] ?? 0,
            ]),
          ),
        }),
      );
  }
  if (expression.kind === "member") {
    const object = evaluate(expression.object, runtime, locals);
    if (typeof object !== "object" || object === null) {
      throw new Error("JSXGraph properties require a geometry element");
    }
    return elementValue(object as Element, expression.property);
  }
  if (expression.kind === "unary") {
    const value = evaluate(expression.argument, runtime, locals);
    if (expression.operator === "!") return !boolean(value);
    const number = finite(value);
    return expression.operator === "-" ? -number : number;
  }
  if (expression.kind === "binary") {
    if (expression.operator === "and") {
      return (
        boolean(evaluate(expression.left, runtime, locals)) &&
        boolean(evaluate(expression.right, runtime, locals))
      );
    }
    if (expression.operator === "or") {
      return (
        boolean(evaluate(expression.left, runtime, locals)) ||
        boolean(evaluate(expression.right, runtime, locals))
      );
    }
    const leftValue = evaluate(expression.left, runtime, locals);
    const rightValue = evaluate(expression.right, runtime, locals);
    if (expression.operator === "=") return leftValue === rightValue;
    if (expression.operator === "!=") return leftValue !== rightValue;
    const left = finite(leftValue);
    const right = finite(rightValue);
    if (expression.operator === "+") return finite(left + right);
    if (expression.operator === "-") return finite(left - right);
    if (expression.operator === "*") return finite(left * right);
    if (expression.operator === "/") return finite(left / right);
    if (expression.operator === "%") return finite(left % right);
    if (expression.operator === "^") return finite(left ** right);
    if (expression.operator === "<") return left < right;
    if (expression.operator === "<=") return left <= right;
    if (expression.operator === ">") return left > right;
    return left >= right;
  }

  const positional = expression.arguments.filter((argument) => !argument.name);
  if (expression.callee === "if") {
    const condition = evaluate(positional[0]!.value, runtime, locals);
    return evaluate(
      positional[boolean(condition) ? 1 : 2]!.value,
      runtime,
      locals,
    );
  }
  const values = positional.map((argument) =>
    evaluate(argument.value, runtime, locals),
  );
  const numeric = () => values.map(finite);
  const one = (fn: (value: number) => number) => finite(fn(finite(values[0])));
  const functions: Readonly<Record<string, (value: number) => number>> = {
    abs: Math.abs,
    acos: Math.acos,
    acosh: Math.acosh,
    asin: Math.asin,
    asinh: Math.asinh,
    atan: Math.atan,
    atanh: Math.atanh,
    ceil: Math.ceil,
    cos: Math.cos,
    cosh: Math.cosh,
    exp: Math.exp,
    floor: Math.floor,
    ln: Math.log,
    log10: Math.log10,
    round: Math.round,
    sign: Math.sign,
    sin: Math.sin,
    sinh: Math.sinh,
    sqrt: Math.sqrt,
    tan: Math.tan,
    tanh: Math.tanh,
  };
  if (functions[expression.callee]) return one(functions[expression.callee]!);
  if (expression.callee === "atan2")
    return finite(Math.atan2(...(numeric() as [number, number])));
  if (expression.callee === "pow")
    return finite(Math.pow(...(numeric() as [number, number])));
  if (expression.callee === "log") {
    const [value, base] = numeric();
    return base === undefined
      ? finite(Math.log(value!))
      : finite(Math.log(value!) / Math.log(base));
  }
  if (expression.callee === "min") return finite(Math.min(...numeric()));
  if (expression.callee === "max") return finite(Math.max(...numeric()));
  if (expression.callee === "clamp") {
    const [value, minimum, maximum] = numeric();
    return finite(Math.min(maximum!, Math.max(minimum!, value!)));
  }
  if (expression.callee === "derivative") {
    const fn = values[0];
    if (typeof fn !== "function")
      throw new Error("derivative requires a function");
    return (x: number) => {
      const step = Math.max(1e-5, Math.abs(x) * 1e-5);
      return finite((fn(x + step) - fn(x - step)) / (2 * step));
    };
  }
  if (expression.callee === "integral") {
    const fn = values[0];
    if (typeof fn !== "function")
      throw new Error("integral requires a function");
    if (values.length >= 3)
      return numericIntegral(fn, finite(values[1]), finite(values[2]));
    const start = values.length === 2 ? finite(values[1]) : 0;
    return (x: number) => numericIntegral(fn, start, x);
  }
  const binding = runtime.bindings.get(expression.callee);
  if (binding?.kind === "function") {
    return evaluate(
      binding.expression,
      runtime,
      Object.fromEntries(
        binding.parameters.map((parameter, index) => [
          parameter,
          values[index] ?? 0,
        ]),
      ),
    );
  }
  throw new Error(`Unsupported JSXGraph calculation ${expression.callee}`);
}

const positional = (call: Extract<JsxGraphExpression, { kind: "call" }>) =>
  call.arguments
    .filter((argument) => !argument.name)
    .map((argument) => argument.value);

const named = (
  call: Extract<JsxGraphExpression, { kind: "call" }>,
  name: string,
): JsxGraphExpression | undefined =>
  call.arguments.find((argument) => argument.name === name)?.value;

function staticValue(
  expression: JsxGraphExpression | undefined,
  runtime: Runtime,
  fallback: RuntimeValue,
): RuntimeValue {
  return expression ? evaluate(expression, runtime) : fallback;
}

function color(value: RuntimeValue): string {
  if (typeof value !== "string")
    throw new Error("JSXGraph colors must be named or quoted");
  if (colorTokens[value]) return colorTokens[value]!;
  if (/^#[0-9a-f]{3,4}(?:[0-9a-f]{3,4})?$/i.test(value)) return value;
  throw new Error("Unsupported JSXGraph color");
}

function attributes(
  call: Extract<JsxGraphExpression, { kind: "call" }>,
  runtime: Runtime,
  id?: string,
): Record<string, unknown> {
  const drag = boolean(staticValue(named(call, "drag"), runtime, false));
  const stroke = color(staticValue(named(call, "color"), runtime, "blue"));
  const alpha = finite(staticValue(named(call, "alpha"), runtime, 1));
  const width = finite(staticValue(named(call, "width"), runtime, 2));
  const displayName = staticValue(named(call, "name"), runtime, id ?? "");
  return {
    name: typeof displayName === "string" ? displayName : (id ?? ""),
    fixed: !drag,
    frozen: false,
    strokeColor: stroke,
    fillColor: color(staticValue(named(call, "fill"), runtime, "blue")),
    strokeOpacity: Math.min(1, Math.max(0, alpha)),
    fillOpacity: Math.min(1, Math.max(0, alpha)),
    strokeWidth: Math.min(8, Math.max(1, width)),
    dash: boolean(staticValue(named(call, "dash"), runtime, false)) ? 2 : 0,
    visible: boolean(staticValue(named(call, "visible"), runtime, true)),
    withLabel: Boolean(displayName),
    tabIndex: drag ? 0 : -1,
    aria: {
      enabled: true,
      label:
        typeof displayName === "string" && displayName
          ? displayName
          : (id ?? call.callee),
      live: drag ? "polite" : "off",
    },
    label: { display: "internal" },
    precision: { touch: 30, mouse: 5, pen: 8 },
  };
}

function element(runtime: Runtime, expression: JsxGraphExpression): Element {
  if (expression.kind !== "identifier")
    throw new Error("Geometry parents use named objects");
  const binding = runtime.bindings.get(expression.name);
  if (binding?.kind !== "element")
    throw new Error(`Unknown geometry object ${expression.name}`);
  return binding.value;
}

function dynamicNumber(
  runtime: Runtime,
  expression: JsxGraphExpression,
): () => number {
  return () => finite(evaluate(expression, runtime));
}

function createConstructor(
  runtime: Runtime,
  id: string,
  call: Extract<JsxGraphExpression, { kind: "call" }>,
): Element {
  const args = positional(call);
  const attr = attributes(call, runtime, id);
  if (call.callee === "point") {
    const drag = boolean(staticValue(named(call, "drag"), runtime, false));
    const parents = drag
      ? [
          finite(evaluate(args[0]!, runtime)),
          finite(evaluate(args[1]!, runtime)),
        ]
      : [dynamicNumber(runtime, args[0]!), dynamicNumber(runtime, args[1]!)];
    return runtime.board.create("point", parents, attr) as Element;
  }
  if (call.callee === "slider") {
    const [minimum, maximum] = args.map((argument) =>
      finite(evaluate(argument, runtime)),
    );
    const value = finite(staticValue(named(call, "value"), runtime, minimum!));
    const step = finite(
      staticValue(named(call, "step"), runtime, (maximum! - minimum!) / 100),
    );
    const [left, top, right, bottom] = runtime.board.getBoundingBox();
    const y = bottom + (runtime.sliderIndex + 0.65) * ((top - bottom) * 0.09);
    runtime.sliderIndex += 1;
    return runtime.board.create(
      "slider",
      [
        [left + (right - left) * 0.12, y],
        [left + (right - left) * 0.88, y],
        [minimum, value, maximum],
      ],
      { ...attr, fixed: false, snapWidth: step, tabIndex: 0, withLabel: true },
    ) as unknown as Element;
  }
  const refs = args.map((argument) => element(runtime, argument));
  const aliases: Readonly<Record<string, string>> = {
    circumcircle: "circumcircle",
    incircle: "incircle",
    ray: "line",
    regularPolygon: "regularpolygon",
  };
  if (call.callee === "circle" && named(call, "center")) {
    const center = element(runtime, named(call, "center")!);
    const through = named(call, "through");
    const radius = named(call, "radius");
    return runtime.board.create(
      "circle",
      [
        center,
        through ? element(runtime, through) : dynamicNumber(runtime, radius!),
      ],
      attr,
    ) as Element;
  }
  if (call.callee === "parallel" || call.callee === "perpendicular") {
    const base = named(call, "to") ?? args[0];
    const through = named(call, "through") ?? args[1];
    return runtime.board.create(
      call.callee,
      [element(runtime, base!), element(runtime, through!)],
      attr,
    ) as Element;
  }
  if (call.callee === "glider") {
    const target = refs[0]!;
    const x = finite(staticValue(named(call, "x"), runtime, 0));
    const y = finite(staticValue(named(call, "y"), runtime, 0));
    return runtime.board.create("glider", [x, y, target], {
      ...attr,
      fixed: false,
    }) as unknown as Element;
  }
  if (call.callee === "ray") {
    return runtime.board.create("line", refs, {
      ...attr,
      straightFirst: false,
      straightLast: true,
    }) as unknown as Element;
  }
  if (call.callee === "segment") {
    return runtime.board.create("segment", refs, {
      ...attr,
      straightFirst: false,
      straightLast: false,
    }) as unknown as Element;
  }
  return runtime.board.create(
    aliases[call.callee] ?? call.callee,
    refs,
    attr,
  ) as Element;
}

function functionFrom(
  runtime: Runtime,
  expression: JsxGraphExpression,
  variables: string[],
): (...values: number[]) => number {
  if (expression.kind === "identifier") {
    const resolved = evaluate(expression, runtime);
    if (typeof resolved === "function") return resolved;
  }
  return (...values: number[]) =>
    finite(
      evaluate(
        expression,
        runtime,
        Object.fromEntries(
          variables.map((variable, index) => [variable, values[index] ?? 0]),
        ),
      ),
    );
}

function createEffect(
  runtime: Runtime,
  call: Extract<JsxGraphExpression, { kind: "call" }>,
  id?: string,
): Element {
  const args = positional(call);
  const attr = attributes(call, runtime, id);
  const box = runtime.board.getBoundingBox();
  const from = finite(staticValue(named(call, "from"), runtime, box[0]));
  const to = finite(staticValue(named(call, "to"), runtime, box[2]));
  if (call.callee === "plot") {
    return runtime.board.create(
      "functiongraph",
      [functionFrom(runtime, args[0]!, ["x"]), from, to],
      attr,
    ) as Element;
  }
  if (call.callee === "parametric") {
    return runtime.board.create(
      "curve",
      [
        functionFrom(runtime, args[1]!, ["t"]),
        functionFrom(runtime, args[2]!, ["t"]),
        from,
        to,
      ],
      attr,
    ) as unknown as Element;
  }
  if (call.callee === "polar") {
    const radius = functionFrom(runtime, args[1]!, ["t"]);
    return runtime.board.create(
      "curve",
      [
        (t: number) => radius(t) * Math.cos(t),
        (t: number) => radius(t) * Math.sin(t),
        from,
        to,
      ],
      attr,
    ) as Element;
  }
  if (call.callee === "implicit") {
    return runtime.board.create(
      "implicitcurve",
      [functionFrom(runtime, args[0]!, ["x", "y"])],
      {
        ...attr,
        maxSteps: 8_000,
        resolutionOuter: 0.08,
        resolutionInner: 0.08,
      },
    ) as Element;
  }
  if (call.callee === "vectorfield" || call.callee === "slopefield") {
    const density = Math.min(
      25,
      Math.max(
        4,
        Math.trunc(finite(staticValue(named(call, "density"), runtime, 12))),
      ),
    );
    const xRange = [box[0], density, box[2]];
    const yRange = [box[3], density, box[1]];
    const parents =
      call.callee === "vectorfield"
        ? [
            [
              functionFrom(runtime, args[2]!, ["x", "y"]),
              functionFrom(runtime, args[3]!, ["x", "y"]),
            ],
            xRange,
            yRange,
          ]
        : [functionFrom(runtime, args[2]!, ["x", "y"]), xRange, yRange];
    return runtime.board.create(call.callee, parents, {
      ...attr,
      scale: 0.5,
    }) as Element;
  }
  if (call.callee === "riemann") {
    const rectangles = Math.min(
      100,
      Math.max(
        1,
        Math.trunc(finite(staticValue(named(call, "rectangles"), runtime, 12))),
      ),
    );
    return runtime.board.create(
      "riemannsum",
      [functionFrom(runtime, args[0]!, ["x"]), rectangles, "left", from, to],
      { ...attr, fillOpacity: 0.18 },
    ) as unknown as Element;
  }
  if (call.callee === "integralArea") {
    const graph = runtime.board.create(
      "functiongraph",
      [functionFrom(runtime, args[0]!, ["x"]), from, to],
      { ...attr, visible: false },
    );
    return runtime.board.create("integral", [[from, to], graph], {
      ...attr,
      fillOpacity: 0.18,
    }) as unknown as Element;
  }
  if (call.callee === "region") {
    const comparison = args[0];
    if (
      comparison?.kind !== "binary" ||
      ![">", ">=", "<", "<="].includes(comparison.operator)
    ) {
      throw new Error("region requires y >= f(x) or y <= f(x)");
    }
    const yOnLeft =
      comparison.left.kind === "identifier" && comparison.left.name === "y";
    const expression = yOnLeft ? comparison.right : comparison.left;
    const graph = runtime.board.create(
      "functiongraph",
      [functionFrom(runtime, expression, ["x"]), box[0], box[2]],
      attr,
    );
    return runtime.board.create("inequality", [graph], {
      ...attr,
      inverse: yOnLeft
        ? comparison.operator.startsWith("<")
        : comparison.operator.startsWith(">"),
      fillOpacity: 0.14,
    }) as unknown as Element;
  }
  if (call.callee === "label") {
    const x = finite(evaluate(args[0]!, runtime));
    const y = finite(evaluate(args[1]!, runtime));
    const text = evaluate(args[2]!, runtime);
    if (typeof text !== "string") throw new Error("label text must be quoted");
    return runtime.board.create("text", [x, y, text], {
      ...attr,
      display: "internal",
      parse: false,
      useMathJax: false,
    }) as unknown as Element;
  }
  throw new Error(`Unsupported drawing command ${call.callee}`);
}

function enforceInertRendererDom(container: HTMLElement): void {
  // JSXGraph creates one empty, hidden foreignObject as a renderer helper even
  // when every text element uses SVG. Flash-n-Flip never needs it.
  container
    .querySelectorAll("foreignObject")
    .forEach((element) => element.remove());
  if (container.querySelector("script, foreignObject, image, a")) {
    throw new Error("JSXGraph produced unsupported active SVG content");
  }
  for (const element of container.querySelectorAll("[href], [xlink\\:href]")) {
    const reference =
      element.getAttribute("href") ?? element.getAttribute("xlink:href") ?? "";
    if (reference && !reference.startsWith("#")) {
      throw new Error("JSXGraph produced an external SVG reference");
    }
  }
}

export type RenderedJsxGraph = {
  board: Board;
  reset: () => void;
  destroy: () => void;
};

export async function renderJsxGraph(
  container: HTMLElement,
  block: JsxGraphBlock,
  dark: boolean,
): Promise<RenderedJsxGraph> {
  const program = parseJsxGraphSource(block.source);
  const module = await import("jsxgraph");
  const jxg = ((module as JxgModule & { default?: JxgNamespace }).default ??
    module) as JxgNamespace;
  const temporary = {
    board: null as unknown as Board,
    jxg,
    program,
    bindings: new Map<string, Binding>(),
    sliderIndex: 0,
  } satisfies Runtime;
  const x = program.board.x.map((expression) =>
    finite(evaluate(expression, temporary)),
  );
  const y = program.board.y.map((expression) =>
    finite(evaluate(expression, temporary)),
  );
  const boardOptions = {
    boundingbox: [x[0]!, y[1]!, x[1]!, y[0]!],
    axis: program.board.axes,
    grid: program.board.grid,
    keepAspectRatio: program.board.aspect === 1,
    showCopyright: false,
    showNavigation: false,
    showInfobox: false,
    pan: { enabled: true, needTwoFingers: true, needShift: true },
    browserPan: true,
    zoom: { wheel: true, needShift: true, pinch: true, min: 0.2, max: 8 },
    keyboard: { enabled: true, dx: 24, dy: 24, panShift: true, panCtrl: false },
    registerEvents: true,
    renderer: "svg",
    resize: { enabled: true, throttle: 120 },
    takeSizeFromFile: false,
    maxBoundingBox: [-1e4, 1e4, 1e4, -1e4],
    defaultAxes: {
      x: {
        strokeColor: dark ? "#d7e1f7" : "#31415f",
        ticks: { strokeColor: dark ? "#d7e1f7" : "#31415f" },
      },
      y: {
        strokeColor: dark ? "#d7e1f7" : "#31415f",
        ticks: { strokeColor: dark ? "#d7e1f7" : "#31415f" },
      },
    },
  } as Partial<JXG.BoardAttributes> & Record<string, unknown>;
  const board = jxg.JSXGraph.initBoard(container, boardOptions);
  const runtime: Runtime = { ...temporary, board };
  try {
    for (const statement of program.statements) {
      if (statement.kind === "function") {
        runtime.bindings.set(statement.name, {
          kind: "function",
          parameters: statement.parameters,
          expression: statement.expression,
        });
      } else if (
        statement.kind === "assignment" &&
        !(
          statement.expression.kind === "call" &&
          (constructorsForRuntime.has(statement.expression.callee) ||
            effectsForRuntime.has(statement.expression.callee))
        )
      ) {
        runtime.bindings.set(statement.name, {
          kind: "value",
          get: () => evaluate(statement.expression, runtime),
        });
      }
    }
    for (const statement of program.statements) {
      if (
        statement.kind === "assignment" &&
        statement.expression.kind === "call"
      ) {
        const value = constructorsForRuntime.has(statement.expression.callee)
          ? createConstructor(runtime, statement.name, statement.expression)
          : effectsForRuntime.has(statement.expression.callee)
            ? createEffect(runtime, statement.expression, statement.name)
            : null;
        if (value)
          runtime.bindings.set(statement.name, { kind: "element", value });
      } else if (statement.kind === "effect") {
        if (constructorsForRuntime.has(statement.expression.callee)) {
          createConstructor(
            runtime,
            `jsxgraph-${statement.line}`,
            statement.expression,
          );
        } else {
          createEffect(runtime, statement.expression);
        }
      }
    }
    board.on("update", () => enforceInertRendererDom(container));
    board.fullUpdate();
    enforceInertRendererDom(container);
  } catch (error) {
    jxg.JSXGraph.freeBoard(board);
    throw error;
  }
  const initialBoundingBox: [number, number, number, number] = [
    x[0]!,
    y[1]!,
    x[1]!,
    y[0]!,
  ];
  return {
    board,
    reset: () => {
      board.setBoundingBox(initialBoundingBox, false);
      board.fullUpdate();
    },
    destroy: () => jxg.JSXGraph.freeBoard(board),
  };
}

const constructorsForRuntime = new Set([
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
]);

const effectsForRuntime = new Set([
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
