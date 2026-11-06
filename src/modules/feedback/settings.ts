/**
 * Reading and writing the feedback settings an admin controls.
 *
 * These live in the data adapter, not in config/event.json, because they are
 * changed during the event and the config file is version controlled.
 */
import { getData } from '@/data';
import type { AnonymityMode } from '@/data/types';

import {
  isAnonymityMode,
  isFormOpen,
  resolveAnonymity,
  SETTING_KEYS,
  type FeedbackForm,
} from './logic';

export type FormSettings = {
  anonymity: AnonymityMode;
  /** True when the form's own setting decides it, not the event default. */
  anonymityIsOverride: boolean;
  open: boolean;
};

export async function readFormSettings(formId: string): Promise<FormSettings> {
  const data = getData();
  const [override, fallback, openSetting] = await Promise.all([
    data.settings.get(SETTING_KEYS.anonymityFor(formId)),
    data.settings.get(SETTING_KEYS.anonymityDefault),
    data.settings.get(SETTING_KEYS.openFor(formId)),
  ]);

  return {
    anonymity: resolveAnonymity(override, fallback),
    anonymityIsOverride: isAnonymityMode(override),
    open: isFormOpen(openSetting),
  };
}

/** One read for the whole admin page, rather than three per form. */
export async function readAllFormSettings(
  forms: FeedbackForm[],
): Promise<{ eventDefault: AnonymityMode; byForm: Map<string, FormSettings> }> {
  const data = getData();
  const all = await data.settings.getAll();
  const values = new Map(all.map((setting) => [setting.key, setting.value]));

  const fallback = values.get(SETTING_KEYS.anonymityDefault) ?? null;
  const byForm = new Map<string, FormSettings>();

  for (const form of forms) {
    const override = values.get(SETTING_KEYS.anonymityFor(form.id)) ?? null;
    byForm.set(form.id, {
      anonymity: resolveAnonymity(override, fallback),
      anonymityIsOverride: isAnonymityMode(override),
      open: isFormOpen(values.get(SETTING_KEYS.openFor(form.id)) ?? null),
    });
  }

  return { eventDefault: resolveAnonymity(null, fallback), byForm };
}

export async function setEventAnonymityDefault(mode: AnonymityMode): Promise<void> {
  await getData().settings.set(SETTING_KEYS.anonymityDefault, mode);
}

/** Passing null clears the override so the form follows the event default. */
export async function setFormAnonymity(formId: string, mode: AnonymityMode | null): Promise<void> {
  const data = getData();
  const key = SETTING_KEYS.anonymityFor(formId);
  if (mode === null) await data.settings.remove(key);
  else await data.settings.set(key, mode);
}

export async function setFormOpen(formId: string, open: boolean): Promise<void> {
  await getData().settings.set(SETTING_KEYS.openFor(formId), open ? 'open' : 'closed');
}
