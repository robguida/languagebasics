/* LanguageBasics — window.LBManifest: pure manifest helpers (LB-23).
 *
 * Vanilla JS, no build step, no fetch, no framework. Works on file://.
 *
 * One global: window.LBManifest. PURE, DOM-FREE logic (same convention as
 * game.js / progress.js / streak.js) so it is unit-testable in a node:vm sandbox
 * with Node built-ins only — NO jsdom, which would break the project's no-deps
 * rule. index.html imports these functions instead of hand-maintaining the
 * whitelist / default lesson / per-lesson counts, and (LB-23 commit 2) renders
 * the lesson picker from buildPickerModel() and gates the language <select> on
 * shouldShowLanguageDropdown().
 *
 * "manifest" here is the window.LB_LANGUAGES array (the language registry). Every
 * function normalizes its input so it accepts the array, a single language
 * object, or nothing (falls back to window.LB_LANGUAGES). All functions are
 * total: bad/missing input yields an empty-but-valid result, never a throw.
 *
 * LOOP RESILIENCE (Rob's global rule): every per-item loop below SKIPS a bad
 * entry (null, missing id, malformed group) and CONTINUES — one bad manifest row
 * never aborts the whole picker build.
 */
(function () {
  "use strict";

  /* Normalize whatever the caller passed into an array of language entries.
   *   - an array            -> used as-is
   *   - a single language   -> wrapped in [language]  (has a `groups` array)
   *   - undefined/null      -> window.LB_LANGUAGES, else []
   * Never throws. */
  function normalizeManifest(manifest) {
    if (Array.isArray(manifest)) return manifest;
    if (manifest && typeof manifest === "object" && Array.isArray(manifest.groups)) {
      return [manifest];
    }
    if (typeof window !== "undefined" && Array.isArray(window.LB_LANGUAGES)) {
      return window.LB_LANGUAGES;
    }
    return [];
  }

  /* getLanguages(manifest) -> the array of registered language entries. */
  function getLanguages(manifest) {
    return normalizeManifest(manifest);
  }

  /* shouldShowLanguageDropdown(manifest) -> true only when 2+ languages are
   * registered. At a single language the <select> stays hidden (there is nothing
   * to switch to). Pure; never throws. */
  function shouldShowLanguageDropdown(manifest) {
    return normalizeManifest(manifest).length >= 2;
  }

  /* getLanguage(manifest, code) -> the language entry whose code matches, or the
   * FIRST language when code is omitted/unknown, or null when none exist. */
  function getLanguage(manifest, code) {
    var langs = normalizeManifest(manifest);
    if (langs.length === 0) return null;
    if (code) {
      for (var i = 0; i < langs.length; i++) {
        var l = langs[i];
        if (l && typeof l === "object" && l.code === code) return l;
      }
    }
    return langs[0] || null;
  }

  /* buildLanguageOptions(manifest) -> [{ value: code, label: name }] for the
   * language <select>, skipping any malformed entry. Pure; never throws. */
  function buildLanguageOptions(manifest) {
    var langs = normalizeManifest(manifest);
    var out = [];
    for (var i = 0; i < langs.length; i++) {
      var l = langs[i];
      if (!l || typeof l !== "object" || !l.code) continue; // resilience: skip
      out.push({ value: String(l.code), label: String(l.name || l.code) });
    }
    return out;
  }

  /* buildPickerModel(manifest, activeCode) -> the render model for ONE language's
   * lesson picker:
   *   {
   *     languageCode: "sq",
   *     groups: [
   *       { label: "Numbers", options: [ { value, label, count, rollup }, ... ] },
   *       ...
   *     ]
   *   }
   * activeCode selects which language to build (defaults to the first). A group
   * with no valid options is dropped; a lesson with no id is skipped. The option
   * `value` is the lesson id / ?lesson= value, byte-for-byte. Pure; never throws. */
  function buildPickerModel(manifest, activeCode) {
    var lang = getLanguage(manifest, activeCode);
    if (!lang) return { languageCode: null, groups: [] };

    var groupsIn = Array.isArray(lang.groups) ? lang.groups : [];
    var groupsOut = [];
    for (var g = 0; g < groupsIn.length; g++) {
      var group = groupsIn[g];
      if (!group || typeof group !== "object") continue; // resilience: skip
      var lessonsIn = Array.isArray(group.lessons) ? group.lessons : [];
      var options = [];
      for (var i = 0; i < lessonsIn.length; i++) {
        var lesson = lessonsIn[i];
        // resilience: a null / id-less lesson is skipped, the group continues.
        if (!lesson || typeof lesson !== "object" || !lesson.id) continue;
        options.push({
          value: String(lesson.id),
          label: String(lesson.label != null ? lesson.label : lesson.id),
          count: (typeof lesson.count === "number") ? lesson.count : null,
          // Default-counted: only an explicit rollup:false excludes a deck.
          rollup: lesson.rollup !== false
        });
      }
      if (options.length === 0) continue; // no usable lessons -> drop the group
      groupsOut.push({ label: String(group.label != null ? group.label : ""), options: options });
    }
    return { languageCode: String(lang.code || ""), groups: groupsOut };
  }

  /* listLessons(manifest) -> a FLAT array of every lesson across every language
   * and group: [{ id, label, count, rollup, group, languageCode }]. The
   * whitelist / counts / rollup maps below are built from this. Skips bad
   * entries. Pure; never throws. */
  function listLessons(manifest) {
    var langs = normalizeManifest(manifest);
    var out = [];
    for (var a = 0; a < langs.length; a++) {
      var lang = langs[a];
      if (!lang || typeof lang !== "object") continue; // resilience: skip
      var code = String(lang.code || "");
      var groups = Array.isArray(lang.groups) ? lang.groups : [];
      for (var g = 0; g < groups.length; g++) {
        var group = groups[g];
        if (!group || typeof group !== "object") continue;
        var lessons = Array.isArray(group.lessons) ? group.lessons : [];
        for (var i = 0; i < lessons.length; i++) {
          var lesson = lessons[i];
          if (!lesson || typeof lesson !== "object" || !lesson.id) continue;
          out.push({
            id: String(lesson.id),
            label: String(lesson.label != null ? lesson.label : lesson.id),
            count: (typeof lesson.count === "number") ? lesson.count : null,
            rollup: lesson.rollup !== false,
            group: String(group.label != null ? group.label : ""),
            languageCode: code
          });
        }
      }
    }
    return out;
  }

  /* listLessonsForLanguage(manifest, code) -> the FLAT lesson array for ONE
   * language only: the same { id, label, count, rollup, group, languageCode }
   * rows as listLessons, filtered to languageCode === code. Built for the
   * per-language rollup (LB-27); LB-36 removed that rollup from the page, so
   * nothing in src/ calls this today (kept, with its tests, for reuse).
   * A missing/empty code, or an unknown code, yields []. Pure; never throws. */
  function listLessonsForLanguage(manifest, code) {
    if (!code) return [];
    var wanted = String(code);
    var all = listLessons(manifest);
    var out = [];
    for (var i = 0; i < all.length; i++) {
      if (all[i].languageCode === wanted) out.push(all[i]);
    }
    return out;
  }

  /* buildAllowedMap(manifest) -> { "<id>": true } across ALL languages — the
   * ?lesson= whitelist that replaces the hand-maintained ALLOWED literal. */
  function buildAllowedMap(manifest) {
    var lessons = listLessons(manifest);
    var out = {};
    for (var i = 0; i < lessons.length; i++) out[lessons[i].id] = true;
    return out;
  }

  /* buildLessonCounts(manifest) -> { "<id>": count } for every lesson that
   * declares a numeric count — replaces the hand-maintained LESSON_COUNTS map. */
  function buildLessonCounts(manifest) {
    var lessons = listLessons(manifest);
    var out = {};
    for (var i = 0; i < lessons.length; i++) {
      if (lessons[i].count != null) out[lessons[i].id] = lessons[i].count;
    }
    return out;
  }

  /* buildRollupMap(manifest) -> { "<id>": bool } — the explicit rollup flag per
   * lesson (true = counted by the old LB-27 rollup, removed from the page in
   * LB-36; nothing in src/ calls this today). */
  function buildRollupMap(manifest) {
    var lessons = listLessons(manifest);
    var out = {};
    for (var i = 0; i < lessons.length; i++) out[lessons[i].id] = lessons[i].rollup;
    return out;
  }

  /* getDefaultLesson(manifest, activeCode) -> the id to load when no valid
   * ?lesson= is present: the active language's declared defaultLesson, else its
   * first lesson id, else "". Pure; never throws. */
  function getDefaultLesson(manifest, activeCode) {
    var lang = getLanguage(manifest, activeCode);
    if (!lang) return "";
    if (lang.defaultLesson) return String(lang.defaultLesson);
    var model = buildPickerModel(manifest, lang.code);
    for (var g = 0; g < model.groups.length; g++) {
      if (model.groups[g].options.length > 0) return model.groups[g].options[0].value;
    }
    return "";
  }

  // Public surface.
  window.LBManifest = {
    getLanguages: getLanguages,
    shouldShowLanguageDropdown: shouldShowLanguageDropdown,
    getLanguage: getLanguage,
    buildLanguageOptions: buildLanguageOptions,
    buildPickerModel: buildPickerModel,
    listLessons: listLessons,
    listLessonsForLanguage: listLessonsForLanguage,
    buildAllowedMap: buildAllowedMap,
    buildLessonCounts: buildLessonCounts,
    buildRollupMap: buildRollupMap,
    getDefaultLesson: getDefaultLesson
  };
})();
