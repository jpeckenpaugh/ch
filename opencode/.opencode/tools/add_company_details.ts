import { tool } from "@opencode-ai/plugin";

export default tool({
  description: "Add or update one or more company details without overwriting unspecified fields.",
  args: {
    company_id: tool.schema.number().int().positive().describe("The Company Hub company ID."),
    name: tool.schema.string().min(1).optional().describe("The company name."),
    industry_id: tool.schema.number().int().positive().optional().describe("The ID of the company's industry."),
    website: tool.schema.string().min(1).optional().describe("The company's website."),
    contact_email: tool.schema.string().min(1).optional().describe("The primary contact email."),
    contact_phone: tool.schema.string().min(1).optional().describe("The primary contact phone number."),
    description: tool.schema.string().min(1).optional().describe("A company description."),
  },
  async execute({ company_id, name, industry_id, website, contact_email, contact_phone, description }, { directory }) {
    if ([name, industry_id, website, contact_email, contact_phone, description].every((value) => value === undefined)) {
      return "error: provide at least one company detail to update";
    }
    const tokenPath = `${directory}/.opencode/tools/.token`;
    const tokenFile = Bun.file(tokenPath);
    if (!(await tokenFile.exists())) return `error: no saved token at ${tokenPath}; run get_token first`;
    const token = (await tokenFile.text()).trim();
    if (!token) return `error: saved token at ${tokenPath} is empty; run get_token first`;
    const base = process.env.COMPANY_HUB_API_URL ?? "http://localhost:8000";
    const existingResponse = await fetch(`${base}/api/companies/${company_id}`, { headers: { Cookie: `session=${token}` } });
    if (!existingResponse.ok) return `error: failed to get company details (${existingResponse.status}): ${await existingResponse.text()}`;
    const existing = (await existingResponse.json()) as {
      name: string;
      industry?: { id: number } | null;
      website?: string | null;
      contact_email?: string | null;
      contact_phone?: string | null;
      description?: string | null;
    };
    const payload = {
      name: name ?? existing.name,
      industry_id: industry_id ?? existing.industry?.id ?? null,
      website: website ?? existing.website ?? null,
      contact_email: contact_email ?? existing.contact_email ?? null,
      contact_phone: contact_phone ?? existing.contact_phone ?? null,
      description: description ?? existing.description ?? null,
    };
    const res = await fetch(`${base}/api/companies/${company_id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: `session=${token}` },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return `error: failed to update company details (${res.status}): ${await res.text()}`;
    return JSON.stringify(await res.json());
  },
});
