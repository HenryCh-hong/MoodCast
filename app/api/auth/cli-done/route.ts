export async function GET() {
  const html = `<!DOCTYPE html>
<html><head><title>Moodcast CLI Auth</title>
<style>
  body { font-family: monospace; background: #1a1228; color: #c4b5fd;
         display: flex; align-items: center; justify-content: center;
         height: 100vh; margin: 0; }
  .box { text-align: center; }
  .title { font-size: 18px; font-weight: bold; margin-bottom: 16px; }
  .msg { color: #a095b8; font-size: 13px; }
</style>
</head><body><div class="box">
  <div class="title">▓▒░ MOODCAST ░▒▓</div>
  <div class="msg">Spotify connected. Return to your terminal.</div>
</div></body></html>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html' } });
}
