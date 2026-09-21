import el from '../src/i18n/el.json';
import en from '../src/i18n/en.json';

// The Home strip lists the curated catalogue, which no language model wrote.
// Its strings must not claim otherwise, and the one AI action must say it is AI.
describe.each([
  ['el', el],
  ['en', en],
])('home.aiRoutes strings (%s)', (_lang, strings) => {
  const s = strings.home.aiRoutes;

  it('does not label the curated list as AI', () => {
    expect(s.title).not.toMatch(/AI/);
    expect(s.subtitle).not.toMatch(/AI/);
  });

  it('says the create action uses AI', () => {
    expect(s.generate).toMatch(/AI/);
  });

  it('explains that the model never decides accessibility', () => {
    expect(s.explainBody).toMatch(/OSRM/);
    expect(s.explainBody).toMatch(/AI/);
  });
});

it('el and en define the same home.aiRoutes keys', () => {
  expect(Object.keys(el.home.aiRoutes).sort()).toEqual(Object.keys(en.home.aiRoutes).sort());
});
