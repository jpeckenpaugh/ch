import { tool } from "@opencode-ai/plugin";

export default tool({
  description: "List Company Hub companies as IDs and names using the saved session token.",

  args: {},

  async execute(_args, { directory }) {
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
    const res = await fetch(`${base}/api/companies`, {
      headers: { Cookie: `session=${token}` },
    });

    if (!res.ok) {
      return `error: failed to list companies (${res.status}): ${await res.text()}`;
    }

    const companies = (await res.json()) as Array<{ id?: number; name?: string }>;
    return JSON.stringify(companies.map(({ id, name }) => ({ id, name })));
  },
});
