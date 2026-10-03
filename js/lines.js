// ── What she says ────────────────────────────────────────────
// Short lines keyed by situation. Data only; behavior.js picks and paces them.
// {name} is her name, {item} an item's name, {wish} a style wish.

export const LINES = {
  greetMorning: ['Good morning! Did you sleep well?', 'Morning! I picked out something cute, see?', 'Ah, you are up early. Hi!'],
  greetDay: ['Hi hi! I missed you.', 'Oh! You came to see me.', 'Hello! Want to play dress-up?'],
  greetEvening: ['Good evening! How was your day?', 'Welcome back. I kept the room tidy.', 'Evening! Perfect time for a new outfit.'],
  greetNight: ['It is late... but I am happy you are here.', 'Hi! Shh, everyone else is asleep.', 'Night owl, huh? Me too.'],
  greetAway: ['You came back! It has been a while.', 'There you are! I waited by the window.'],
  pat: ['Ehehe~', 'Mmh, that is nice...', 'More, please.', 'You always know what to do.', 'Hehe, my hair is getting messy!'],
  patAsleep: ['...mmh... five more minutes...', '...ehehe...'],
  pokeBody: ['Hey! That tickles!', 'Eep!', 'Hehe, what was that for?'],
  pokeCheek: ['Mou!', 'My cheek is not a button!', 'Puffff.'],
  pokeTooMuch: ['Hmph. I am ignoring you now.', 'Okay, that is enough poking!', 'You are being a pest!'],
  lifted: ['Whoa!', 'Wah, where are we going?', 'Hey, put me down! ...Actually, this is fun.'],
  landed: ['Oof!', 'Hehe, again?', 'The world is spinning a little.'],
  wake: ['Hm? Oh! I was not sleeping. Really.', 'Waaah, you startled me!', 'Mmh... is it morning?'],
  sleepy: ['*yawn*', 'I am getting a little sleepy...', 'Just resting my eyes...'],
  dressed: ['Ooh, I love it!', 'How do I look?', 'This one is so soft!', 'Cute, right?', 'You have good taste.'],
  dressedTag: {
    beach: 'Smells like sunscreen already!',
    cozy: 'So warm. I could nap in this.',
    party: 'Let us go dancing!',
    picnic: 'Did someone say sandwiches?',
    rainy: 'Bring on the puddles!',
    elegant: 'Do I look grown-up?',
    sporty: 'Ready to run! Maybe. Later.',
    night: 'Perfect for stargazing.',
    sweet: 'Sweet like a strawberry.',
  },
  undressed: ['Back in the wardrobe it goes.', 'Okay, maybe something else.'],
  unlocked: ['A new one! Thank you!', 'Yay! Can I try it on?', 'For me? You are the best.'],
  posed: ['Like this?', 'Hehe, take a picture!', 'Is my good side showing?', 'Ta-da!'],
  twirl: ['Wheee!', 'Look at it spin!', 'One more time!'],
  idleHum: ['La la la~', 'Hmm hmm hmm~'],
  idleThink: ['I wonder what is for dinner.', 'Do clouds have feelings?', 'Hmm... a ribbon or a hat?'],
  idleOutfit: ['I really like this outfit.', 'Should I change my hair?'],
  wish: ['I would love {wish}!', 'Could you dress me for {wish}?', 'Ooh, I feel like {wish} today.'],
  wishDone: ['Perfect! This is exactly it!', 'You read my mind!', 'I love it so much!'],
  gift: ['I found something for you! Well, for me. For us!', 'Surprise! A little present appeared in the wardrobe.'],
  giftHearts: ['I saved these up for you!'],
  milestone: ['Something new unlocked!'],
  named: ['{name}... I like it!', 'From now on, call me {name}!'],
  look: ['Saved! We can come back to this one.'],
  snapshot: ['Say cheese!', 'Did you get my good side?'],
};

/** Style wishes: what she asks for, and how many matching pieces satisfy it. */
export const WISHES = [
  { tag: 'beach', label: 'a day at the beach', need: 2 },
  { tag: 'cozy', label: 'something cozy for a lazy day', need: 2 },
  { tag: 'party', label: 'a party look', need: 3 },
  { tag: 'picnic', label: 'a picnic in the park', need: 2 },
  { tag: 'rainy', label: 'a walk in the rain', need: 2 },
  { tag: 'elegant', label: 'an elegant evening', need: 3 },
  { tag: 'sporty', label: 'something sporty', need: 2 },
  { tag: 'night', label: 'a night under the stars', need: 2 },
  { tag: 'sweet', label: 'something extra sweet', need: 3 },
];

export function pick(list, vars = {}) {
  const s = list[Math.floor(Math.random() * list.length)] || '';
  return s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
}
