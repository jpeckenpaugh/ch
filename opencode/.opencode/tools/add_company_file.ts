import { tool } from "@opencode-ai/plugin";

function contentType(path: string): string {
  const extension = path.split(".").pop()?.toLowerCase();
  return ({ pdf: "application/pdf", txt: "text/plain", csv: "text/csv", json: "application/json", doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ppt: "application/vnd.ms-powerpoint", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml" } as Record<string, string>)[extension ?? ""] ?? "application/octet-stream";
}

export default tool({
  description: "Upload one file to a Company Hub company from a file path.",
  args: {
    company_id: tool.schema.number().int().positive().describe("The Company Hub company ID."),
    file_path: tool.schema.string().min(1).describe("An absolute path or a path relative to the project directory."),
  },
  async execute({ company_id, file_path }, { directory }) {
    const tokenPath = `${directory}/.opencode/tools/.token`;
    const tokenFile = Bun.file(tokenPath);
    if (!(await tokenFile.exists())) return `error: no saved token at ${tokenPath}; run get_token first`;
    const token = (await tokenFile.text()).trim();
    if (!token) return `error: saved token at ${tokenPath} is empty; run get_token first`;
    const path = file_path.startsWith("/") ? file_path : `${directory}/${file_path}`;
    const file = Bun.file(path, { type: contentType(path) });
    if (!(await file.exists())) return `error: file not found: ${path}`;
    const form = new FormData();
    form.append("file", file, path.split("/").pop());
    const base = process.env.COMPANY_HUB_API_URL ?? "http://localhost:8000";
    const res = await fetch(`${base}/api/companies/${company_id}/artifacts`, { method: "POST", headers: { Cookie: `session=${token}` }, body: form });
    if (!res.ok) return `error: failed to add company file (${res.status}): ${await res.text()}`;
    return JSON.stringify(await res.json());
  },
});
