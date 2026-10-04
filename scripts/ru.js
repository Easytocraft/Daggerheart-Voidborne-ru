/**
 * Daggerheart: Voidborne — русский перевод
 * Регистрирует переводы компендиумов через Babele и несколько конвертеров
 * для вложенных данных (действия, эффекты, вложенные предметы противников).
 */
const MODULE_ID = "daggerheart-voidborne-ru";
const SOURCE_MODULE_ID = "daggerheart-voidborne";

const clone = (o) => (foundry?.utils?.deepClone ? foundry.utils.deepClone(o) : JSON.parse(JSON.stringify(o)));

/** Применяет переведённые поля действия (name / description / countdown / areas). */
function translateActions(actions, tr) {
  if (!actions || !tr) return actions;
  const out = clone(actions);
  for (const [id, t] of Object.entries(tr)) {
    const a = out[id];
    if (!a) continue;
    if (t.name) a.name = t.name;
    if (t.description) a.description = t.description;
    for (const key of ["countdown", "areas"]) {
      if (Array.isArray(t[key]) && Array.isArray(a[key])) {
        t[key].forEach((n, i) => { if (n && a[key][i]) a[key][i].name = n; });
      }
    }
  }
  return out;
}

/** Применяет переведённые поля эффектов, найденных по _id. */
function translateEffects(effects, tr) {
  if (!Array.isArray(effects) || !tr) return effects;
  return effects.map((eff) => {
    const t = tr[eff?._id];
    if (!t) return eff;
    const e = clone(eff);
    if (t.name) e.name = t.name;
    if (t.description) e.description = t.description;
    if (t.durationDescription) {
      e.system = e.system ?? {};
      e.system.duration = e.system.duration ?? {};
      e.system.duration.description = t.durationDescription;
    }
    return e;
  });
}

const CONVERTERS = {
  vbActions: (value, tr) => translateActions(value, tr),
  vbEffects: (value, tr) => translateEffects(value, tr),
  vbArray: (value, tr) => (Array.isArray(value) && Array.isArray(tr) && tr.length === value.length ? tr : value),
  vbExperiences: (value, tr) => {
    if (!value || !tr) return value;
    const out = clone(value);
    for (const [id, name] of Object.entries(tr)) if (out[id] && name) out[id].name = name;
    return out;
  },
  vbOwnedItems: (value, tr) => {
    if (!Array.isArray(value) || !tr) return value;
    return value.map((item) => {
      const t = tr[item?._id];
      if (!t) return item;
      const i = clone(item);
      if (t.name) i.name = t.name;
      if (t.description) {
        i.system = i.system ?? {};
        i.system.description = t.description;
      }
      if (t.actions && i.system?.actions) i.system.actions = translateActions(i.system.actions, t.actions);
      if (t.effects && i.effects) i.effects = translateEffects(i.effects, t.effects);
      return i;
    });
  },
};

let registered = false;
function registerWithBabele(babele) {
  if (registered || !babele) return;
  registered = true;
  babele.register({ module: MODULE_ID, lang: "ru", dir: "translations/ru" });
  babele.registerConverters(CONVERTERS);
}

Hooks.once("babele.init", (babele) => registerWithBabele(babele));

// Запасной путь для старых версий Babele, где нет хука babele.init
Hooks.once("init", () => {
  if (typeof Babele !== "undefined" && typeof Babele.get === "function") registerWithBabele(Babele.get());
});

/**
 * Домен «Blood» регистрируется оригинальным модулем с английской подписью.
 * Заменяем её на русскую (только ведущий, только если подпись ещё не менялась).
 */
Hooks.once("ready", async () => {
  if (!game.user.isGM || game.system.id !== "daggerheart" || game.i18n.lang !== "ru") return;
  if (!game.modules.get(SOURCE_MODULE_ID)?.active) return;
  await new Promise((r) => setTimeout(r, 3000)); // даём оригинальному модулю зарегистрировать домен
  try {
    const key = game.settings.settings.has("daggerheart.homebrew") ? "homebrew" : "Homebrew";
    const hb = game.settings.get("daggerheart", key);
    const blood = hb?.domains?.blood;
    if (!blood || blood.label !== "Blood") return;
    const domains = { ...hb.domains, blood: { ...blood, label: "Кровь", description: "Домен Крови." } };
    await game.settings.set("daggerheart", key, { ...hb, domains });
  } catch (err) {
    console.warn(`${MODULE_ID} | Не удалось перевести подпись домена «Кровь»:`, err);
  }
});
