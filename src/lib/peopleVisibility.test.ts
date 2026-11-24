import { describe, expect, it, vi } from "vitest";
import { filterVisiblePeople, isHiddenTechnicalPerson, visiblePeopleQuery, TV_ACCOUNT_USER_ID, TV_ACCOUNT_AUTH_ID } from "./peopleVisibility";

describe("technical TV account visibility", () => {
  it("excludes TV Escritório by its stable user id even if renamed", () => {
    expect(isHiddenTechnicalPerson({ id: "4cd93864-3689-4835-bddf-91e2960e7860", name: "Nome alterado" })).toBe(true);
  });
  it("excludes auth-id person lists", () => {
    expect(isHiddenTechnicalPerson({ id: "4e6afeac-2c22-4e20-805f-dba140036027" })).toBe(true);
    expect(isHiddenTechnicalPerson({ auth_user_id: TV_ACCOUNT_AUTH_ID })).toBe(true);
  });
  it("excludes the TV identity from partial projections", () => {
    expect(isHiddenTechnicalPerson({ email: " TV-ESCRITORIO@IAMROY.APP " })).toBe(true);
    expect(isHiddenTechnicalPerson({ name: " TV   Escritório " })).toBe(true);
  });
  it("preserves real people, including other read-only users", () => {
    expect(isHiddenTechnicalPerson({ id: "person", name: "Lucas dos Santos" })).toBe(false);
    expect(isHiddenTechnicalPerson({ name: "Maria", email: "maria@example.com" })).toBe(false);
    expect(isHiddenTechnicalPerson(null)).toBe(false);
  });
  it("counts only people without mutating the original list", () => {
    const list = [{ id: "jessica", name: "Jessica Campos" }, { id: TV_ACCOUNT_USER_ID, name: "TV Escritório" }];
    expect(filterVisiblePeople(list)).toEqual([list[0]]);
    expect(list).toHaveLength(2);
    expect(filterVisiblePeople(null)).toEqual([]);
  });
  it("excludes the stable TV id at the list query before counts and pagination", () => {
    const query = { neq: vi.fn() };
    query.neq.mockReturnValue(query);
    expect(visiblePeopleQuery(query)).toBe(query);
    expect(query.neq).toHaveBeenCalledWith("id", "4cd93864-3689-4835-bddf-91e2960e7860");
  });
});