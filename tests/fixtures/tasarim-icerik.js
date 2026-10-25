// Ekran görüntüleri için örnek içerik: onaylanan tasarımdaki (ontwerp/) örnekler.
// Uydurma örneklerdir, caminin gerçek programı değildir (ontwerp/README.md).
const bos = { tr: '', nl: '', en: '' };
const m = (tr, nl = '', en = '') => ({ tr, nl, en });
const f = (id, grup, baslik, baslangic, bitis, yer, ek = {}) => ({
  id, grup, baslik, aciklama: bos, baslangic, bitis, tumGun: false, yer, resim: '', link: '', oneCikan: false, yayinda: true, ...ek,
});
const p = (id, grup, baslik, gunler, saat, yer, ek = {}) => ({
  id, grup, baslik, aciklama: bos, gunler, saat, yer, hoca: '', gecerliBaslangic: null, gecerliBitis: null, aktif: true, ...ek,
});
const sabit = (baslangic, bitis) => ({ tip: 'sabit', baslangic, bitis });
const vakit = (v, fark, sure) => ({ tip: 'vakit', vakit: v, fark, sure });

export function tasarimIcerik() {
  return {
    guncelleme: '2026-10-28T09:00:00.000Z',
    faaliyetler: [
      f('f-kahvalti', 'herkes', m('Aile Kahvaltısı', 'Familieontbijt', 'Family breakfast'), '2026-10-31T10:00', '2026-10-31T12:30', 'Konferans salonu', {
        oneCikan: true,
        aciklama: m('Bütün cemaati aile kahvaltısına davet ediyoruz. (Örnek metin.)', 'Iedereen is welkom bij het familieontbijt. (Voorbeeldtekst.)', ''),
        link: 'https://example.org/kahvalti',
      }),
      f('f-genclik', 'genclik', m('Gençlik Buluşması', 'Jongerenavond', 'Youth evening'), '2026-11-07T19:30', null, 'Konferans salonu'),
      f('f-kermes', 'herkes', m('Kermes', 'Bazaar', 'Charity bazaar'), '2026-11-15T11:00', '2026-11-15T17:00', 'Cami avlusu'),
      f('f-hanimlar', 'hanimlar', m('Hanımlar Sohbeti', 'Vrouwenbijeenkomst', 'Women’s gathering'), '2026-11-21T14:00', null, 'Kadınlar bölümü'),
      f('f-yarisma', 'cocuklar', m('Çocuklar Kur’an Yarışması', 'Koranwedstrijd voor kinderen', 'Children’s Quran contest'), '2026-11-22T13:00', null, 'Ana salon'),
      f('f-taslak', 'erkekler', m('Taslak (görünmemeli)'), '2026-11-10T19:00', null, '', { yayinda: false }),
    ],
    programlar: [
      p('p-kurs', 'cocuklar', m('Kur’an kursu', 'Koranles', 'Quran class'), [1, 2, 3, 4], sabit('17:00', '19:00'), 'Sınıflar · 7–14 yaş'),
      p('p-tefsir', 'erkekler', m('Tefsir dersi', 'Tafsirles', 'Tafsir lesson'), [1], vakit('Isha', 30, 60), 'Ana salon'),
      p('p-hanim', 'hanimlar', m('Hanımlar Kur’an dersi', 'Koranles voor vrouwen', 'Quran lesson for women'), [2], sabit('10:30', '12:00'), 'Kadınlar bölümü'),
      p('p-genc', 'genclik', m('Gençlik sohbeti', 'Jongerenbijeenkomst', 'Youth talk'), [3, 6], sabit('19:30', '21:00'), 'Gençlik odası · 15–25 yaş'),
      p('p-hadis', 'erkekler', m('Hadis dersi', 'Hadithles', 'Hadith lesson'), [4], vakit('Isha', 30, 60), 'Ana salon'),
      p('p-cuma', 'herkes', m('Cuma namazı ve hutbe', 'Vrijdaggebed en preek', 'Friday prayer and sermon'), [5], vakit('Dhuhr', 0, 60), 'Ana salon · hutbe özeti Nederlands'),
      p('p-hskurs', 'cocuklar', m('Hafta sonu Kur’an kursu', 'Weekend-Koranles', 'Weekend Quran class'), [6, 7], sabit('10:00', '13:00'), 'Sınıflar · 7–14 yaş'),
      p('p-ilmihal', 'hanimlar', m('İlmihal dersi', 'Ilmihal-les', 'Ilmihal lesson'), [6], sabit('14:00', '15:30'), 'Kadınlar bölümü'),
      p('p-hafiz', 'cocuklar', m('Hafızlık hazırlık', 'Hafiz-voorbereiding', 'Hafiz preparation'), [7], sabit('14:00', '16:00'), 'Sınıf 3'),
    ],
  };
}
