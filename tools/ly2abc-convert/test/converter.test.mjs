import assert from "node:assert/strict";
import test from "node:test";

import {
  convertLilypondSource,
  inspectLilypondSource,
  tokenizeLilypond,
} from "../src/converter.mjs";

const simplePiano = String.raw`
\version "2.24.4"
\header { title = "Miniatur" composer = "Test Composer" opus = "Op. 1" }
right = \relative c'' {
  \key c \major \time 4/4 \tempo 4 = 96
  c4 d e f | g2 <c, e g> |
}
left = \relative c {
  \clef bass \key c \major \time 4/4
  c2 g | c1 |
}
\score {
  \new PianoStaff <<
    \new Staff = "upper" \right
    \new Staff = "lower" \left
  >>
  \layout { }
}
`;

test("tokenizer removes comments and keeps Scheme inert", () => {
  const tokens = tokenizeLilypond(String.raw`% c4
    music = { c4 #(display "never") d4 } %{ e4 %}`);
  assert.equal(tokens.filter(({ kind }) => kind === "scheme").length, 1);
  assert.equal(
    tokens.some(({ value }) => value === "e4"),
    false,
  );
  assert.equal(
    tokens.some(({ value }) => value === "c4"),
    true,
  );
});

test("tokenizer keeps LilyPond Scheme strings from swallowing following music", () => {
  const tokens = tokenizeLilypond(
    String.raw`\set Staff.midiInstrument = #"acoustic grand" \score { \new Staff { c4 } }`,
  );
  assert.equal(
    tokens.some(({ kind, value }) => kind === "command" && value === "score"),
    true,
  );
  assert.equal(tokens.filter(({ kind }) => kind === "scheme").length, 1);
});

test("recognizes music variables wrapped in a Staff context", () => {
  const source = String.raw`
    melody = \context Staff \relative c' { c4 d e f }
    \score { \new PianoStaff << \new Staff \melody >> }
  `;
  const converted = convertLilypondSource(source);
  assert.equal(converted.report.tunes[0].eventCount, 4);
});

test("supports German h and b pitch names without reading deutsch.ly", () => {
  const source = String.raw`
    \include "deutsch.ly"
    melody = \relative c' { h4 b h b }
    \score { \new Staff \melody }
  `;
  const converted = convertLilypondSource(source);
  assert.match(converted.abc, /=B,16 _B,16 =B,16 _B,16/u);
  assert.equal(converted.report.source.includes, true);
});

test("inspects version, metadata, variables and score structure", () => {
  const inspection = inspectLilypondSource(simplePiano);
  assert.equal(inspection.version, "2.24.4");
  assert.equal(inspection.header.title, "Miniatur");
  assert.equal(inspection.assignmentCount, 2);
  assert.equal(inspection.scoreCount, 1);
  assert.deepEqual(inspection.staffCounts, [2]);
  assert.equal(inspection.schemeCount, 0);
});

test("uses a simple LilyPond markup piece to distinguish movements", () => {
  const source = String.raw`
    \header { title = "Sonata" piece = \markup { \bold "Allegretto" } }
    melody = { c'1 }
    \score { \new Staff \melody }
  `;
  const converted = convertLilypondSource(source);
  assert.match(converted.abc, /^T:Sonata – Allegretto$/mu);
});

test("converts named relative piano voices to an ABC tune", () => {
  const converted = convertLilypondSource(simplePiano);
  assert.match(converted.abc, /^X:1$/mu);
  assert.match(converted.abc, /^T:Miniatur$/mu);
  assert.match(converted.abc, /^C:Test Composer$/mu);
  assert.match(converted.abc, /^M:4\/4$/mu);
  assert.match(converted.abc, /^Q:1\/4=96$/mu);
  assert.match(converted.abc, /^V:RH clef=treble$/mu);
  assert.match(converted.abc, /^V:LH clef=bass$/mu);
  assert.match(converted.abc, /\[V:RH\].*=c16 =d16 =e16 =f16/u);
  assert.match(converted.abc, /\[=c=e=g\]32/u);
  assert.equal(converted.report.tunes[0].eventCount, 9);
  assert.equal(converted.report.complete, true);
});

