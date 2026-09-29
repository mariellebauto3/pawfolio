// Mock data for the lo-fi prototype. Nothing here is persisted.

export const pets = [
  {
    id: 'mochi', name: 'Mochi', species: 'Dog', breed: 'Aspin', age: '2 yrs', size: 'Medium', sex: 'Female',
    city: 'Quezon City', province: 'Metro Manila', status: 'In Process',
    currentlyAt: 'Happy Paws Rescue (foster home)',
    energy: 'High', alone: 'Up to 6 hrs', space: 'Needs a yard or daily walks', experience: 'First-time owners OK',
    temperament: ['Playful', 'Loyal', 'Curious', 'Gentle'],
    skills: ['Sit & stay', 'Leash-trained', 'Potty-trained', 'Crate-trained'],
    compat: { Kids: 'Yes', Dogs: 'Yes', Cats: 'Unknown' },
    special: 'None',
    health: 'Fully vaccinated (Aug 2026), dewormed, spayed. No known conditions.',
    bio: "Hi, I'm Mochi! I was found near a jeepney terminal and now I'm fostered by Happy Paws. I love long walks, belly rubs, and waiting at the door for my people. Looking for a family that likes the outdoors as much as I do.",
    match: 92, reasons: ['Loves long walks — so do you', 'Fine alone for 6 hrs — you’re out for 5', 'Good with kids'],
    views: 148, bookmarks: 23,
  },
  {
    id: 'kulit', name: 'Kulit', species: 'Cat', breed: 'Puspin', age: '1 yr', size: 'Small', sex: 'Male',
    city: 'Marikina', province: 'Metro Manila', status: 'Looking for a Home',
    currentlyAt: 'Found by a neighbor, fostered at home',
    energy: 'Medium', alone: 'Up to 8 hrs', space: 'Apartment OK', experience: 'First-time owners OK',
    temperament: ['Chatty', 'Cuddly', 'Independent'], skills: ['Litter-trained', 'Scratching post only'],
    compat: { Kids: 'Yes', Dogs: 'Unknown', Cats: 'Yes' }, special: 'None',
    health: 'Vaccinated, neutered. FIV negative.',
    bio: "Meow, I'm Kulit. I talk a lot, I nap a lot, and I'll judge your plants.",
    match: 81, reasons: ['Gets along with your cat', 'Fine alone for 8 hrs'],
    views: 97, bookmarks: 11,
  },
  {
    id: 'choco', name: 'Choco', species: 'Dog', breed: 'Aspin mix', age: '6 mos', size: 'Small', sex: 'Male',
    city: 'Quezon City', province: 'Metro Manila', status: 'Looking for a Home',
    currentlyAt: 'Fostered by a UP Diliman student',
    energy: 'High', alone: 'Up to 3 hrs', space: 'Needs a yard or daily walks', experience: 'Some experience',
    temperament: ['Playful', 'Friendly', 'Clumsy'], skills: ['Learning sit', 'Potty-training in progress'],
    compat: { Kids: 'Yes', Dogs: 'Yes', Cats: 'Yes' }, special: 'None',
    health: 'First two vaccine shots done. Deworming up to date.',
    bio: "Hello! I'm Choco, six months old and full of zoomies. I'm still learning my manners, but I learn fast when snacks are involved.",
    match: 84, reasons: ['Loves to play — so do your kids', 'Gets along with cats'],
    views: 88, bookmarks: 14,
  },
  {
    id: 'bantay', name: 'Bantay', species: 'Dog', breed: 'Labrador mix', age: '8 yrs', size: 'Large', sex: 'Male',
    city: 'Pasig', province: 'Metro Manila', status: 'In Process',
    currentlyAt: 'PAWS shelter volunteer foster',
    energy: 'Low', alone: 'Up to 4 hrs', space: 'Ground floor preferred', experience: 'Some experience',
    temperament: ['Calm', 'Gentle', 'Senior'], skills: ['Sit', 'Shake', 'House-trained'],
    compat: { Kids: 'Yes', Dogs: 'Yes', Cats: 'Yes' }, special: 'Daily joint supplements',
    health: 'Mild arthritis, on glucosamine. Vaccinated, neutered.',
    bio: "I'm Bantay, a retired guard dog. My guarding days are over — now I specialize in naps and quiet company.",
    match: 74, reasons: ['Calm — fits your evenings', 'Needs daily meds — you said that’s OK'],
    views: 61, bookmarks: 7,
  },
  {
    id: 'miming', name: 'Miming', species: 'Cat', breed: 'Puspin', age: '5 yrs', size: 'Small', sex: 'Female',
    city: 'Pasig', province: 'Metro Manila', status: 'Looking for a Home',
    currentlyAt: 'Community cat caretaker, Kapitolyo',
    energy: 'Low', alone: '8+ hrs', space: 'Apartment OK', experience: 'First-time owners OK',
    temperament: ['Calm', 'Independent', 'Gentle'], skills: ['Litter-trained', 'Quiet at night'],
    compat: { Kids: 'Unknown', Dogs: 'No', Cats: 'Yes' }, special: 'Special diet (urinary care)',
    health: 'Spayed, vaccinated. Eats urinary-care food.',
    bio: "I'm Miming. I like sunny windows, quiet evenings, and exactly two chin scratches a day.",
    match: 76, reasons: ['Calm and independent', 'Special diet — you’re OK with minor needs'],
    views: 54, bookmarks: 6,
  },
  {
    id: 'luna', name: 'Luna', species: 'Cat', breed: 'Siamese mix', age: '3 yrs', size: 'Small', sex: 'Female',
    city: 'Quezon City', province: 'Metro Manila', status: 'Adopted — Hired',
    currentlyAt: 'Home with her Furparent', hiredBy: 'santos', hiredOn: 'Jun 14, 2026',
    energy: 'Medium', alone: 'Up to 8 hrs', space: 'Apartment OK', experience: 'First-time owners OK',
    temperament: ['Elegant', 'Curious'], skills: ['Litter-trained', 'Comes when called'],
    compat: { Kids: 'Yes', Dogs: 'No', Cats: 'Yes' }, special: 'None',
    health: 'Vaccinated, spayed.',
    bio: 'Former Pawfolio job seeker. Now Head of Window Watching at the Santos household.',
    match: 0, reasons: [], views: 402, bookmarks: 55,
  },
]

