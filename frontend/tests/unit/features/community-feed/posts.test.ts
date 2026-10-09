import { describe, expect, it } from "vitest";
import {
  COMMENT_BODY_MAX,
  POST_BODY_MAX,
  POST_TITLE_MAX,
  STORY_BODY_MAX,
  bodyMaxFor,
  commentProblem,
  countLabel,
  hasTitleField,
  photoError,
  postIdFromUrl,
  validatePostForm,
} from "@/features/community-feed/schemas/posts";

const EMPTY = { title: "", body: "", petId: "" };

describe("the post form (FD-03, FD-04)", () => {
  it("asks a post for words, within the API's limit", () => {
    expect(validatePostForm("post", EMPTY)).toEqual({ body: "Write something first." });
    expect(validatePostForm("post", { ...EMPTY, body: "   " })).toEqual({ body: "Write something first." });
    expect(validatePostForm("post", { ...EMPTY, body: "a".repeat(POST_BODY_MAX) })).toEqual({});
    expect(validatePostForm("post", { ...EMPTY, body: "a".repeat(POST_BODY_MAX + 1) }).body).toBe("Keep it to 2,000 characters or fewer.");
  });

  it("asks a story for its pet, a title and the story", () => {
    expect(validatePostForm("story", EMPTY)).toEqual({ body: "Write your story first.", title: "Give your story a title.", adopted_pet_id: "Choose the pet this story is about." });
    expect(validatePostForm("story", { title: "Luna", body: "a".repeat(STORY_BODY_MAX), petId: "4" })).toEqual({});
    expect(validatePostForm("story", { title: "a".repeat(POST_TITLE_MAX + 1), body: "Words", petId: "4" }).title).toBe("Keep the title to 160 characters or fewer.");
    // The select only ever holds an id; anything else is "not chosen".
    expect(validatePostForm("story", { title: "Luna", body: "Words", petId: "4 or 5" }).adopted_pet_id).toBeTruthy();
  });

  it("edits a post by its own type: a story keeps its title and its room", () => {
    expect(validatePostForm("edit", { ...EMPTY, body: "Words" }, { type: "update" })).toEqual({});
    expect(validatePostForm("edit", { ...EMPTY, body: "a".repeat(POST_BODY_MAX + 1) }, { type: "update" }).body).toBeTruthy();
    expect(validatePostForm("edit", { ...EMPTY, body: "a".repeat(POST_BODY_MAX + 1) }, { type: "adoption_story" })).toEqual({ title: "Give your story a title." });
    expect(hasTitleField("edit", { type: "for_hire" })).toBe(false);
    expect(hasTitleField("edit", { type: "adoption_story" })).toBe(true);
    expect(hasTitleField("story")).toBe(true);
    expect(hasTitleField("post")).toBe(false);
    expect([bodyMaxFor("post"), bodyMaxFor("update"), bodyMaxFor("adoption_story")]).toEqual([2000, 2000, 3000]);
  });

  it("gathers the API's photo errors into the one photo field", () => {
    expect(photoError({ body: "Required." })).toBeNull();
    expect(photoError({ "photos.0": "Upload a JPG or PNG photo.", "photos.2": "Upload a JPG or PNG photo.", photos: "No more than 4." })).toBe("Upload a JPG or PNG photo. No more than 4.");
  });
});

describe("a comment (FD-05)", () => {
  it("needs words, within the API's limit", () => {
    expect(commentProblem("  ")).toBe("Write a comment first.");
    expect(commentProblem("Congrats!")).toBeNull();
    expect(commentProblem("a".repeat(COMMENT_BODY_MAX))).toBeNull();
    expect(commentProblem("a".repeat(COMMENT_BODY_MAX + 1))).toBe("Keep it to 1,000 characters or fewer.");
  });
});

describe("a post's address", () => {
  it("reads only a whole number of 1 or more as an id", () => {
    expect(postIdFromUrl("12")).toBe(12);
    for (const value of ["0", "-1", "1.5", "12abc", "", " 12", "..%2F..%2Fadmin", "1e3", "012", "9".repeat(20)]) expect(postIdFromUrl(value)).toBeNull();
  });
});

describe("counts", () => {
  it("are written with their noun", () => {
    expect([countLabel(0, "like", "likes"), countLabel(1, "like", "likes"), countLabel(12, "comment", "comments")]).toEqual(["0 likes", "1 like", "12 comments"]);
  });
});
