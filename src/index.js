export default {
  async fetch(request, env) {
    if (request.method !== "POST") return new Response("Use POST", { status: 405 });

    // 1) 必要变量检查
    if (!env.GH_OWNER || !env.GH_REPO || !env.GH_TOKEN) {
      return new Response(
        `Missing env vars: GH_OWNER=${env.GH_OWNER ?? ""}, GH_REPO=${env.GH_REPO ?? ""}, GH_TOKEN=${!!env.GH_TOKEN}`,
        { status: 500 }
      );
    }

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

    const headers = {
      "Authorization": `Bearer ${env.GH_TOKEN}`,
      "User-Agent": "unity-feedback-worker",
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    };

    // 2) 先检查 repo 是否存在/是否有权限
    const repoUrl = `https://api.github.com/repos/${env.GH_OWNER}/${env.GH_REPO}`;
    const repoCheck = await fetch(repoUrl, { headers });
    const repoCheckText = await repoCheck.text();

    if (!repoCheck.ok) {
      return new Response(
        `Repo check failed: ${repoCheck.status}\nURL: ${repoUrl}\n${repoCheckText}`,
        { status: 500 }
      );
    }

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

    // 3) 创建 issue
    const issuesUrl = `https://api.github.com/repos/${env.GH_OWNER}/${env.GH_REPO}/issues`;
    const res = await fetch(issuesUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ title, body, labels: ["feedback"] }),
    });

    const text = await res.text();
    if (!res.ok) {
      return new Response(
        `Create issue failed: ${res.status}\nURL: ${issuesUrl}\n${text}`,
        { status: 500 }
      );
    }

    // 4) 返回 issue 链接（给 Unity 用）
    let issueUrl = "";
    try { issueUrl = JSON.parse(text).html_url ?? ""; } catch {}

    return new Response(JSON.stringify({ ok: true, issueUrl }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  },
};