export const homes = [
  {
    id: 'santos', name: 'Ana Santos', city: 'Quezon City', province: 'Metro Manila', open: true, furparent: true,
    homeType: 'House', outdoor: 'Small fenced yard', household: '2 adults, 1 child (8 yrs)', otherPets: '1 cat (Luna)',
    activity: 'Active — daily jogs', away: '5 hrs/day', experience: 'Has raised dogs and cats',
    looking: 'Medium dog, 1–4 yrs, good with kids and cats', specialNeeds: 'Open to minor needs',
    about: 'We are a family of three who spend weekends at the park. Our cat Luna (a Pawfolio alum!) runs the house.',
    match: 92, reasons: ['Active home — you have high energy', 'Out 5 hrs — you’re fine for 6', 'Has a kid — you love kids'],
  },
  {
    id: 'reyes', name: 'Marco Reyes', city: 'Pasig', province: 'Metro Manila', open: true,
    homeType: 'Condo unit', outdoor: 'None (park nearby)', household: '1 adult', otherPets: 'None',
    activity: 'Moderate', away: '8 hrs/day (hybrid)', experience: 'First-time owner',
    looking: 'Any size, calm, adult', specialNeeds: 'Not at the moment',
    about: 'Hybrid worker in a quiet condo with lots of free time on weekends.',
    match: 78, reasons: ['Quiet home', 'Park nearby for walks'],
  },
  {
    id: 'cruz', name: 'Liza Cruz', city: 'Marikina', province: 'Metro Manila', open: true,
    homeType: 'House', outdoor: 'Large yard', household: '3 adults', otherPets: '2 dogs',
    activity: 'Very active', away: '3 hrs/day', experience: 'Long-time dog owner',
    looking: 'Dogs of any age', specialNeeds: 'Yes',
    about: 'Big yard, two goofy dogs, always room for one more.',
    match: 71, reasons: ['Large yard', 'Someone home most of the day'],
  },
  {
    id: 'garcia', name: 'Paolo Garcia', city: 'Caloocan', province: 'Metro Manila', open: true,
    homeType: 'Apartment', outdoor: 'Balcony', household: '2 adults', otherPets: 'None',
    activity: 'Moderate', away: '9 hrs/day', experience: 'Grew up with dogs',
    looking: 'Small dog, adult, calm', specialNeeds: 'No',
    about: 'Couple in a pet-friendly apartment. We walk to the park every morning.',
    match: 69, reasons: ['Walks every morning', 'Pet-friendly building'],
  },
]