test("supports repeat, alternatives, tuplets, grace notes and ties", () => {
  const source = String.raw`
    \header { title = "Structures" }
    melody = \relative c' {
      \key g \major \time 3/4
      \partial 4 d4
      \repeat volta 2 { g4 a b }
      \alternative { { c2~ c4 } { d2. } }
      \tuplet 3/2 { e8 fis g }
      \grace { a16 b } c4 r4
    }
    \score { \new Staff \melody }
  `;
  const converted = convertLilypondSource(source);
  assert.match(converted.abc, /\|:/u);
  assert.match(converted.abc, /:\|/u);
  assert.match(converted.abc, /\[1/u);
  assert.match(converted.abc, /\[2/u);
  assert.match(converted.abc, /\(3/u);
  assert.match(converted.abc, /\{/u);
  assert.match(converted.abc, /-/u);
});

test("supports LilyPond's single-note appoggiatura shorthand", () => {
  const source = String.raw`
    melody = \relative c' { \time 2/4 \appoggiatura b16 c4 d }
    \score { \new Staff \melody }
  `;
  const converted = convertLilypondSource(source);
  assert.match(converted.abc, /\{\s*=B,4\s*\}\s*=C16\s*=D16/u);
});

test("keeps named voices and inline simultaneous branches concurrent", () => {
  const source = String.raw`
    upperMain = \relative c' {
      \time 4/4 c1 | << { d2 e } \\ { g1 } >> | \change Staff = "lower" f1 |
    }
    upperSecond = \relative c' { g1 | a1 | b1 | }
    lower = \relative c { c1 | << { s1 | s1 } \\ { g1 | c1 | } >> }
    \score {
      \new PianoStaff <<
        \new Staff = "upper" <<
          \new Voice = "one" { \voiceOne \upperMain }
          \new Voice = "two" { \voiceTwo \upperSecond }
        >>
        \new Staff = "lower" \lower
      >>
    }
  `;
  const converted = convertLilypondSource(source);
  assert.match(converted.abc, /^V:RH1 clef=treble$/mu);
  assert.match(converted.abc, /^V:RH2 clef=treble$/mu);
  assert.match(converted.abc, /^V:LH clef=bass$/mu);
  assert.match(converted.abc, /\(& =D32 =E32 \| & =G,64 \| &\)/u);
  assert.equal(converted.report.tunes[0].staves[0].staffChanges, 1);
  assert.equal(converted.report.safeToUse, true);
  assert.equal(
    converted.report.diagnostics.some(({ code }) =>
      code.includes("simultaneous-voices-unsupported"),
    ),
    false,
  );
});

test("marks unequal audible simultaneous branches as unsafe", () => {
  const source = String.raw`
    melody = \relative c' { \time 4/4 << { c1 } \\ { e2 } >> }
    \score { \new Staff \melody }
  `;
  const converted = convertLilypondSource(source);
  assert.equal(converted.report.safeToUse, false);
  assert.ok(
    converted.report.diagnostics.some(
      ({ severity, code }) =>
        severity === "error" && code === "simultaneous-duration-mismatch",
    ),
  );
});

test("does not resolve includes or execute embedded Scheme", () => {
  const source = String.raw`
    \include "/private/does-not-exist.ily"
    #(system "touch /private/tmp/must-not-exist")
    music = \relative c' { c4 d e f }
    \score { \new Staff \music }
  `;
  const converted = convertLilypondSource(source);
  assert.equal(converted.report.source.includes, true);
  assert.equal(converted.report.source.schemeCount, 1);
  assert.ok(
    converted.report.diagnostics.some(({ code }) => code === "scheme-present"),
  );
  assert.ok(
    converted.report.diagnostics.some(({ code }) => code === "include-present"),
  );
  assert.equal(converted.report.complete, false);
});

test("sanitizes active-looking metadata and keeps it out of ABC markup", () => {
  const source = String.raw`
    \header { title = "<script onload=alert(1)>" composer = "javascript:evil" }
    melody = { c'4 d' e' f' }
    \score { \new Staff \melody }
  `;
  const converted = convertLilypondSource(source);
  assert.doesNotMatch(converted.abc, /[<>]/u);
  assert.doesNotMatch(converted.abc, /<script/iu);
  assert.doesNotMatch(converted.abc, /(?:javascript:|onload\s*=)/iu);
  assert.match(converted.abc, /^T:script alert\(1\)$/mu);
});

test("bounds unfolded repetitions before they can expand", () => {
  const source = String.raw`
    melody = { \repeat unfold 17 { c'4 } }
    \score { \new Staff \melody }
  `;
  assert.throws(() => convertLilypondSource(source), /limit of 16/u);
});

test("rejects recursive variables, oversized input and control characters", () => {
  assert.throws(
    () =>
      convertLilypondSource(String.raw`a = { \a } \score { \new Staff \a }`),
    /Recursive LilyPond variable/u,
  );
  assert.throws(() => tokenizeLilypond(`x\u0000y`), /control characters/u);
  assert.throws(() => tokenizeLilypond("x".repeat(1_048_577)), /1 MiB/u);
});
