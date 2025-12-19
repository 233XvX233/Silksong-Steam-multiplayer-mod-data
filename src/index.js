export default {
  async fetch(request, env) {
    if (request.method !== "POST") return new Response("Use POST", { status: 405 });

    let data;
    try { data = await request.json(); }
    catch { return new Response("Invalid JSON", { status: 400 }); }

    const sceneName = String(data.sceneName ?? "Unknown");
    const x = Number(data.x);
    const y = Number(data.y);
    const message = String(data.message ?? "").trim();

    if (!message || message.length < 2) return new Response("Message too short", { status: 400 });
    if (!Number.isFinite(x) || !Number.isFinite(y)) return new Response("Invalid coordinates", { status: 400 });
    if (message.length > 2000) return new Response("Message too long", { status: 400 });

    const title = `[Feedback] ${sceneName} @ (${x.toFixed(2)}, ${y.toFixed(2)})`;
    const body = [
      `**Scene:** ${sceneName}`,
      `**Position:** (${x}, ${y})`,
      `**Message:**`,
      message,
      ``,
      `**Meta**`,
      `- GameVersion: ${data.gameVersion ?? "?"}`,
      `- Platform: ${data.platform ?? "?"}`,
      `- Time: ${data.timeUtc ?? "?"}`,
    ].join("\n");

    const res = await fetch(`https://api.github.com/repos/${env.GH_OWNER}/${env.GH_REPO}/issues`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.GH_TOKEN}`,
        "User-Agent": "unity-feedback-worker",
        "Accept": "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title, body, labels: ["feedback"] }),
    });

    const text = await res.text();
    if (!res.ok) return new Response(`GitHub error: ${res.status}\n${text}`, { status: 500 });

    return new Response("OK");
  },
};
