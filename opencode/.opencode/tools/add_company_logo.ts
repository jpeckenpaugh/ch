import { tool } from "@opencode-ai/plugin";

function filenameFromUrl(logoUrl: string, contentType: string): string {
  const pathname = new URL(logoUrl).pathname;
  const candidate = pathname.split("/").pop();
  if (candidate && candidate.includes(".")) return candidate;
  const extension = ({ "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp", "image/svg+xml": "svg" } as Record<string, string>)[contentType] ?? "image";
  return `company-logo.${extension}`;
}

export default tool({
  description: "Download an image from a URL and upload or replace a Company Hub company's logo.",
  args: {
    company_id: tool.schema.number().int().positive().describe("The Company Hub company ID."),
    logo_url: tool.schema.string().url().describe("The direct URL of the logo image."),
  },
  async execute({ company_id, logo_url }, { directory }) {
    const tokenPath = `${directory}/.opencode/tools/.token`;
    const tokenFile = Bun.file(tokenPath);
    if (!(await tokenFile.exists())) return `error: no saved token at ${tokenPath}; run get_token first`;
    const token = (await tokenFile.text()).trim();
    if (!token) return `error: saved token at ${tokenPath} is empty; run get_token first`;
    let logoResponse: Response;
    try {
      logoResponse = await fetch(logo_url);
    } catch (error) {
      return `error: failed to download logo: ${error instanceof Error ? error.message : String(error)}`;
    }
    if (!logoResponse.ok) return `error: failed to download logo (${logoResponse.status})`;
    const contentType = logoResponse.headers.get("content-type")?.split(";", 1)[0].toLowerCase() ?? "";
    if (!contentType.startsWith("image/")) return "error: logo URL did not return an image";
    const file = new File([await logoResponse.arrayBuffer()], filenameFromUrl(logoResponse.url, contentType), { type: contentType });
    const form = new FormData();
    form.append("file", file, file.name);
    const base = process.env.COMPANY_HUB_API_URL ?? "http://localhost:8000";
    const res = await fetch(`${base}/api/companies/${company_id}/logo`, { method: "POST", headers: { Cookie: `session=${token}` }, body: form });
    if (!res.ok) return `error: failed to add company logo (${res.status}): ${await res.text()}`;
    return JSON.stringify(await res.json());
  },
});
