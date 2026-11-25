/* Ilustraciones SVG animadas (se animan con CSS: cola, orejas, parpadeo, lengua). */
window.ART = {
  paw: () => `<svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="6" cy="10.5" rx="2" ry="2.6"/><ellipse cx="10" cy="6" rx="2" ry="2.6"/><ellipse cx="15" cy="6" rx="2" ry="2.6"/><ellipse cx="19" cy="10.5" rx="2" ry="2.6"/><path d="M12.5 11.5c-3.2 0-6.2 3.6-6.2 6.2 0 2 1.6 3.1 3.2 3.1 1.4 0 2-.7 3-.7s1.6.7 3 .7c1.600 0 3.200-1.100 3.200-3.100 0-2.600-3-6.200-6.200-6.200z"/></svg>`,
  cat: (c = '#cf8265') => `<svg class="pet-svg cat" viewBox="0 0 160 170" role="img" aria-label="Gato animado" data-say="¡Miau!">
    <path class="tail" d="M118 150c34 2 44-34 22-52" fill="none" stroke="${c}" stroke-width="13" stroke-linecap="round"/>
    <ellipse cx="80" cy="132" rx="42" ry="34" fill="${c}"/><ellipse cx="80" cy="140" rx="24" ry="22" fill="#f3dccf"/>
    <path class="ear-l" d="M36 58 30 14l36 20z" fill="${c}"/><path class="ear-r" d="M124 58l6-44-36 20z" fill="${c}"/>
    <path d="M38 50 36 26l16 10z M122 50l2-24-16 10z" fill="#f3b9a2"/>
    <circle cx="80" cy="70" r="44" fill="${c}"/>
    <path d="M62 34l4 14M80 28v16M98 34l-4 14" stroke="#a85f45" stroke-width="5" stroke-linecap="round"/>
    <g class="eye"><ellipse cx="62" cy="68" rx="7" ry="9" fill="#204437"/><circle cx="64" cy="65" r="2.5" fill="#fff"/></g>
    <g class="eye"><ellipse cx="98" cy="68" rx="7" ry="9" fill="#204437"/><circle cx="100" cy="65" r="2.5" fill="#fff"/></g>
    <path d="M75 82h10l-5 6z" fill="#7a3d2b"/><path d="M80 88v5m-9 1c5 5 13 5 18 0" stroke="#7a3d2b" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    <path d="M44 82 20 78M44 90 20 94M116 82l24-4M116 90l24 4" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".8"/>
    <ellipse cx="66" cy="160" rx="13" ry="7" fill="#f3dccf"/><ellipse cx="94" cy="160" rx="13" ry="7" fill="#f3dccf"/></svg>`,
  dog: (c = '#e6cfa7') => `<svg class="pet-svg dog" viewBox="0 0 170 170" role="img" aria-label="Perro animado" data-say="¡Guau!">
    <path class="tail" d="M122 140c28-8 38-34 26-56" fill="none" stroke="#a87a4d" stroke-width="14" stroke-linecap="round"/>
    <ellipse cx="82" cy="134" rx="44" ry="34" fill="${c}"/><ellipse cx="82" cy="142" rx="24" ry="20" fill="#fbfaf6"/>
    <path class="ear-l" d="M38 42c-26 4-30 44-14 58 14 6 26-14 28-34z" fill="#8a5a3c"/>
    <path class="ear-r" d="M126 42c26 4 30 44 14 58-14 6-26-14-28-34z" fill="#8a5a3c"/>
    <circle cx="82" cy="72" r="44" fill="${c}"/>
    <ellipse cx="82" cy="88" rx="26" ry="20" fill="#fbfaf6"/>
    <g class="eye"><circle cx="63" cy="66" r="7" fill="#204437"/><circle cx="65" cy="63" r="2.4" fill="#fff"/></g>
    <g class="eye"><circle cx="101" cy="66" r="7" fill="#204437"/><circle cx="103" cy="63" r="2.4" fill="#fff"/></g>
    <path d="M56 54l14-4M108 54l-14-4" stroke="#8a5a3c" stroke-width="4" stroke-linecap="round"/>
    <ellipse cx="82" cy="80" rx="10" ry="7" fill="#3a2a22"/>
    <path d="M82 87v6m-12 0c6 6 18 6 24 0" stroke="#3a2a22" stroke-width="2.6" fill="none" stroke-linecap="round"/>
    <path class="tongue" d="M76 96h12v14a6 6 0 0 1-12 0z" fill="#e87a8a"/>
    <ellipse cx="66" cy="162" rx="14" ry="7" fill="#fbfaf6"/><ellipse cx="98" cy="162" rx="14" ry="7" fill="#fbfaf6"/></svg>`,
  other: () => `<svg class="pet-svg" viewBox="0 0 100 100" role="img" aria-label="Mascota"><circle cx="50" cy="50" r="40" fill="#e8f1ea"/><text x="50" y="64" font-size="44" text-anchor="middle">🐾</text></svg>`,
  forSpecies(s) { return s === 'gato' ? this.cat() : s === 'perro' ? this.dog() : this.other(); },
  ecg: () => `<svg viewBox="0 0 340 60" fill="none"><path class="ecg" d="M0 32h70l12-22 14 44 14-34 10 12h220" stroke="#f3dccf" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  empty: () => `<svg viewBox="0 0 120 90" fill="none"><ellipse cx="60" cy="80" rx="40" ry="6" fill="rgba(0,0,0,.08)"/><g class="bob"><circle cx="60" cy="42" r="26" fill="#e8f1ea"/><text x="60" y="54" font-size="32" text-anchor="middle">🐾</text></g></svg>`
};
