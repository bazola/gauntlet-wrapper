// Hardware WebGPU/GPU preflight -- generalized from a verified working recipe
// (gauntlet-zelda's harness/webgpu-check.cjs). Evidence captured on a software
// renderer (SwiftShader, llvmpipe, ANGLE's software fallback) is not evidence
// of anything a real player will see -- this is why every perf run should call
// this FIRST and void the whole run if it fails, the same way FS-1005 does
// there.
//
// Tries a few known-good headless launch configurations in order and reports
// which one worked (or that none did), since the right recipe varies by OS/GPU
// driver stack.

import { chromium } from 'playwright';
import * as http from 'node:http';

export interface GpuGateResult {
  pass: boolean;
  reason: string;
  configUsed: string | null;
  adapter: {
    vendor?: string;
    architecture?: string;
    device?: string;
    description?: string;
    isFallback: boolean;
  } | null;
}

const LAUNCH_CONFIGS: Array<[string, string[]]> = [
  ['default', ['--enable-unsafe-webgpu']],
  ['d3d11', ['--enable-unsafe-webgpu', '--use-angle=d3d11']],
  ['vulkan', ['--enable-unsafe-webgpu', '--enable-features=Vulkan']],
];

const SOFTWARE_MARKERS = ['swiftshader', 'llvmpipe', 'software'];

/**
 * Chromium's WebGPU adapter query needs a secure context; a bare data: URL
 * doesn't qualify, so this spins up a throwaway http://127.0.0.1 page just to
 * ask navigator.gpu.requestAdapter() the question, then tears it down.
 */
export async function runGpuGate(): Promise<GpuGateResult> {
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<!doctype html><title>gauntlet-wrapper gpu gate</title>');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const url = `http://127.0.0.1:${port}/`;

  try {
    for (const [label, args] of LAUNCH_CONFIGS) {
      let browser;
      try {
        browser = await chromium.launch({ channel: 'chrome', ignoreDefaultArgs: ['--disable-gpu'], args });
        const page = await browser.newPage();
        await page.goto(url);
        const diag = await page.evaluate(async () => {
          const nav = navigator as Navigator & { gpu?: { requestAdapter(opts?: unknown): Promise<unknown> } };
          if (!nav.gpu) return { hasGpu: false, adapter: null };
          const adapter = (await nav.gpu.requestAdapter({ powerPreference: 'high-performance' })) as
            | { info?: Record<string, string>; isFallbackAdapter?: boolean }
            | null;
          if (!adapter) return { hasGpu: true, adapter: null };
          const info = adapter.info ?? {};
          return {
            hasGpu: true,
            adapter: {
              vendor: info.vendor,
              architecture: info.architecture,
              device: info.device,
              description: info.description,
              isFallback: adapter.isFallbackAdapter === true,
            },
          };
        });

        if (diag.hasGpu && diag.adapter) {
          const signature = JSON.stringify(diag.adapter).toLowerCase();
          const isSoftware = diag.adapter.isFallback || SOFTWARE_MARKERS.some((m) => signature.includes(m));
          if (!isSoftware) {
            return { pass: true, reason: `hardware WebGPU adapter available (config: ${label})`, configUsed: label, adapter: diag.adapter };
          }
        }
      } catch {
        // try the next launch config
      } finally {
        await browser?.close().catch(() => {});
      }
    }
    return { pass: false, reason: 'no hardware WebGPU adapter available in any headless launch configuration', configUsed: null, adapter: null };
  } finally {
    server.close();
  }
}
