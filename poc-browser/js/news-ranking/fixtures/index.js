const companies = [
  ["Toyota Motor", "Global vehicle manufacturer."], ["Samsung Electronics", "Consumer electronics and semiconductor company."],
  ["HSBC", "International banking and financial-services group."], ["Novartis", "Global medicines company."],
  ["Shell", "Global energy company."], ["Carrefour", "International food retailer."],
  ["Microsoft", "Technology company providing cloud software and AI products."], ["Spotify", "Audio streaming company."],
  ["Maersk", "Global integrated logistics company."], ["Nike", "Global athletic footwear and apparel company."],
];

function caseFor(index, [name, description]) {
  const day = String((index % 6) + 1).padStart(2, "0");
  const event = `${name} announces strategic expansion`;
  const candidates = [
    [1, event, "Reuters", `https://news.example/${index}/strategy?utm_source=fixture`, `The company announced a material expansion with concrete financial and operational details.`],
    [2, `${name} posts quarterly results`, "Financial Times", `https://news.example/${index}/results`, `Coverage of earnings, outlook, and management commentary.`],
    [3, `${name} executive speaks at industry conference`, "Company Press Room", `https://news.example/${index}/conference`, `A short event recap with limited new information.`],
    [4, `Competitor mentions ${name} in a market roundup`, "The Verge", `https://news.example/${index}/roundup`, `A tangential comparison rather than company news.`],
    [5, `${name} outlines strategic expansion plans`, "Associated Press", `https://news.example/${index}/strategy-syndicated`, `Syndicated coverage of the same expansion event.`],
    [6, `${name} opens a regional office`, "BBC", `https://news.example/${index}/office`, `A locally significant operational update.`],
    [7, `${name} product receives design award`, "Company Press Room", `https://news.example/${index}/award`, `A promotional announcement with little business impact.`],
    [8, `${name} partners on a new research initiative`, "Bloomberg", `https://news.example/${index}/research`, `A reported partnership with strategic implications.`],
    [9, `Opinion: What ${name} means for the sector`, "The Verge", `https://news.example/${index}/opinion`, `Commentary that discusses the sector more than the company.`],
    [10, `${name} names a new chief executive`, "Reuters", `https://news.example/${index}/ceo`, `A major leadership transition.`],
  ].map(([candidate_id, title, publisher, url, snippet], offset) => ({candidate_id, title, publisher, url, published_at: `2026-09-${String(Math.max(1, Number(day) - (offset % 4))).padStart(2, "0")}`, snippet}));
  return {
    id: `fixture-${index + 1}`,
    name: `${name} ranking set`,
    company: {name, description},
    existingNews: index % 2 ? [{title: `${name} enters new regional market`, published_at: "2026-08-30"}] : [],
    candidates,
    acceptableTop: [1, 2, 8, 10],
    obviousRejects: [4, 5, 7, 9],
  };
}

export const fixtures = Array.from({length: 20}, (_, index) => caseFor(index, companies[index % companies.length]));
export const fixtureById = (id) => fixtures.find((fixture) => fixture.id === id) ?? fixtures[0];
