// ── Rooms ────────────────────────────────────────────────────
// Backdrops are drawn art in a 1000 x 820 box, cropped to the stage like a
// background image (xMidYMax slice). A time-of-day wash sits over each.

export const BACKDROPS = [
  { id: 'dreamy', name: 'Dreamy' },
  { id: 'bedroom', name: 'Bedroom' },
  { id: 'beach', name: 'Beach' },
  { id: 'sakura', name: 'Sakura park' },
];

const STARS = [[90, 80], [180, 160], [260, 60], [340, 210], [420, 110], [560, 70], [640, 180], [720, 90], [820, 150], [900, 60], [950, 230], [130, 280], [870, 300]];

function stars(color = '#fff', n = STARS.length) {
  return STARS.slice(0, n).map(([x, y], i) =>
    `<circle class="bj-twinkle" style="animation-delay:${(i * 0.37) % 3}s" cx="${x}" cy="${y}" r="${1.4 + (i % 3) * 0.7}" fill="${color}"/>`).join('');
}

const ROOMS = {
  dreamy: () => `
    <defs><linearGradient id="bg-dreamy" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a1f52"/><stop offset=".55" stop-color="#7a58b0"/><stop offset="1" stop-color="#f0c0e6"/></linearGradient></defs>
    <rect width="1000" height="820" fill="url(#bg-dreamy)"/>${stars()}
    <g fill="#fff" opacity=".22"><ellipse cx="160" cy="430" rx="160" ry="40"/><ellipse cx="300" cy="400" rx="110" ry="34"/><ellipse cx="820" cy="380" rx="180" ry="42"/><ellipse cx="690" cy="410" rx="100" ry="30"/></g>
    <circle cx="820" cy="150" r="46" fill="#fff6d8"/><circle cx="840" cy="138" r="40" fill="#5a3f8f" opacity=".85"/>
    <ellipse cx="500" cy="812" rx="560" ry="90" fill="#f7d4ee" opacity=".55"/>`,
  bedroom: () => `
    <rect width="1000" height="820" fill="#f6dfe8"/>
    <rect y="0" width="1000" height="640" fill="#f3d3e2"/>
    <g fill="#fff" opacity=".35">${[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => `<rect x="${i * 120 + 30}" y="0" width="40" height="640"/>`).join('')}</g>
    <rect y="640" width="1000" height="180" fill="#d9b49a"/><rect y="636" width="1000" height="10" fill="#b98f73"/>
    <g transform="translate(690 120)"><rect width="220" height="250" rx="14" fill="#9fd0f0" stroke="#fff" stroke-width="14"/><path d="M110 0V250M0 125H220" stroke="#fff" stroke-width="8"/><circle cx="160" cy="70" r="26" fill="#fff6c8"/>
      <path d="M-20 -10Q40 120 -10 270L-40 270L-40 -10Z" fill="#ffb3cf"/><path d="M240 -10Q180 120 230 270L260 270L260 -10Z" fill="#ffb3cf"/></g>
    <g transform="translate(70 300)"><rect width="200" height="16" fill="#c79a7a"/><rect x="20" y="-56" width="30" height="56" fill="#9b7fd0"/><rect x="56" y="-44" width="24" height="44" fill="#ffb36b"/><circle cx="130" cy="-24" r="24" fill="#ffd1e3"/><circle cx="122" cy="-28" r="3" fill="#3a2a44"/><circle cx="138" cy="-28" r="3" fill="#3a2a44"/></g>
    <ellipse cx="500" cy="760" rx="330" ry="58" fill="#c9b6ec" opacity=".7"/>`,
  beach: () => `
    <defs><linearGradient id="bg-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7cc6f2"/><stop offset="1" stop-color="#d9f1ff"/></linearGradient></defs>
    <rect width="1000" height="820" fill="url(#bg-sky)"/>
    <circle cx="820" cy="140" r="56" fill="#fff1a8"/>
    <g fill="#fff" opacity=".85"><ellipse cx="200" cy="140" rx="70" ry="22"/><ellipse cx="250" cy="125" rx="50" ry="20"/><ellipse cx="560" cy="200" rx="80" ry="20"/></g>
    <rect y="470" width="1000" height="180" fill="#3fb0d8"/><path d="M0 470Q125 455 250 470T500 470T750 470T1000 470V490H0Z" fill="#7dd3ef"/>
    <path d="M0 600Q250 580 500 600T1000 600V820H0Z" fill="#f6dfae"/><path d="M0 600Q250 580 500 600T1000 600" fill="none" stroke="#fff" stroke-width="10" opacity=".8"/>
    <g transform="translate(130 430)"><path d="M0 230L10 0" stroke="#8a6a4a" stroke-width="7"/><path d="M-110 30Q10 -70 130 30Z" fill="#ff8fb8"/><path d="M-110 30Q-50 -20 10 -24Q-10 0 -40 30Z" fill="#fff"/></g>`,
  sakura: () => `
    <defs><linearGradient id="bg-park" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#bfe3ff"/><stop offset="1" stop-color="#fbe8f2"/></linearGradient></defs>
    <rect width="1000" height="820" fill="url(#bg-park)"/>
    <path d="M0 560Q250 520 500 550T1000 540V820H0Z" fill="#a8dca0"/><path d="M0 640Q300 610 600 640T1000 630V820H0Z" fill="#8fcf88"/>
    ${[[120, 330, 1], [880, 300, 1.15], [520, 380, 0.7]].map(([x, y, k]) => `<g transform="translate(${x} ${y}) scale(${k})"><path d="M-10 260L-6 40L6 40L12 260Z" fill="#8a5a4a"/><g fill="#ffb7d5"><circle cx="0" cy="0" r="90"/><circle cx="-80" cy="40" r="60"/><circle cx="80" cy="40" r="66"/><circle cx="0" cy="-70" r="60"/></g><g fill="#ffd3e5"><circle cx="-30" cy="-20" r="36"/><circle cx="50" cy="10" r="30"/></g></g>`).join('')}
    <g fill="#ffc4dc">${[[300, 120], [420, 260], [650, 160], [760, 420], [240, 470], [580, 300]].map(([x, y], i) => `<ellipse class="bj-petal" style="animation-delay:${i * 0.9}s" cx="${x}" cy="${y}" rx="6" ry="4"/>`).join('')}</g>`,
};

/** A soft wash for the hour: warm at dusk, deep blue at night. */
function wash(hour) {
  if (hour >= 6 && hour < 17) return '';
  if (hour >= 17 && hour < 20) return '<rect width="1000" height="820" fill="#ff9a6a" opacity=".16"/>';
  return '<rect width="1000" height="820" fill="#1a1450" opacity=".32"/>';
}

export function drawBackdrop(svg, id, hour = new Date().getHours()) {
  svg.setAttribute('viewBox', '0 0 1000 820');
  svg.innerHTML = (ROOMS[id] || ROOMS.dreamy)() + wash(hour);
}
