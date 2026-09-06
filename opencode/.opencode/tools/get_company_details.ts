import { tool } from "@opencode-ai/plugin";

export default tool({
  description: "Get a Company Hub company's structured profile details.",
  args: { company_id: tool.schema.number().int().positive().describe("The Company Hub company ID.") },
  async execute({ company_id }, { directory }) {
    const tokenPath = `${directory}/.opencode/tools/.token`;
    const tokenFile = Bun.file(tokenPath);
    if (!(await tokenFile.exists())) return `error: no saved token at ${tokenPath}; run get_token first`;
    const token = (await tokenFile.text()).trim();
    if (!token) return `error: saved token at ${tokenPath} is empty; run get_token first`;
    const base = process.env.COMPANY_HUB_API_URL ?? "http://localhost:8000";
    const res = await fetch(`${base}/api/companies/${company_id}`, { headers: { Cookie: `session=${token}` } });
    if (!res.ok) return `error: failed to get company details (${res.status}): ${await res.text()}`;
    const company = (await res.json()) as Record<string, unknown>;
    const { id, name, industry, hq_location, website, contact_email, contact_phone, description, created_at, updated_at, is_complete, artifacts_count } = company;
    return JSON.stringify({ id, name, industry, hq_location, website, contact_email, contact_phone, description, created_at, updated_at, is_complete, artifacts_count });
  },
});