export const me = { pet: 'mochi', human: 'santos' }

// Adoption requests (pet → human)
export const requests = [
  { id: 'r0', pet: 'luna', home: 'santos', status: 'Adopted', sent: 'May 30', approved: 'Jun 2', booked: 'Jun 4', confirmed: 'Jun 5', updated: 'Jun 14',
    caretaker: 'Carmi Reyes',
    letter: 'Hi Ana! I’m quiet, clean and I promise to only knock over small things.',
    caretakerNotes: 'Luna is shy for a day, then very affectionate. — Carmi (finder)',
    slot: { date: 'Sat, Jun 13', time: '3:00 PM', place: 'Paws & Claws Café (public)' } },
  { id: 'r1', pet: 'mochi', home: 'santos', status: 'Meet Scheduled', sent: 'Sep 20', approved: 'Sep 22', booked: 'Sep 25', confirmed: 'Sep 26', updated: 'Sep 26',
    caretaker: 'Joy Lim',
    letter: 'Hi Ana! I saw that your family jogs every day — I can keep up, I promise. I’m great with kids and I’d love to meet Luna.',
    caretakerNotes: 'Mochi is shy with loud noises for the first hour, then warms up. — Joy (foster)',
    slot: { date: 'Sat, Oct 3', time: '10:00 AM', place: 'Happy Paws Rescue, QC' } },
  { id: 'r2', pet: 'mochi', home: 'reyes', status: 'On Hold', sent: 'Sep 21', updated: 'Sep 24', caretaker: 'Joy Lim',
    letter: 'Hi Marco, I’m calm indoors once I’ve had my walk, and I don’t mind condo life.', caretakerNotes: 'Walks twice a day. — Joy (foster)' },
  { id: 'r3', pet: 'mochi', home: 'garcia', status: 'Declined', sent: 'Sep 2', updated: 'Sep 10', caretaker: 'Joy Lim',
    letter: 'Hi Paolo! I love morning walks too.', caretakerNotes: '' },
  { id: 'r4', pet: 'kulit', home: 'santos', status: 'Sent', sent: 'Sep 27', updated: 'Sep 27', caretaker: 'Ben Yu',
    letter: 'Hello! I’m chatty but low-maintenance. Luna and I would be great roommates.',
    caretakerNotes: 'Kulit is litter-trained and eats dry food. — Ben (finder)' },
  { id: 'r5', pet: 'bantay', home: 'santos', status: 'Awaiting Decision', sent: 'Sep 8', approved: 'Sep 10', booked: 'Sep 11', confirmed: 'Sep 12', updated: 'Sep 17',
    caretaker: 'Rhea Santiago',
    letter: 'I’m a senior gentleman looking for a quiet retirement.', caretakerNotes: 'Needs joint supplements. — Rhea (PAWS volunteer)',
    slot: { date: 'Thu, Sep 17', time: '4:00 PM', place: 'BGC High Street (public)' } },
  { id: 'r6', pet: 'choco', home: 'santos', status: 'Withdrawn', sent: 'Sep 8', updated: 'Sep 12', caretaker: 'Mark Dizon',
    letter: 'Hi! I have lots of energy for your family.', caretakerNotes: '' },
]

