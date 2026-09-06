import { tool } from "@opencode-ai/plugin";

export default tool({
  description: "Add one location to a Company Hub company.",
  args: {
    company_id: tool.schema.number().int().positive().describe("The Company Hub company ID."),
    label: tool.schema.string().min(1).describe("The location label."),
    city: tool.schema.string().min(1).describe("The city."),
    country_code: tool.schema.string().length(2).describe("The two-letter country code, for example US."),
    type: tool.schema.enum(["Headquarters", "Office", "Plant", "Other"]).describe("The location type."),
    address: tool.schema.string().optional().describe("An optional street address or region."),
  },
  async execute({ company_id, label, city, country_code, type, address }, { directory }) {
    const tokenPath = `${directory}/.opencode/tools/.token`;
    const tokenFile = Bun.file(tokenPath);
    if (!(await tokenFile.exists())) return `error: no saved token at ${tokenPath}; run get_token first`;
    const token = (await tokenFile.text()).trim();
    if (!token) return `error: saved token at ${tokenPath} is empty; run get_token first`;
    const base = process.env.COMPANY_HUB_API_URL ?? "http://localhost:8000";
    const res = await fetch(`${base}/api/companies/${company_id}/locations`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `session=${token}` },
      body: JSON.stringify({ label, city, country_code: country_code.toUpperCase(), type, address }),
    });
    if (!res.ok) return `error: failed to add company location (${res.status}): ${await res.text()}`;
    return JSON.stringify(await res.json());
  },
});
