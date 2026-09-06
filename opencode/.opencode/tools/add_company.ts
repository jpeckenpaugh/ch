import { tool } from "@opencode-ai/plugin";

export default tool({
  description: "Create a new Company Hub company with a required name and optional structured details.",
  args: {
    name: tool.schema.string().min(1).describe("The company name."),
    industry_id: tool.schema.number().int().positive().optional().describe("The ID of the company's industry."),
    website: tool.schema.string().min(1).optional().describe("The company's website."),
    contact_email: tool.schema.string().min(1).optional().describe("The primary contact email."),
    contact_phone: tool.schema.string().min(1).optional().describe("The primary contact phone number."),
    description: tool.schema.string().min(1).optional().describe("A company description."),
  },
  async execute({ name, industry_id, website, contact_email, contact_phone, description }, { directory }) {
    const tokenPath = `${directory}/.opencode/tools/.token`;
    const tokenFile = Bun.file(tokenPath);
    if (!(await tokenFile.exists())) return `error: no saved token at ${tokenPath}; run get_token first`;
    const token = (await tokenFile.text()).trim();
    if (!token) return `error: saved token at ${tokenPath} is empty; run get_token first`;
    const base = process.env.COMPANY_HUB_API_URL ?? "http://localhost:8000";
    const res = await fetch(`${base}/api/companies`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `session=${token}` },
      body: JSON.stringify({ name, industry_id, website, contact_email, contact_phone, description }),
    });
    if (!res.ok) return `error: failed to add company (${res.status}): ${await res.text()}`;
    return JSON.stringify(await res.json());
  },
});
