// Made-up alumni for the landing page's Recently Hired gallery (SEC-PRIV-06), newest first. The names are invented;
// the photos are Unsplash pets (public/images/placeholders/alumni/README.md), shipped only through this mock.
const photo = (name: string) => `/images/placeholders/alumni/${name}.webp`;

export const RECENTLY_HIRED = [
  { name: "Luna", photo_url: photo("luna"), hired_at: "2026-09-27T09:15:00.000000Z" },
  { name: "Choco Jr.", photo_url: photo("choco-jr"), hired_at: "2026-09-21T14:40:00.000000Z" },
  { name: "Brownie", photo_url: photo("brownie"), hired_at: "2026-09-12T10:05:00.000000Z" },
  { name: "Pancit", photo_url: photo("pancit"), hired_at: "2026-08-30T16:30:00.000000Z" },
  { name: "Mango", photo_url: photo("mango"), hired_at: "2026-08-18T11:20:00.000000Z" },
  { name: "Bantay", photo_url: photo("bantay"), hired_at: "2026-08-03T08:45:00.000000Z" },
];
