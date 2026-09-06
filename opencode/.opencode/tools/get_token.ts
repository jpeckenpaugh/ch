import { tool } from "@opencode-ai/plugin";

export default tool({
  description:
    "Log in to the Company Hub API and save the session token.",

  args: {},

  async execute(_args, { directory }) {
    const email =
      process.env.COMPANY_HUB_AGENT_EMAIL ?? "agent@localhost";

    const password =
      process.env.COMPANY_HUB_AGENT_PASSWORD ??
      process.env.COMPANY_HUB_ADMIN_PASSWORD;

    if (!password) {
      return (
        "error: COMPANY_HUB_AGENT_PASSWORD " +
        "(or COMPANY_HUB_ADMIN_PASSWORD) is not set in the environment"
      );
    }

    const base =
      process.env.COMPANY_HUB_API_URL ?? "http://localhost:8000";

    const res = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      return `error: login failed (${res.status}): ${await res.text()}`;
    }

    const data = (await res.json()) as {
      access_token?: string;
    };

    if (!data.access_token) {
      return "error: login succeeded but no access_token in the response";
    }

    const tokenPath = `${directory}/.opencode/tools/.token`;

    await Bun.write(tokenPath, data.access_token);

    return (
      `Logged in as ${email}; token saved to ${tokenPath}.\n` +
      `For API calls, send: Cookie: session=${data.access_token}`
    );
  },
});
