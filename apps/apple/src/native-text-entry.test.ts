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

function fixture(mac = true) {
  const fields: ReturnType<typeof field>[] = [];
  const frames: FrameRequestCallback[] = [];
  const postMessage = vi.fn();
  let mutation = () => {};
  let options: MutationObserverInit | undefined;
  const document = Object.assign(new EventTarget(), {
    documentElement: {
      dataset: { appleInterfacePlatform: mac ? "mac" : undefined },
    },
    activeElement: null as ReturnType<typeof field> | null,
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
    hasFocusedTextEntry() {
      return runInNewContext(
        "window.__flashNFlipHasFocusedTextEntry()",
        context,
      ) as boolean;
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
    matches(selector: string) {
      return selector === ":disabled, [readonly]"
        ? this.disabled || this.readonly
        : selector.split(",").includes(this.selector);
    },
    closest() {
      return this.inert ? {} : null;
    },
  };
}

describe("native WebKit text-input session", () => {
  it("distinguishes real focused editors from read-only graph/selection focus", () => {
    const app = fixture();
    expect(app.hasFocusedTextEntry()).toBe(false);
    app.document.activeElement = field("svg");
    expect(app.hasFocusedTextEntry()).toBe(false);
    const input = field();
    app.document.activeElement = input;
    expect(app.hasFocusedTextEntry()).toBe(true);
    input.readonly = true;
    expect(app.hasFocusedTextEntry()).toBe(false);
    input.readonly = false;
    input.style.display = "none";
    expect(app.hasFocusedTextEntry()).toBe(false);
  });

  it("notifies a focus-only change even while the search field remains visible", () => {
    const app = fixture();
    const input = field();
    app.fields.push(input);
    app.mutate();
    app.document.activeElement = input;
    app.document.dispatchEvent(new Event("focusin"));
    expect(app.postMessage).toHaveBeenCalledTimes(3);
    app.flush();
    app.document.activeElement = null;
    app.document.dispatchEvent(new Event("focusout"));
    app.flush();
    expect(app.postMessage.mock.calls).toEqual([
      [false],
      [true],
      [true],
      [true],
    ]);
  });

  it("keeps iPhone/iPad focus changes coalesced without additional native input-state messages", () => {
    const app = fixture(false);
    const input = field();
    app.fields.push(input);
    app.mutate();
    app.document.activeElement = input;
    app.document.dispatchEvent(new Event("focusin"));
    expect(app.frames).toHaveLength(1);
    app.flush();
    expect(app.postMessage.mock.calls).toEqual([[false], [true]]);
  });

  it("cleans up reopened Mac input sessions without blurring the DOM selection", () => {
    expect(source).toContain("name: UIResponder.keyboardDidShowNotification");
    expect(source).toContain(
      "name: UIResponder.keyboardDidChangeFrameNotification",
    );
    const cleanup = source
      .split("@objc private func macKeyboardDidShow")[1]!
      .split("@objc private func copyMacSelection")[0]!;
    expect(cleanup).toContain("ProcessInfo.processInfo.isiOSAppOnMac");
    expect(cleanup).toContain(
      "window.__flashNFlipHasFocusedTextEntry?.() ?? true",
    );
    expect(cleanup).toContain("webView.endEditing(true)");
    expect(cleanup).toContain("self.becomeFirstResponder()");
    expect(cleanup).toContain("!macKeyboardCleanupPending");
    expect(cleanup).toContain("generation == self.textEntryGeneration");
    expect(cleanup).toContain("containsFirstResponder(webView)");
    expect(cleanup).toContain("presentedViewController == nil");
    expect(cleanup).toContain("isKeyWindow == true");
    expect(cleanup).not.toContain(".blur");
    expect(source).toContain("NotificationCenter.default.removeObserver(self");
  });

  it("keeps Mac read-only Cmd+C write-only and does not overwrite the clipboard for an empty selection", () => {
    const copy = source
      .split("@objc private func copyMacSelection")[1]!
      .split("@objc private func handleMacKeyCommand")[0]!;
    expect(copy).toContain("isFirstResponder");
    expect(copy).toContain("window.getSelection()?.toString() ?? ''");
    expect(copy).toContain("!text.isEmpty");
    expect(copy).toContain("UIPasteboard.general.string = text");
    expect(copy).not.toContain("= UIPasteboard.general.string");
  });
  it("uses the custom WebView through Capacitor's supported factory", () => {
    expect(source).toMatch(
      /override func webView\(with frame: CGRect, configuration: WKWebViewConfiguration\) -> WKWebView \{\s*FlashNFlipWebView\(frame: frame, configuration: configuration\)/,
    );
  });

  it("removes only the Mac accessory and preserves system keyboard and iPhone/iPad input views", () => {
    expect(source).not.toContain("override var inputView:");
    expect(source).toMatch(
      /override var inputAccessoryView: UIView\? \{\s*ProcessInfo\.processInfo\.isiOSAppOnMac \? nil : super\.inputAccessoryView/,
    );
    expect(source).not.toContain("NSClassFromString");
    expect(source).not.toContain("object_setClass");
    expect(source).not.toContain("method_exchangeImplementations");
  });

  it("prevents Capacitor from restarting the Mac input session on appearance", () => {
    expect(source).toMatch(
      /override func instanceDescriptor\(\) -> InstanceDescriptor \{\s*let descriptor = super\.instanceDescriptor\(\)\s*if ProcessInfo\.processInfo\.isiOSAppOnMac \{[\s\S]*?descriptor\.hasInitialFocus = false\s*\}\s*return descriptor/,
    );
  });

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
