"use client";

import { useRef, useState } from "react";
import { api } from "@/lib/api/client";
import { addVetRecord, deleteVetRecord } from "../api/resume";
import type { OwnPet, VetRecord } from "../types/own-pet";
import type { DraftSaveResult } from "./use-photo-draft";

/** A vet record on the health step: one on file (`record`), or one chosen here and not saved yet (`file`). */
export type VetRecordSlot = { key: string; record?: VetRecord; file?: File };

const savedSlot = (record: VetRecord): VetRecordSlot => ({ key: `record-${record.id}`, record });

// PR-07's vet records as a draft (BUG-03): adding and removing one changes only what the step shows until the wizard
// calls `save` on Next or Save; `discard` (or leaving the page) puts it back. The files are private and never shown,
// so nothing is held in a blob: address.
export function useVetRecordDraft(pet: OwnPet) {
  const [slots, setSlots] = useState<VetRecordSlot[]>(() => pet.vet_records.map(savedSlot));
  const [removed, setRemoved] = useState<VetRecord[]>([]);
  const [saving, setSaving] = useState(false);
  const counter = useRef(0);

  const changed = removed.length > 0 || slots.some((slot) => slot.file);

  function add(file: File) {
    setSlots((current) => [...current, { key: `new-${++counter.current}`, file }]);
  }

  function remove(key: string) {
    const slot = slots.find((item) => item.key === key);
    if (!slot) return;
    setSlots((current) => current.filter((item) => item.key !== key));
    if (slot.record) setRemoved((current) => [...current, slot.record as VetRecord]);
  }

  function reset(to: OwnPet) {
    setSlots(to.vet_records.map(savedSlot));
    setRemoved([]);
  }

  /** Sends the step's record changes, removals first so the five-record limit never refuses an add. Never throws. */
  async function save(start: OwnPet): Promise<DraftSaveResult> {
    let current = start;
    const toRemove = [...removed];
    const toAdd = slots.filter((slot) => slot.file);
    const added = new Map<string, VetRecord>();
    setSaving(true);

    try {
      while (toRemove.length) {
        current = await deleteVetRecord(api, toRemove[0].id);
        toRemove.shift();
      }
      for (const slot of toAdd) {
        const before = new Set(current.vet_records.map((record) => record.id));
        current = await addVetRecord(api, slot.file as File);
        const record = current.vet_records.find((item) => !before.has(item.id));
        if (record) added.set(slot.key, record);
      }
      reset(current);
      return { pet: current };
    } catch (failure) {
      // Keep what is still to do, so pressing Save again finishes the job instead of repeating it.
      setSlots(slots.map((slot) => (added.has(slot.key) ? savedSlot(added.get(slot.key) as VetRecord) : slot)));
      setRemoved(toRemove);
      return { pet: current, failure };
    } finally {
      setSaving(false);
    }
  }

  return { slots, changed, saving, add, remove, discard: () => reset(pet), save };
}