export const slots = [
  { date: 'Sat, Oct 3', time: '10:00 AM', place: 'Happy Paws Rescue, QC', kind: 'Shelter', taken: 'Mochi' },
  { date: 'Sat, Oct 3', time: '2:00 PM', place: 'UP Diliman Academic Oval', kind: 'Public spot' },
  { date: 'Sun, Oct 4', time: '9:00 AM', place: 'Caretaker’s location', kind: 'Caretaker’s location' },
  { date: 'Wed, Oct 7', time: '5:30 PM', place: 'UP Diliman Academic Oval', kind: 'Public spot' },
]

export const invites = [
  { id: 'i1', home: 'cruz', note: 'Your résumé made us smile. Want to apply?', when: '2h ago' },
  { id: 'i2', home: 'garcia', note: '', when: '1d ago' },
]

export const posts = [
  { id: 'p1', author: 'kulit', kind: 'pet', type: 'For Hire', when: '1h', reactions: 24, comments: 6,
    text: 'I’m officially #LookingForAHome! Chatty, cuddly, litter-trained. Check out my résumé.', img: true },
  { id: 'p2', author: 'luna', kind: 'pet', type: 'Hired', when: '3h', reactions: 88, comments: 3,
    text: '3 months at my new job. Performance review: 10/10 naps. Grateful to my Furparent!', img: true },
  { id: 'p3', author: 'reyes', kind: 'human', type: 'Post', when: '5h', reactions: 9, comments: 4,
    text: 'Finally finished my Home Profile. Any tips for a first-time Furparent living in a condo?' },
  { id: 'p4', author: 'bantay', kind: 'pet', type: 'Update', when: '1w', reactions: 31, comments: 2,
    text: 'Had my first Meet & Greet today. I wore my best bandana.', img: true },
  { id: 'p5', author: 'santos', kind: 'human', type: 'Adoption Story', when: '2d', reactions: 56, comments: 12,
    text: 'How Luna “applied” to our home — and why we said yes. It started with a cover letter about knocking things off tables…', img: true },
]

export const comments = {
  p2: [
    { author: 'santos', text: 'She also reviews my work calls. Strict but fair.', when: '2h' },
    { author: 'mochi', text: 'Goals! Hoping to get Hired soon too.', when: '1h' },
    { author: 'reyes', text: 'Congrats Luna! This made my day.', when: '40m' },
  ],
  default: [
    { author: 'cruz', text: 'Love this! Following your journey.', when: '1h' },
    { author: 'kulit', text: 'Same energy.', when: '30m' },
  ],
}

export const notifications = {
  pet: [
    { t: 'Invite to Apply', m: 'Liza Cruz invited you to apply to their home.', when: '2h', unread: true, cat: 'Requests' },
    { t: 'Meet & Greet confirmed', m: 'Ana Santos confirmed Sat, Oct 3 · 10:00 AM at Happy Paws Rescue.', when: '1d', unread: true, cat: 'Meet & Greets' },
    { t: 'Meet & Greet reminder', m: 'Your Meet & Greet with Ana Santos is in 1 day.', when: '1d', cat: 'Meet & Greets' },
    { t: 'Request on hold', m: 'Your request to Marco Reyes is paused while another request is in process.', when: '2d', cat: 'Requests' },
    { t: 'Request approved', m: 'Ana Santos approved your request. Book a Meet & Greet.', when: '3d', cat: 'Requests' },
    { t: 'Request declined', m: 'Paolo Garcia declined your request. You can apply again after Oct 10.', when: '2w', cat: 'Requests' },
    { t: 'Account approved', m: 'Welcome to Pawfolio! Complete your résumé to go live.', when: '2w', cat: 'Account' },
  ],
  human: [
    { t: 'Decision needed', m: 'Your Meet & Greet with Bantay has passed. Adopt or decline?', when: '1h', unread: true, cat: 'Meet & Greets' },
    { t: 'New adoption request', m: 'Kulit sent you an adoption request.', when: '1d', unread: true, cat: 'Requests' },
    { t: 'Meet & Greet reminder', m: 'Mochi · Sat, Oct 3 · 10:00 AM — 1 day to go.', when: '1d', cat: 'Meet & Greets' },
    { t: 'Meet & Greet booked', m: 'Mochi booked Sat, Oct 3 · 10:00 AM. Confirm or propose another time.', when: '4d', cat: 'Meet & Greets' },
    { t: 'Request withdrawn', m: 'Choco withdrew their adoption request.', when: '2w', cat: 'Requests' },
    { t: 'Announcement', m: 'Pawfolio Adoption Week starts Oct 10!', when: '3d', cat: 'Account' },
  ],
}

