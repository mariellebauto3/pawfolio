import { describe, expect, it } from "vitest";
import {
  ADMIN_NAV,
  formatNavCount,
  isNavLinkActive,
  meMenuFor,
  memberNavItems,
} from "@/components/navigation/nav-config";

const labels = (role: Parameters<typeof memberNavItems>[0]) => memberNavItems(role).map((item) => item.label);

describe("memberNavItems (GN-01)", () => {
  it("shows pets their matches as Homes for You", () => {
    expect(labels("pet")).toEqual(["Home", "Homes for You", "Browse", "Requests", "Alerts"]);
  });

  it("shows humans their matches as Pets for You", () => {
    expect(labels("human")).toEqual(["Home", "Pets for You", "Browse", "Requests", "Alerts"]);
  });

  it("uses the short label Matches on phones", () => {
    expect(memberNavItems("human").find((item) => item.id === "matches")?.shortLabel).toBe("Matches");
  });

  it("leaves matches out for roles without them", () => {
    expect(labels("admin")).toEqual(["Home", "Browse", "Requests", "Alerts"]);
    expect(labels(null)).toEqual(["Home", "Browse", "Requests", "Alerts"]);
  });
});

describe("meMenuFor (GN-01)", () => {
  const links = (role: Parameters<typeof meMenuFor>[0]) => {
    const { profileLink, sections } = meMenuFor(role);
    return [profileLink?.label, ...sections.flatMap((section) => section.links.map((link) => link.label))];
  };

  it("gives pets their résumé links and Invites to Apply", () => {
    expect(links("pet")).toEqual([
      "View my résumé",
      "Edit résumé",
      "Invites to Apply",
      "Bookmarks",
      "My stats",
      "My activity",
      "Settings",
    ]);
  });

  it("gives humans their Home Profile links and Meet & Greet availability", () => {
    expect(links("human")).toEqual([
      "View my Home Profile",
      "Edit Home Profile & quiz",
      "Meet & Greet availability",
      "Bookmarks",
      "Match & request history",
      "My activity",
      "Settings",
    ]);
  });

  it("gives admins only the way back to the admin pages", () => {
    expect(links("admin")).toEqual([undefined, "Admin dashboard"]);
  });

  it("has nothing but Log out (added by the menu) without an account", () => {
    expect(meMenuFor(null)).toEqual({ profileLink: null, sections: [] });
  });
});

describe("isNavLinkActive", () => {
  const requests = memberNavItems("pet").find((item) => item.id === "requests")!;
  const browse = memberNavItems("pet").find((item) => item.id === "browse")!;
  const dashboard = ADMIN_NAV.find((item) => item.id === "dashboard")!;
  const reports = ADMIN_NAV.find((item) => item.id === "reports")!;

  it("matches the page and pages below it", () => {
    expect(isNavLinkActive("/requests", requests)).toBe(true);
    expect(isNavLinkActive("/requests/42", requests)).toBe(true);
    expect(isNavLinkActive("/admin/reports/7", reports)).toBe(true);
  });

  it("matches the extra paths that belong to the item", () => {
    expect(isNavLinkActive("/apply/3", requests)).toBe(true);
    expect(isNavLinkActive("/pets/12", browse)).toBe(true);
    expect(isNavLinkActive("/search", browse)).toBe(true);
  });

  it("matches whole path segments only", () => {
    expect(isNavLinkActive("/requestsfoo", requests)).toBe(false);
    expect(isNavLinkActive("/petshop", browse)).toBe(false);
  });

  it("keeps the admin Dashboard to /admin itself", () => {
    expect(isNavLinkActive("/admin", dashboard)).toBe(true);
    expect(isNavLinkActive("/admin/reports", dashboard)).toBe(false);
  });
});

describe("formatNavCount", () => {
  it.each([
    [undefined, null],
    [0, null],
    [-2, null],
    [1, "1"],
    [99, "99"],
    [100, "99+"],
  ])("shows %s as %s", (count, shown) => {
    expect(formatNavCount(count)).toBe(shown);
  });
});
