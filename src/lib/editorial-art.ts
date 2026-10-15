export function editorialArt(tool: string, comparison = false) {
  if (!comparison && (tool === 'tarot' || tool === 'daily'))
    return '<div class="editorial-art-cards"><img src="/images/tarot/09-hermit.webp" width="96" height="160" loading="lazy" alt=""><img src="/images/tarot/17-star.webp" width="96" height="160" loading="lazy" alt=""></div>';
  const motif = comparison
    ? '<rect x="94" y="66" width="140" height="168" rx="5"/><rect x="366" y="66" width="140" height="168" rx="5"/><path d="M118 101h92m-92 23h68m-68 48h92m-92 23h78M390 101h92m-92 23h68m-68 48h92m-92 23h78M250 134h100m-12-10 12 10-12 10M350 166H250m12-10-12 10 12 10"/><circle cx="300" cy="150" r="78" opacity=".25"/>'
    : tool === 'bazi'
      ? '<g><rect x="130" y="70" width="65" height="160" rx="4"/><rect x="222" y="70" width="65" height="160" rx="4"/><rect x="314" y="70" width="65" height="160" rx="4"/><rect x="406" y="70" width="65" height="160" rx="4"/><path d="M130 150h65m27 0h65m27 0h65m27 0h65"/><circle cx="163" cy="110" r="13"/><circle cx="255" cy="190" r="13"/><circle cx="347" cy="110" r="13"/><circle cx="439" cy="190" r="13"/></g>'
      : tool === 'iching'
        ? Array.from(
            { length: 6 },
            (_, i) =>
              `<path d="M135 ${80 + i * 28}h${i % 3 === 0 ? '44m20 0h44' : '108'}M357 ${80 + i * 28}h${i % 2 === 0 ? '108' : '44m20 0h44'}" stroke-width="8"/>`,
          ).join('') + '<path d="M265 150h70m-13-12 13 12-13 12"/>'
        : tool === 'ziwei'
          ? '<rect x="194" y="44" width="212" height="212"/>' +
            Array.from(
              { length: 3 },
              (_, i) => `<path d="M${247 + i * 53} 44v53m0 106v53M194 ${97 + i * 53}h53m106 0h53"/>`,
            ).join('') +
            '<rect x="247" y="97" width="106" height="106"/><circle cx="300" cy="150" r="29"/>'
          : '<path d="M138 76q80-18 162 14 82-32 162-14v157q-82-18-162 14-80-32-162-14Z"/><path d="M300 90v157M166 112h102m-102 29h102m-102 29h74M332 112h102m-102 29h102m-102 29h74"/><circle cx="110" cy="150" r="14"/><circle cx="490" cy="150" r="14"/><path d="M83 150H62m476 0h-21"/>';
  return `<svg viewBox="0 0 600 300" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true" focusable="false"><g opacity=".22"><circle cx="230" cy="150" r="124"/><circle cx="370" cy="150" r="124"/><path d="M28 48V28h20m504 0h20v20M28 252v20h20m504 0h20v-20"/></g>${motif}</svg>`;
}