export const activity = {
  pet: [
    { what: 'Booked a Meet & Greet with Ana Santos · Sat, Oct 3, 10:00 AM', when: 'Sep 25, 2026 · 9:03 AM', type: 'Meet & Greet' },
    { what: 'Status changed by the system: Looking for a Home → In Process', when: 'Sep 22, 2026 · 6:40 PM', type: 'Status' },
    { what: 'Sent an adoption request to Marco Reyes', when: 'Sep 21, 2026 · 8:15 PM', type: 'Request' },
    { what: 'Sent an adoption request to Ana Santos', when: 'Sep 20, 2026 · 4:12 PM', type: 'Request' },
    { what: 'Updated résumé: added 2 photos', when: 'Sep 18, 2026 · 7:45 PM', type: 'Profile' },
    { what: 'Status changed by the system: Draft → Looking for a Home', when: 'Sep 14, 2026 · 10:21 AM', type: 'Status' },
    { what: 'Account approved by an admin', when: 'Sep 13, 2026 · 3:02 PM', type: 'Account' },
    { what: 'Signed in from a new device (Windows · Edge)', when: 'Sep 13, 2026 · 3:05 PM', type: 'Security' },
  ],
  human: [
    { what: 'Confirmed Meet & Greet with Mochi · Sat, Oct 3, 10:00 AM', when: 'Sep 26, 2026 · 3:20 PM', type: 'Meet & Greet' },
    { what: 'Approved Mochi’s adoption request', when: 'Sep 22, 2026 · 6:40 PM', type: 'Request' },
    { what: 'Sent an Invite to Apply to Choco', when: 'Sep 7, 2026 · 11:02 AM', type: 'Request' },
    { what: 'Posted an adoption story', when: 'Sep 26, 2026 · 9:00 AM', type: 'Feed' },
    { what: 'Updated Home Profile & lifestyle quiz', when: 'Sep 1, 2026 · 8:30 PM', type: 'Profile' },
    { what: 'Adopted Luna — became a Furparent', when: 'Jun 14, 2026 · 5:10 PM', type: 'Adoption' },
    { what: 'Password changed', when: 'May 2, 2026 · 7:00 PM', type: 'Security' },
  ],
}

export const verificationQueue = [
  { id: 'v1', name: 'Pepper', type: 'Pet', caretaker: 'Joy Lim', submitted: 'Sep 27, 9:14 AM', docs: 'Caretaker ID, vet record' },
  { id: 'v2', name: 'Carla Mendoza', type: 'Human', submitted: 'Sep 27, 8:02 AM', docs: 'Driver’s license' },
  { id: 'v3', name: 'Tofu', type: 'Pet', caretaker: 'Ben Yu', submitted: 'Sep 26, 6:40 PM', docs: 'Caretaker ID' },
  { id: 'v4', name: 'Rico Dela Paz', type: 'Human', submitted: 'Sep 26, 1:15 PM', docs: 'Passport', resubmitted: true },
]

export const reports = [
  { id: 'rep1', item: 'Post by “Buddy”', type: 'Post', reason: 'Selling pets', reporter: 'Ana Santos', count: 3, when: 'Sep 27',
    content: 'Shih Tzu puppies available! ₱8,000 each, first come first served. Message me.', account: 'Buddy (Pet)', prior: 0 },
  { id: 'rep2', item: 'Account “Max_Dealer”', type: 'Account', reason: 'Fake profile', reporter: 'Kulit', count: 5, when: 'Sep 26',
    content: 'Profile uses stock photos of 6 different dogs and asks for “reservation fees”.', account: 'Max_Dealer (Human)', prior: 2 },
  { id: 'rep3', item: 'Comment on Luna’s post', type: 'Comment', reason: 'Harassment', reporter: 'Marco Reyes', count: 1, when: 'Sep 25',
    content: '“Nobody should adopt cats, they’re useless.”', account: 'jp_89 (Human)', prior: 0 },
]

