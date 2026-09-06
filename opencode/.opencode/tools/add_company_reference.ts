import { tool } from "@opencode-ai/plugin";

export default tool({
  description: "Add one curated reference link to a Company Hub company.",
  args: {
    company_id: tool.schema.number().int().positive().describe("The Company Hub company ID."),
    title: tool.schema.string().min(1).describe("The reference title."),
    url: tool.schema.string().url().describe("The reference URL."),
    description: tool.schema.string().optional().describe("An optional description of the reference."),
  },
  async execute({ company_id, title, url, description }, { directory }) {
    const tokenPath = `${directory}/.opencode/tools/.token`;
    const tokenFile = Bun.file(tokenPath);
    if (!(await tokenFile.exists())) return `error: no saved token at ${tokenPath}; run get_token first`;
    const token = (await tokenFile.text()).trim();
    if (!token) return `error: saved token at ${tokenPath} is empty; run get_token first`;
    const base = process.env.COMPANY_HUB_API_URL ?? "http://localhost:8000";
    const res = await fetch(`${base}/api/companies/${company_id}/references`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `session=${token}` },
      body: JSON.stringify({ title, url, description }),
    });
    if (!res.ok) return `error: failed to add company reference (${res.status}): ${await res.text()}`;
    return JSON.stringify(await res.json());
  },
});
