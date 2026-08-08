import { describe, expect, it } from "vitest";

import type { Card } from "@flashcards/api-client";

import {
  cardOrderKeyboardDirection,
  dropLinkedCardGroup,
  isCardOrderChanged,
  moveLinkedCardGroup,
} from "./card-order";

const card = (id: string, linkedToPrevious = false): Card =>
  ({ id, linkedToPrevious }) as Card;

describe("card order", () => {
  it("maps the accessible row shortcuts to card moves", () => {
    expect(cardOrderKeyboardDirection("ArrowUp", true)).toBe(-1);
    expect(cardOrderKeyboardDirection("ArrowDown", true)).toBe(1);
    expect(cardOrderKeyboardDirection("ArrowDown", false)).toBeUndefined();
    expect(cardOrderKeyboardDirection("Enter", true)).toBeUndefined();
  });

  it("moves an individual card one group down", () => {
    expect(
      moveLinkedCardGroup([card("a"), card("b"), card("c")], "b", 1).map(
        ({ id }) => id,
      ),
    ).toEqual(["a", "c", "b"]);
  });

  it("moves linked cards together", () => {
    expect(
      moveLinkedCardGroup(
        [card("a"), card("explanation"), card("question", true), card("c")],
        "question",
        -1,
      ).map(({ id }) => id),
    ).toEqual(["explanation", "question", "a", "c"]);
  });

  it("drops an entire linked group at another group", () => {
    expect(
      dropLinkedCardGroup(
        [card("a"), card("b"), card("b-linked", true), card("c")],
        "b",
        "c",
      ).map(({ id }) => id),
    ).toEqual(["a", "c", "b", "b-linked"]);
  });

  it("does not change order when source and target share a group", () => {
    const cards = [card("a"), card("b", true), card("c")];
    expect(dropLinkedCardGroup(cards, "a", "b")).toEqual(cards);
    expect(isCardOrderChanged(cards, cards)).toBe(false);
  });
});
