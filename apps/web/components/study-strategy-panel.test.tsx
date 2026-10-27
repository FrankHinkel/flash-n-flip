// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { defaultStudyStrategy } from "@flashcards/domain";
import { translateUiMessage } from "@flashcards/i18n";
const mocks = vi.hoisted(() => ({
  plans: vi.fn(),
  save: vi.fn(),
  active: vi.fn(),
}));
vi.mock("../lib/local-product-repository", () => ({
  listLocalNamedStudyPlans: mocks.plans,
  updateLocalNamedStudyPlanStrategy: mocks.save,
  setActiveLocalNamedStudyPlan: mocks.active,
}));
vi.mock("./i18n-provider", () => ({
  useI18n: () => ({
    locale: "en",
    text: (
      key: Parameters<typeof translateUiMessage>[1],
      values: Parameters<typeof translateUiMessage>[2],
    ) => translateUiMessage("en", key, values),
  }),
}));
import { StudyStrategyPanel } from "./study-strategy-panel";
const strategy = {
  ...defaultStudyStrategy(),
  maximumReviewStreak: 17,
  problemCardLimit: 9,
  paceTolerancePercent: 25,
};
const summary = {
  planId: "p",
  planTitle: "Plan",
  strategy,
  total: 3,
  estimatedMinutes: 2,
  paceContext: {
    introducedInWindow: 0,
    observedCalendarDays: 1,
    fallbackDailyGoal: 10,
  },
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.plans.mockResolvedValue({ plans: [{ id: "p", title: "Plan" }] });
  mocks.save.mockResolvedValue(undefined);
});
afterEach(cleanup);
it("hides advanced presets and false pace claims while keeping amount easy to find", async () => {
  render(<StudyStrategyPanel summary={summary as never} onSaved={() => {}} />);
  await act(async () => {});
  expect(screen.queryByRole("combobox", { name: "Learning plan" })).toBeNull();
  expect(screen.queryByRole("meter")).toBeNull();
  fireEvent.click(screen.getByText("Change study amount"));
  expect(
    screen.getByRole("spinbutton", { name: "Minutes per study day" }),
  ).toBeDefined();
  expect(
    screen.getByRole("button", { name: "Exam" }).closest("details")?.open,
  ).toBe(false);
});
it("changes the requested amount without resetting hidden scheduling preferences", async () => {
  render(<StudyStrategyPanel summary={summary as never} onSaved={() => {}} />);
  await act(async () => {});
  fireEvent.click(screen.getByText("Change study amount"));
  fireEvent.change(
    screen.getByRole("spinbutton", { name: "Minutes per study day" }),
    { target: { value: "15" } },
  );
  fireEvent.click(screen.getByRole("button", { name: "Save strategy" }));
  await act(async () => {});
  expect(mocks.save).toHaveBeenCalledExactlyOnceWith("p", {
    ...strategy,
    minutesPerDay: 15,
  });
});
it("retains edits and reports failure instead of announcing a successful save", async () => {
  mocks.save.mockRejectedValue(new Error("storage unavailable"));
  render(<StudyStrategyPanel summary={summary as never} onSaved={() => {}} />);
  await act(async () => {});
  fireEvent.click(screen.getByText("Change study amount"));
  fireEvent.change(
    screen.getByRole("spinbutton", { name: "Minutes per study day" }),
    { target: { value: "15" } },
  );
  fireEvent.click(screen.getByRole("button", { name: "Save strategy" }));
  await act(async () => {});
  expect(screen.getByRole("alert").textContent).toMatch(/Not saved yet/);
  expect(
    (
      screen.getByRole("spinbutton", {
        name: "Minutes per study day",
      }) as HTMLInputElement
    ).value,
  ).toBe("15");
});
