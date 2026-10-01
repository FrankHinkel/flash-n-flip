import assert from "node:assert/strict";
import test from "node:test";
import {
  inspectUiSource,
  inspectStaticProductLanguages,
  usesFlashcardsCatalog,
} from "./ui-i18n-policy.mjs";

test("limits the static product boundary to the actual Pianoforte route", () => {
  assert.equal(
    usesFlashcardsCatalog("apps/web/app/pianoforte/privacy/page.tsx"),
    false,
  );
  for (const file of [
    "apps/web/app/pianoforte-extra/page.tsx",
    "apps/web/components/pianoforte-player.tsx",
    "apps/web/app/app/page.tsx",
  ])
    assert.equal(usesFlashcardsCatalog(file), true);
});
test("still rejects untranslated Flash-n-Flip text and accessible labels", () => {
  const failures = inspectUiSource(
    "apps/web/components/example.tsx",
    '<button title="Hard coded" aria-label="Hard coded">Hard coded</button>',
  );
  assert.equal(failures.length, 3);
  assert.match(failures.join("\n"), /hard-coded visible text/);
  assert.match(failures.join("\n"), /hard-coded aria-label/);
});
test("accepts catalog text and rejects component-local two-language tuples", () => {
  assert.deepEqual(
    inspectUiSource(
      "apps/web/components/example.tsx",
      '<button aria-label={text("study.rating.good")}>{text("study.rating.good", [1])}</button>',
    ),
    [],
  );
  assert.match(
    inspectUiSource(
      "apps/web/components/example.tsx",
      'const label = text("Good", "Gut");',
    ).join("\n"),
    /component-local translation/,
  );
});
test("requires an explicit English language on the independent static site", () => {
  const path = "apps/web/app/pianoforte/layout.tsx";
  assert.equal(
    inspectStaticProductLanguages(
      path,
      "<div className={styles.site}>Content</div>",
    ).length,
    1,
  );
  assert.deepEqual(
    inspectStaticProductLanguages(
      path,
      '<div className={styles.site} lang="en">Content</div>',
    ),
    [],
  );
});
test("requires both labelled language sections for static support and privacy", () => {
  for (const path of [
    "apps/web/app/pianoforte/support/page.tsx",
    "apps/web/app/pianoforte/privacy/page.tsx",
  ]) {
    assert.equal(
      inspectStaticProductLanguages(
        path,
        '<section lang="en">English</section>',
      ).length,
      1,
    );
    assert.deepEqual(
      inspectStaticProductLanguages(
        path,
        '<section lang="en">English</section><section lang="de">Deutsch</section>',
      ),
      [],
    );
  }
});