export const logs = [
  { who: 'admin.jess', what: 'Approved account “Kulit” (Pet)', when: 'Sep 27, 10:02 AM', why: 'Documents complete', target: 'Kulit', before: 'Pending Verification', after: 'Active', type: 'Verification' },
  { who: 'System', what: 'Request r1 → Meet Scheduled', when: 'Sep 26, 3:20 PM', why: 'Slot confirmed by both sides', target: 'Mochi → Ana Santos', before: 'Approved', after: 'Meet Scheduled', type: 'Status change' },
  { who: 'admin.jess', what: 'Denied account “Rico Dela Paz” (Human)', when: 'Sep 25, 11:40 AM', why: 'ID photo unreadable', target: 'Rico Dela Paz', before: 'Pending Verification', after: 'Denied', type: 'Verification' },
  { who: 'System', what: 'Request r2 → On Hold', when: 'Sep 24, 9:00 AM', why: 'Another request of the pet is in process', target: 'Mochi → Marco Reyes', before: 'Sent', after: 'On Hold', type: 'Status change' },
  { who: 'admin.mark', what: 'Suspended account “Max_Dealer”', when: 'Sep 23, 5:12 PM', why: '5 confirmed reports: fake profile', target: 'Max_Dealer', before: 'Active', after: 'Suspended', type: 'Account action' },
  { who: 'admin.mark', what: 'Removed post by “Buddy”', when: 'Sep 23, 5:02 PM', why: 'Selling pets is not allowed', target: 'Post #p91', before: 'Visible', after: 'Removed', type: 'Moderation' },
  { who: 'System', what: 'Pet “Mochi” → In Process', when: 'Sep 22, 6:40 PM', why: 'Ana Santos approved request r1', target: 'Mochi', before: 'Looking for a Home', after: 'In Process', type: 'Status change' },
  { who: 'admin.jess', what: 'Published announcement “Adoption Week”', when: 'Sep 25, 8:00 AM', why: 'Platform event', target: 'Everyone', before: '—', after: 'Published', type: 'Announcement' },
]

export const accounts = [
  ...['mochi', 'kulit', 'choco', 'bantay', 'miming', 'luna'].map((id) => ({ id, type: 'Pet' })),
  ...['santos', 'reyes', 'cruz', 'garcia'].map((id) => ({ id, type: 'Human' })),
  { id: 'maxdealer', type: 'Human', name: 'Max_Dealer', status: 'Suspended', label: '5 confirmed reports', city: 'Manila' },
]

export const statusHistory = [
  { when: 'Sep 13, 2026 · 2:48 PM', what: 'Signed up', status: 'Pending Verification', by: 'Owner' },
  { when: 'Sep 13, 2026 · 3:02 PM', what: 'Verification approved', status: 'Active', by: 'admin.jess' },
  { when: 'Sep 14, 2026 · 10:21 AM', what: 'Résumé published', status: 'Looking for a Home', by: 'System' },
  { when: 'Sep 22, 2026 · 6:40 PM', what: 'Request to Ana Santos approved', status: 'In Process', by: 'System' },
]

export const findPet = (id) => pets.find((p) => p.id === id)
export const findHome = (id) => homes.find((h) => h.id === id)
export const findAuthor = (id) => findPet(id) || findHome(id)
export const findAccount = (id) => {
  const a = accounts.find((x) => x.id === id)
  if (!a) return null
  const p = a.type === 'Pet' ? findPet(id) : findHome(id)
  return p
    ? { ...a, name: p.name, city: p.city, status: 'Active', label: a.type === 'Pet' ? p.status : (p.furparent ? 'Furparent' : 'Open to Adopt'), profile: p }
    : a
}
