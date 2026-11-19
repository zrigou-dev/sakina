import { localizeDigits } from './format';
import type { Language } from './languages';
import { isPluralForms, selectPlural, type PluralForms } from './plural';

export type MessageValue = string | PluralForms;
export interface MessageTree {
  readonly [key: string]: MessageValue | MessageTree;
}

/** Dot-path keys of a message tree whose leaves are strings or plural forms. */
export type MessageKey<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string | PluralForms ? `${P}${K}` : T[K] extends object ? MessageKey<T[K], `${P}${K}.`> : never;
}[keyof T & string];

/** Same structure as T with every leaf required (string or plural forms). Ensures locale completeness at compile time. */
export type LocaleShape<T> = {
  readonly [K in keyof T]: T[K] extends string ? string : T[K] extends PluralForms ? PluralForms : LocaleShape<T[K]>;
};

export type TranslateParams = Readonly<Record<string, string | number>>;

export function lookup(tree: MessageTree, key: string): MessageValue | undefined {
  let node: MessageValue | MessageTree | undefined = tree;
  for (const part of key.split('.')) {
    if (!node || typeof node === 'string' || isPluralForms(node)) return undefined;
    node = (node as MessageTree)[part];
  }
  return typeof node === 'string' || isPluralForms(node) ? node : undefined;
}

/**
 * Resolves a key with `{param}` interpolation. Numeric params are rendered with the
 * language's digits. If `params.count` is present and the message has plural forms,
 * the CLDR category is selected. Falls back to `fallback` tree, then to the key itself.
 */
export function translate(tree: MessageTree, fallback: MessageTree, lang: Language, key: string, params?: TranslateParams): string {
  const value = lookup(tree, key) ?? lookup(fallback, key);
  if (value === undefined) return key;
  const template = typeof value === 'string' ? value : selectPlural(value, lang, Number(params?.count ?? 0));
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (m, name: string) => {
    const v = params[name];
    if (v === undefined) return m;
    return typeof v === 'number' ? localizeDigits(v, lang) : v;
  });
}
