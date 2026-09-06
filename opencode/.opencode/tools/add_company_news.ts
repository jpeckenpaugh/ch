import { tool } from "@opencode-ai/plugin";

export default tool({
  description:
    "Add one agent-discovered news article to a Company Hub company. Call once per article.",

  args: {
    company_id: tool.schema.number().int().positive().describe("The Company Hub company ID."),
    title: tool.schema.string().min(1).describe("The article headline."),
    source: tool.schema.string().min(1).describe("The publisher or news source."),
    url: tool.schema.string().url().describe("The article's canonical URL."),
    published_at: tool.schema
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.")
      .describe("The publication date in YYYY-MM-DD format."),
    summary: tool.schema.string().optional().describe("An optional concise article summary."),
  },

  async execute({ company_id, title, source, url, published_at, summary }, { directory }) {
    const tokenPath = `${directory}/.opencode/tools/.token`;
    const tokenFile = Bun.file(tokenPath);
    if (!(await tokenFile.exists())) {
      return `error: no saved token at ${tokenPath}; run get_token first`;
    }

    const token = (await tokenFile.text()).trim();
    if (!token) {
      return `error: saved token at ${tokenPath} is empty; run get_token first`;
    }

    const base = process.env.COMPANY_HUB_API_URL ?? "http://localhost:8000";
    const res = await fetch(`${base}/api/companies/${company_id}/news`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `session=${token}`,
      },
      body: JSON.stringify({ title, source, url, published_at, summary, is_scraped: true }),
    });

    if (!res.ok) {
      return `error: failed to add company news (${res.status}): ${await res.text()}`;
    }

    return JSON.stringify(await res.json());
  },
});
