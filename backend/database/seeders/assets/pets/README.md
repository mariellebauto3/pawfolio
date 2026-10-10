# Sample pet photos for the demo seeder

`DemoSeeder` copies these behind the demo pets' photo rows, so resumes, avatars and the landing page's Recently Hired
gallery have pictures in local development and on staging. They are never used in production (the seeder refuses to
run there) and they are not real Pawfolio pets (SEC-PRIV-06).

All photos are from [Unsplash](https://unsplash.com) under the [Unsplash License](https://unsplash.com/license)
(free to use, no attribution required), 800 px wide, JPEG. They are the same photos as the frontend's mock alumni
(`frontend/public/images/placeholders/alumni/`).

| File | Unsplash photo |
| --- | --- |
| `dog-1.jpg` | `photo-1561037404-61cd46aa615b` |
| `dog-2.jpg` | `photo-1543466835-00a7907e9de1` |
| `dog-3.jpg` | `photo-1587300003388-59208cc962cb` |
| `cat-1.jpg` | `photo-1518791841217-8f162f1e1131` |
| `cat-2.jpg` | `photo-1514888286974-6c03e2ca1dba` |
| `cat-3.jpg` | `photo-1574158622682-e40e69881006` |
| `dog-4.jpg` | `photo-1517849845537-4d257902454a` |
| `dog-5.jpg` | `photo-1552053831-71594a27632d` |
| `dog-6.jpg` | `photo-1537151625747-768eb6cf92b2` |
| `dog-7.jpg` | `photo-1534361960057-19889db9621e` |
| `dog-8.jpg` | `photo-1477884213360-7e9d7dcc1e48` |
| `cat-4.jpg` | `photo-1533738363-b7f9aef128ce` |
| `cat-5.jpg` | `photo-1573865526739-10659fec78a5` |
| `cat-6.jpg` | `photo-1495360010541-f48722b34f7d` |

`dog-4` … `dog-8` and `cat-4` … `cat-6` were added 2026-10-10 (720 px wide), so that the demo's pets don't share a
picture: `DemoSeeder::dealDistinctDemoPhotos` gives each pet of a kind a first photo of its own while there is a
sample nobody uses. Add more here (`dog-9.jpg`, …) and the seeder picks them up by name.
