import { Controller, Get, Header, Param, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { normalizeUsername, usernameProblem } from '@vyra/validation';
import { Public } from '../auth/auth.decorators.js';

const PAGE = (username: string | null): string => {
  const target = username ? `vyra://u/${username}` : 'vyra://';
  const heading = username ? `Open @${username} in VYRA` : 'Open VYRA';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>VYRA</title>
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
    background:#100F13;color:#F2EFF5;font:16px/1.5 system-ui,sans-serif;text-align:center;padding:24px}
  main{max-width:360px}
  h1{font-weight:400;font-size:28px;margin:0 0 12px}
  p{color:#A29DAB;margin:0 0 24px}
  a{display:inline-block;padding:14px 28px;background:#F2EFF5;color:#100F13;border-radius:8px;
    text-decoration:none;font-weight:600}
</style></head><body><main>
<h1>${heading}</h1>
<p>This link opens a profile in the VYRA app. Tap the button to open it. You need VYRA installed.</p>
<a href="${target}">Open in VYRA</a>
</main></body></html>`;
};

/**
 * What a scanned QR code or shared link lands on. It never says whether the
 * username exists; the app decides what the person is allowed to see. Only a
 * well-formed username is echoed, so nothing else can reach the page.
 */
@ApiExcludeController()
@Controller({ version: VERSION_NEUTRAL })
export class LandingController {
  @Public()
  @Get('u/:username')
  @Header('content-type', 'text/html; charset=utf-8')
  @Header('cache-control', 'public, max-age=300')
  open(@Param('username') raw: string): string {
    const username = normalizeUsername(raw);
    return PAGE(usernameProblem(username) === null ? username : null);
  }
}
