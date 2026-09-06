import { tool } from "@opencode-ai/plugin";

export default tool({
  description: "List the Company Hub industry's IDs and names.",
  args: {},
  async execute(_args, { directory }) {
    const tokenPath = `${directory}/.opencode/tools/.token`;
    const tokenFile = Bun.file(tokenPath);
    if (!(await tokenFile.exists())) return `error: no saved token at ${tokenPath}; run get_token first`;
    const token = (await tokenFile.text()).trim();
    if (!token) return `error: saved token at ${tokenPath} is empty; run get_token first`;
    const base = process.env.COMPANY_HUB_API_URL ?? "http://localhost:8000";
    const res = await fetch(`${base}/api/industries`, { headers: { Cookie: `session=${token}` } });
    if (!res.ok) return `error: failed to list industries (${res.status}): ${await res.text()}`;
    return JSON.stringify(await res.json());
  },
});
