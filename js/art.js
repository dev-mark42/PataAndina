/* Ilustraciones SVG animadas (se animan con CSS: cola, orejas, parpadeo, lengua). */
window.ART = {
  paw: () => `<svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="6" cy="10.5" rx="2" ry="2.6"/><ellipse cx="10" cy="6" rx="2" ry="2.6"/><ellipse cx="15" cy="6" rx="2" ry="2.6"/><ellipse cx="19" cy="10.5" rx="2" ry="2.6"/><path d="M12.5 11.5c-3.2 0-6.2 3.6-6.2 6.2 0 2 1.6 3.1 3.2 3.1 1.4 0 2-.7 3-.7s1.6.7 3 .7c1.600 0 3.200-1.100 3.200-3.100 0-2.600-3-6.200-6.200-6.200z"/></svg>`,
  /* Mascotas kawaii: ojos que siguen el puntero (.pupil), parpadeo, respiración, cola, alas. */
  cat: (c = '#e8a07c') => `<svg class="pet-svg cat" viewBox="0 0 200 200" role="img" aria-label="Gatito animado" data-say="¡Miau!">
    <path class="tail" d="M150 170c40 6 52-40 24-62" fill="none" stroke="${c}" stroke-width="15" stroke-linecap="round"/>
    <g class="breathe"><ellipse cx="100" cy="158" rx="50" ry="36" fill="${c}"/><ellipse cx="100" cy="168" rx="28" ry="24" fill="#fbe6d8"/>
    <ellipse cx="78" cy="190" rx="16" ry="8" fill="#fbe6d8"/><ellipse cx="122" cy="190" rx="16" ry="8" fill="#fbe6d8"/></g>
    <g class="headbob"><path class="ear-l" d="M44 70 40 18l44 24z" fill="${c}" stroke="${c}" stroke-width="8" stroke-linejoin="round"/><path class="ear-r" d="M156 70l4-52-44 24z" fill="${c}" stroke="${c}" stroke-width="8" stroke-linejoin="round"/>
    <path d="M48 58 47 32l22 12z M152 58l1-26-22 12z" fill="#f7b4a0"/>
    <ellipse cx="100" cy="108" rx="66" ry="56" fill="${c}"/>
    <path d="M82 56l3 16M100 52v18M118 56l-3 16" stroke="#c9774f" stroke-width="6" stroke-linecap="round"/>
    <g class="eye"><ellipse cx="72" cy="104" rx="15" ry="17" fill="#fff"/><circle class="pupil" cx="72" cy="106" r="10" fill="#2a3b34"/><circle cx="76" cy="100" r="4" fill="#fff"/><circle cx="68" cy="111" r="2" fill="#fff"/></g>
    <g class="eye"><ellipse cx="128" cy="104" rx="15" ry="17" fill="#fff"/><circle class="pupil" cx="128" cy="106" r="10" fill="#2a3b34"/><circle cx="132" cy="100" r="4" fill="#fff"/><circle cx="124" cy="111" r="2" fill="#fff"/></g>
    <ellipse cx="54" cy="126" rx="11" ry="7" fill="#ff8fa3" opacity=".55"/><ellipse cx="146" cy="126" rx="11" ry="7" fill="#ff8fa3" opacity=".55"/>
    <path d="M94 122h12l-6 7z" fill="#e0607e"/><path d="M100 129v5m-11 1c6 6 16 6 22 0" stroke="#7a3d2b" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M52 112 22 106M52 122 22 130M148 112l30-6M148 122l30 8" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".9"/></g></svg>`,
  dog: (c = '#e3bd8a') => `<svg class="pet-svg dog" viewBox="0 0 200 200" role="img" aria-label="Perrito animado" data-say="¡Guau!">
    <path class="tail" d="M146 168c34-6 46-38 30-64" fill="none" stroke="#b78652" stroke-width="16" stroke-linecap="round"/>
    <g class="breathe"><ellipse cx="100" cy="158" rx="50" ry="36" fill="${c}"/><ellipse cx="100" cy="168" rx="28" ry="24" fill="#fff4e4"/>
    <ellipse cx="78" cy="190" rx="16" ry="8" fill="#fff4e4"/><ellipse cx="122" cy="190" rx="16" ry="8" fill="#fff4e4"/></g>
    <g class="headbob"><path class="ear-l" d="M46 56c-34 4-40 54-18 72 18 6 34-20 36-52z" fill="#8a5a3c"/><path class="ear-r" d="M154 56c34 4 40 54 18 72-18 6-34-20-36-52z" fill="#8a5a3c"/>
    <ellipse cx="100" cy="106" rx="62" ry="56" fill="${c}"/><circle cx="66" cy="96" r="22" fill="#8a5a3c" opacity=".85"/>
    <ellipse cx="100" cy="128" rx="34" ry="26" fill="#fff4e4"/>
    <g class="eye"><ellipse cx="72" cy="100" rx="14" ry="16" fill="#fff"/><circle class="pupil" cx="72" cy="102" r="9.5" fill="#2a3b34"/><circle cx="76" cy="96" r="3.8" fill="#fff"/></g>
    <g class="eye"><ellipse cx="128" cy="100" rx="14" ry="16" fill="#fff"/><circle class="pupil" cx="128" cy="102" r="9.5" fill="#2a3b34"/><circle cx="132" cy="96" r="3.8" fill="#fff"/></g>
    <path d="M62 80l16-5M138 80l-16-5" stroke="#6a4430" stroke-width="5" stroke-linecap="round"/>
    <ellipse cx="50" cy="124" rx="10" ry="6.5" fill="#ff8fa3" opacity=".55"/><ellipse cx="150" cy="124" rx="10" ry="6.5" fill="#ff8fa3" opacity=".55"/>
    <ellipse cx="100" cy="116" rx="12" ry="8.5" fill="#33262a"/><ellipse cx="97" cy="113" rx="3.5" ry="2" fill="#fff" opacity=".6"/>
    <path d="M100 124v8m-14 0c7 7 21 7 28 0" stroke="#33262a" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path class="tongue" d="M93 136h14v16a7 7 0 0 1-14 0z" fill="#ef6f86"/></g></svg>`,
  bird: (c = '#4fa58a') => `<svg class="pet-svg bird" viewBox="0 0 200 200" role="img" aria-label="Pajarito animado" data-say="¡Pío pío!">
    <path d="M70 70l-14-30 22 12 6-26 12 24" fill="none" stroke="#f3c74a" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" class="tuft"/>
    <path class="tail" d="M120 160l40 30-8-38z" fill="#2f7d63" transform-origin="120 160"/>
    <g class="breathe"><ellipse cx="100" cy="128" rx="58" ry="60" fill="${c}"/><ellipse cx="100" cy="146" rx="34" ry="38" fill="#e9f6ec"/></g>
    <path class="wing" d="M142 112c30 4 38 40 14 56-18-6-30-30-14-56z" fill="#2f7d63"/>
    <g class="headbob"><circle cx="100" cy="86" r="46" fill="${c}"/>
    <g class="eye"><circle cx="80" cy="82" r="13" fill="#fff"/><circle class="pupil" cx="80" cy="84" r="8.5" fill="#2a3b34"/><circle cx="83" cy="79" r="3.4" fill="#fff"/></g>
    <g class="eye"><circle cx="122" cy="82" r="13" fill="#fff"/><circle class="pupil" cx="122" cy="84" r="8.5" fill="#2a3b34"/><circle cx="125" cy="79" r="3.4" fill="#fff"/></g>
    <ellipse cx="62" cy="100" rx="9" ry="6" fill="#ff8fa3" opacity=".6"/><ellipse cx="140" cy="100" rx="9" ry="6" fill="#ff8fa3" opacity=".6"/>
    <path d="M90 96l11 4 11-4-11 18z" fill="#f08a3c" stroke="#d96f24" stroke-width="2" stroke-linejoin="round"/></g>
    <path d="M84 184v-14m32 14v-14M78 188h14m18 0h14" stroke="#f08a3c" stroke-width="5" stroke-linecap="round"/></svg>`,
  other: () => `<svg class="pet-svg" viewBox="0 0 100 100" role="img" aria-label="Mascota"><circle cx="50" cy="50" r="40" fill="#e8f1ea"/><g fill="#315d4d"><ellipse cx="34" cy="48" rx="6" ry="8"/><ellipse cx="46" cy="36" rx="6" ry="8"/><ellipse cx="60" cy="36" rx="6" ry="8"/><ellipse cx="72" cy="48" rx="6" ry="8"/><path d="M53 54c-12 0-22 12-22 21 0 7 6 10 11 10 5 0 7-3 11-3s6 3 11 3c5 0 11-3 11-10 0-9-10-21-22-21z"/></g></svg>`,

  forSpecies(s) { return s === 'gato' ? this.cat() : s === 'perro' ? this.dog() : s === 'ave' ? this.bird() : this.other(); },
  ecg: () => `<svg viewBox="0 0 340 60" fill="none"><path class="ecg" d="M0 32h70l12-22 14 44 14-34 10 12h220" stroke="#f3dccf" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  empty: () => `<svg viewBox="0 0 120 90" fill="none"><ellipse cx="60" cy="80" rx="40" ry="6" fill="rgba(0,0,0,.08)"/><g class="bob"><circle cx="60" cy="42" r="26" fill="#e8f1ea"/><text x="60" y="54" font-size="32" text-anchor="middle">🐾</text></g></svg>`
};
