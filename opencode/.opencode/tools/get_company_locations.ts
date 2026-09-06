import { tool } from "@opencode-ai/plugin";

export default tool({
  description: "List all locations for a Company Hub company.",
  args: { company_id: tool.schema.number().int().positive().describe("The Company Hub company ID.") },
  async execute({ company_id }, { directory }) {
    const tokenPath = `${directory}/.opencode/tools/.token`;
    const tokenFile = Bun.file(tokenPath);
    if (!(await tokenFile.exists())) return `error: no saved token at ${tokenPath}; run get_token first`;
    const token = (await tokenFile.text()).trim();
    if (!token) return `error: saved token at ${tokenPath} is empty; run get_token first`;
    const base = process.env.COMPANY_HUB_API_URL ?? "http://localhost:8000";
    const res = await fetch(`${base}/api/companies/${company_id}`, { headers: { Cookie: `session=${token}` } });
    if (!res.ok) return `error: failed to get company locations (${res.status}): ${await res.text()}`;
    const company = (await res.json()) as { locations?: unknown[] };
    return JSON.stringify(company.locations ?? []);
  },
});
