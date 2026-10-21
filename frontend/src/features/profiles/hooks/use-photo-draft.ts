"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api/client";
import type { PetPhoto } from "@/types/pet";
import { type NewPhoto, addPhoto, deletePhoto, reorderPhotos, setCoverPhoto } from "../api/resume";
import { RESUME_LIMITS, movePhoto, photoSavePlan } from "../schemas/resume-schemas";
import type { OwnPet } from "../types/own-pet";

/** A photo on the photos step: one the resume has (`photo`), or one chosen here and not saved yet (`file`). */
export type PhotoSlot = { key: string; url: string; caption: string | null; photo?: PetPhoto; file?: File };

export type PendingCover = { file: File; url: string };

/** What a save sent: the resume as the API last answered, and the refusal that stopped it, if one did. */
export type DraftSaveResult = { pet: OwnPet; failure?: unknown };

const savedSlot = (photo: PetPhoto): PhotoSlot => ({ key: `photo-${photo.id}`, url: photo.url, caption: photo.caption, photo });
const sameOrder = (slots: PhotoSlot[], photos: PetPhoto[]) =>
  slots.length === photos.length && slots.every((slot, index) => slot.photo?.id === photos[index].id);

// PR-04 as a draft (BUG-03): adding, moving, removing a photo and choosing a cover change only what the step shows.
// Nothing reaches the API until the wizard calls `save` on Next or Save, and `discard` (or leaving the page) puts
// the step back to what the resume has. Chosen files are shown from memory (blob: addresses), released once they
// are saved, dropped or the page closes.
export function usePhotoDraft(pet: OwnPet) {
  const [slots, setSlots] = useState<PhotoSlot[]>(() => pet.photos.map(savedSlot));
  const [removed, setRemoved] = useState<PetPhoto[]>([]);
  const [cover, setCover] = useState<PendingCover | null>(null);
  const [saving, setSaving] = useState(false);
  const counter = useRef(0);
  const addresses = useRef(new Set<string>());

  useEffect(() => {
    const held = addresses.current;
    return () => held.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  function hold(file: File): string {
    const url = URL.createObjectURL(file);
    addresses.current.add(url);
    return url;
  }

  function release(url: string | undefined) {
    if (!url || !addresses.current.delete(url)) return;
    URL.revokeObjectURL(url);
  }

  const changed = slots.some((slot) => !slot.photo) || removed.length > 0 || cover !== null || !sameOrder(slots, pet.photos);

  function add({ file, caption, asProfilePhoto }: NewPhoto) {
    const slot: PhotoSlot = { key: `new-${++counter.current}`, url: hold(file), caption: caption.trim() || null, file };
    setSlots((current) => (asProfilePhoto ? [slot, ...current] : [...current, slot]));
  }

  function remove(key: string) {
    const slot = slots.find((item) => item.key === key);
    if (!slot) return;
    setSlots((current) => current.filter((item) => item.key !== key));
    if (slot.photo) setRemoved((current) => [...current, slot.photo as PetPhoto]);
    else release(slot.url);
  }

  function move(key: string, to: number) {
    setSlots((current) => {
      const order = movePhoto(
        current.map((slot) => slot.key),
        key,
        to,
      );
      return order.map((id) => current.find((slot) => slot.key === id) as PhotoSlot);
    });
  }

  function chooseCover(file: File) {
    release(cover?.url);
    setCover({ file, url: hold(file) });
  }

  function reset(to: OwnPet) {
    slots.forEach((slot) => release(slot.file && slot.url));
    release(cover?.url);
    setSlots(to.photos.map(savedSlot));
    setRemoved([]);
    setCover(null);
  }

  /** Sends the step's changes, starting from `start` (the resume as the wizard holds it). Never throws. */
  async function save(start: OwnPet): Promise<DraftSaveResult> {
    let current = start;
    const added = new Map<string, PetPhoto>();
    const toAdd = slots.filter((slot) => slot.file);
    const toRemove = [...removed];
    setSaving(true);

    try {
      for (const step of photoSavePlan(current.photos.length, toRemove.length, toAdd.length, RESUME_LIMITS.maxPhotos)) {
        if (step === "remove") {
          current = await deletePhoto(api, toRemove[0].id);
          toRemove.shift();
          continue;
        }
        const slot = toAdd[0];
        const before = new Set(current.photos.map((photo) => photo.id));
        current = await addPhoto(api, { file: slot.file as File, caption: slot.caption ?? "", asProfilePhoto: false });
        const photo = current.photos.find((item) => !before.has(item.id));
        if (photo) added.set(slot.key, photo);
        toAdd.shift();
      }

      const order = slots.map((slot) => slot.photo?.id ?? added.get(slot.key)?.id);
      const ids = order.filter((id): id is number => id !== undefined);
      if (ids.length === order.length && ids.join() !== current.photos.map((photo) => photo.id).join()) {
        current = await reorderPhotos(api, ids);
      }

      // Last, so a cover that was sent is never left marked as waiting.
      if (cover) current = await setCoverPhoto(api, cover.file);

      reset(current);
      return { pet: current };
    } catch (failure) {
      // Keep what is still to do, so pressing Save again finishes the job instead of repeating it.
      setSlots(
        slots.map((slot) => {
          const photo = added.get(slot.key);
          if (!photo) return slot;
          release(slot.url);
          return savedSlot(photo);
        }),
      );
      setRemoved(toRemove);
      return { pet: current, failure };
    } finally {
      setSaving(false);
    }
  }

  return { slots, cover, changed, saving, add, remove, move, chooseCover, discard: () => reset(pet), save };
}
