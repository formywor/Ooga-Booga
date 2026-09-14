export default {
  async fetch(request) {
    const response = await fetch(request);
    const headers = new Headers(response.headers);
    const path = new URL(request.url).pathname.replace(/\.html$/i, "");
    const policy = path === "/tokens" ?
      "default-src 'self'; connect-src 'self' https:; img-src 'self' data: https:; media-src 'self' https:; style-src 'self'; script-src 'self' https://nap5k.com; frame-src https:; font-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'" :
      "default-src 'self'; connect-src 'self' https://api.scriptnovaa.com; img-src 'self' data:; media-src 'self' https:; style-src 'self'; script-src 'self'; font-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'";
    headers.set("Content-Security-Policy",
        policy);
    headers.set("X-Frame-Options", "DENY");
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
    return new Response(response.body, {status: response.status,
      statusText: response.statusText, headers});
  },
};
