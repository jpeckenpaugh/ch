import { tool } from "@opencode-ai/plugin";

export default tool({
  description: "Get the logo URL for a Company Hub company, if it has one.",
  args: { company_id: tool.schema.number().int().positive().describe("The Company Hub company ID.") },
  async execute({ company_id }, { directory }) {
    const tokenPath = `${directory}/.opencode/tools/.token`;
    const tokenFile = Bun.file(tokenPath);
    if (!(await tokenFile.exists())) return `error: no saved token at ${tokenPath}; run get_token first`;
    const token = (await tokenFile.text()).trim();
    if (!token) return `error: saved token at ${tokenPath} is empty; run get_token first`;
    const base = process.env.COMPANY_HUB_API_URL ?? "http://localhost:8000";
    const res = await fetch(`${base}/api/companies/${company_id}`, { headers: { Cookie: `session=${token}` } });
    if (!res.ok) return `error: failed to get company logo (${res.status}): ${await res.text()}`;
    const company = (await res.json()) as { logo_url?: string | null };
    return JSON.stringify({ company_id, logo_url: company.logo_url ?? null });
  },
});
