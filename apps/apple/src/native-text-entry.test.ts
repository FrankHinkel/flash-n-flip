import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

const source = readFileSync(
  new URL("../ios/App/App/SceneDelegate.swift", import.meta.url),
  "utf8",
);
const script = source.match(
  /private static let textEntryBridgeScript = """\n([\s\S]*?)\n    """/,
)![1]!;

function fixture() {
  const fields: ReturnType<typeof field>[] = [];
  const frames: FrameRequestCallback[] = [];
  const postMessage = vi.fn();
  let mutation = () => {};
  let options: MutationObserverInit | undefined;
  const document = Object.assign(new EventTarget(), {
    querySelectorAll(selector: string) {
      return fields.filter((element) =>
        selector.split(",").includes(element.selector),
      );
    },
  });
  const window = Object.assign(new EventTarget(), {
    webkit: { messageHandlers: { flashNFlipTextEntry: { postMessage } } },
  });
  const context = {
    document,
    window,
    requestAnimationFrame: (callback: FrameRequestCallback) =>
      frames.push(callback),
    getComputedStyle: (element: ReturnType<typeof field>) => element.style,
    MutationObserver: class {
      constructor(callback: () => void) {
        mutation = callback;
      }
      observe(_target: unknown, nextOptions: MutationObserverInit) {
        options = nextOptions;
      }
    },
  };
  runInNewContext(script, context);
  const flush = () => frames.splice(0).forEach((callback) => callback(0));
  flush();
  return {
    fields,
    frames,
    postMessage,
    document,
    window,
    flush,
    mutate() {
      mutation();
      flush();
    },
    reinstall() {
      runInNewContext(script, context);
      flush();
    },
    get options() {
      return options;
    },
  };
}

function field(selector = 'input[type="text"]') {
  return {
    selector,
    disabled: false,
    readonly: false,
    inert: false,
    width: 200,
    height: 44,
    style: { display: "block", visibility: "visible" },
    getBoundingClientRect() {
      return { width: this.width, height: this.height };
    },
    matches() {
      return this.disabled || this.readonly;
    },
    closest() {
      return this.inert ? {} : null;
    },
  };
}

describe("native WebKit text-input session", () => {
  it("allows Mac card selection independently of visible input fields", () => {
    expect(source).toMatch(
      /isTextInteractionEnabled =\s*ProcessInfo\.processInfo\.isiOSAppOnMac \|\| enabled/,
    );
    expect(source).toMatch(
      /isTextInteractionEnabled =\s*ProcessInfo\.processInfo\.isiOSAppOnMac\s*webView\.inputAssistantItem/,
    );
  });

  it("registers a write-only native clipboard and completes writes on the main queue", () => {
    expect(source).toContain(
      "bridge?.registerPluginInstance(FlashNFlipClipboardPlugin())",
    );
    expect(source).toContain('let jsName = "FlashNFlipClipboard"');
    expect(source).toMatch(
      /DispatchQueue\.main\.async \{\s*UIPasteboard\.general\.string = text\s*call\.resolve\(\)/,
    );
    expect(source).not.toContain("= UIPasteboard.general.string");
  });

  it("keeps non-editable study content out of a keyboard session", () => {
    const app = fixture();
    expect(app.postMessage.mock.calls).toEqual([[false]]);
    app.document.dispatchEvent(new Event("click"));
    app.document.dispatchEvent(new Event("focusin"));
    app.flush();
    expect(app.postMessage).toHaveBeenCalledTimes(1);
  });

  it.each([
    "input:not([type])",
    'input[type="text"]',
    'input[type="search"]',
    'input[type="number"]',
    'input[type="email"]',
    'input[type="password"]',
    "select",
    "textarea",
    '[contenteditable="true"]',
    '[contenteditable="plaintext-only"]',
  ])(
    "enables real %s controls and ends the session when the form closes",
    (selector) => {
      const app = fixture();
      app.fields.push(field(selector));
      app.mutate();
      expect(app.postMessage).toHaveBeenLastCalledWith(true);
      app.fields.pop();
      app.mutate();
      expect(app.postMessage.mock.calls).toEqual([[false], [true], [false]]);
    },
  );

  it.each([
    "disabled",
    "readonly",
    "inert",
    "zero-size",
    "display-none",
    "hidden",
  ])("ignores a %s field and detects when it becomes editable", (state) => {
    const app = fixture();
    const input = field();
    if (state === "disabled") input.disabled = true;
    if (state === "readonly") input.readonly = true;
    if (state === "inert") input.inert = true;
    if (state === "zero-size") input.height = 0;
    if (state === "display-none") input.style.display = "none";
    if (state === "hidden") input.style.visibility = "hidden";
    app.fields.push(input);
    app.mutate();
    expect(app.postMessage).toHaveBeenCalledTimes(1);
    Object.assign(input, field());
    app.mutate();
    expect(app.postMessage).toHaveBeenLastCalledWith(true);
  });

  it("coalesces changes, observes field visibility and does not duplicate listeners on reinjection", () => {
    const app = fixture();
    expect(app.options?.attributes).toBe(true);
    expect(app.options?.attributeFilter).toEqual(
      expect.arrayContaining([
        "hidden",
        "disabled",
        "readonly",
        "style",
        "class",
      ]),
    );
    app.fields.push(field());
    app.document.dispatchEvent(new Event("click"));
    app.document.dispatchEvent(new Event("focusout"));
    app.window.dispatchEvent(new Event("resize"));
    expect(app.frames).toHaveLength(1);
    app.flush();
    app.reinstall();
    expect(app.postMessage.mock.calls).toEqual([[false], [true]]);
    app.fields[0]!.style.display = "none";
    app.document.dispatchEvent(new Event("transitionend"));
    app.flush();
    expect(app.postMessage).toHaveBeenLastCalledWith(false);
  });
});
