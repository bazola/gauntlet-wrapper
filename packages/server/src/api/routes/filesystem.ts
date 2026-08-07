import { Router } from 'express';
import { access, lstat, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { asyncHandler } from '../asyncHandler.js';

export const filesystemRouter = Router();

async function listRoots(): Promise<string[]> {
  if (process.platform !== 'win32') return ['/'];
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const results = await Promise.all(
    letters.map(async (letter) => {
      const drive = `${letter}:\\`;
      try {
        await access(drive);
        return drive;
      } catch {
        return null;
      }
    }),
  );
  return results.filter((r): r is string => r !== null);
}

// A local single-user tool's equivalent of a native "choose folder" dialog --
// directories only (this is for picking a project root, not general file
// browsing), no filtering beyond that.
filesystemRouter.get(
  '/browse',
  asyncHandler(async (req, res) => {
    const roots = await listRoots();
    const requested = typeof req.query.path === 'string' && req.query.path.length > 0 ? req.query.path : homedir();
    const targetPath = resolve(requested);

    let stat;
    try {
      stat = await lstat(targetPath);
    } catch {
      res.status(400).json({ error: `path not found: ${targetPath}` });
      return;
    }
    if (!stat.isDirectory()) {
      res.status(400).json({ error: 'not a directory' });
      return;
    }

    let dirEntries;
    try {
      dirEntries = await readdir(targetPath, { withFileTypes: true });
    } catch (err) {
      res.status(403).json({ error: `cannot read directory: ${err instanceof Error ? err.message : String(err)}` });
      return;
    }

    const entries = dirEntries
      .filter((e) => e.isDirectory())
      .map((e) => ({ name: e.name, path: join(targetPath, e.name) }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const isRoot = roots.some((r) => resolve(r) === targetPath);
    res.json({
      path: targetPath,
      parent: isRoot ? null : dirname(targetPath),
      roots,
      entries,
    });
  }),
);
