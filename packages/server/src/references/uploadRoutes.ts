import { Router, type RequestHandler } from 'express';
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { getProject } from '../registry/registry.js';
import { readCatalog, addPhotoReference, addVideoReference, addGameplayReference } from './referenceCatalog.js';
import { asyncHandler } from '../api/asyncHandler.js';

// Mounted at /api/projects/:id/references -- mergeParams so req.params.id
// (the project id) is visible down here. TS can't infer a mergeParams
// parent's params from this router's own route strings, so route handlers
// read it back out via projectIdParam() instead of req.params.id directly.
export const referencesRouter = Router({ mergeParams: true });

function projectIdParam(req: { params: unknown }): string {
  return (req.params as { id: string }).id;
}

const MAX_PHOTO_BYTES = 25 * 1024 * 1024;
const MAX_VIDEO_BYTES = 500 * 1024 * 1024;

const assignReferenceId: RequestHandler = (req, _res, next) => {
  req.referenceId = randomUUID();
  next();
};

function makeStorage(kind: 'photo' | 'video') {
  return multer.diskStorage({
    destination: (req, _file, cb) => {
      getProject(projectIdParam(req))
        .then(async (project) => {
          if (!project) {
            cb(new Error('unknown project'), '');
            return;
          }
          const dir = join(project.path, '.gauntlet', 'references', kind, req.referenceId!);
          await mkdir(dir, { recursive: true });
          cb(null, dir);
        })
        .catch((err) => cb(err as Error, ''));
    },
    filename: (_req, file, cb) => {
      // This directory was just created for this one upload, so no collision
      // risk; still strip separators defensively since the name is untrusted
      // client input.
      cb(null, file.originalname.replace(/[\\/]/g, '_'));
    },
  });
}

const photoUpload = multer({ storage: makeStorage('photo'), limits: { fileSize: MAX_PHOTO_BYTES } });
const videoUpload = multer({ storage: makeStorage('video'), limits: { fileSize: MAX_VIDEO_BYTES } });

referencesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const project = await getProject(projectIdParam(req));
    if (!project) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    res.json(await readCatalog(project.path));
  }),
);

referencesRouter.post(
  '/photo',
  assignReferenceId,
  photoUpload.single('file'),
  asyncHandler(async (req, res) => {
    const project = await getProject(projectIdParam(req));
    if (!project || !req.file) {
      res.status(400).json({ error: 'project not found or file missing' });
      return;
    }
    const entry = await addPhotoReference(project.path, req.referenceId!, req.file.filename, String(req.body.note ?? ''));
    res.status(201).json(entry);
  }),
);

referencesRouter.post(
  '/video',
  assignReferenceId,
  videoUpload.single('file'),
  asyncHandler(async (req, res) => {
    const project = await getProject(projectIdParam(req));
    if (!project || !req.file) {
      res.status(400).json({ error: 'project not found or file missing' });
      return;
    }
    const entry = await addVideoReference(project.path, req.referenceId!, req.file.filename, String(req.body.note ?? ''));
    res.status(201).json(entry);
  }),
);

referencesRouter.post(
  '/gameplay',
  asyncHandler(async (req, res) => {
    const project = await getProject(projectIdParam(req));
    if (!project) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    const { goalText, gapText, testIdeasText } = req.body ?? {};
    if (typeof goalText !== 'string' || goalText.trim().length === 0) {
      res.status(400).json({ error: 'goalText is required' });
      return;
    }
    const entry = await addGameplayReference(project.path, goalText, String(gapText ?? ''), String(testIdeasText ?? ''));
    res.status(201).json(entry);
  }),
);

// Serves an uploaded photo/video back out so the browser can preview it.
// refId/filename are untrusted path segments -- resolved path is verified to
// stay inside that reference kind's base directory before sendFile runs.
referencesRouter.get(
  '/file/:kind/:refId/:filename',
  asyncHandler(async (req, res) => {
    const { kind, refId, filename } = req.params;
    if (kind !== 'photo' && kind !== 'video') {
      res.status(400).json({ error: 'invalid kind' });
      return;
    }
    const project = await getProject(projectIdParam(req));
    if (!project) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    const baseDir = resolve(join(project.path, '.gauntlet', 'references', kind));
    const target = resolve(join(baseDir, refId, filename));
    if (target !== baseDir && !target.startsWith(baseDir + sep)) {
      res.status(400).json({ error: 'invalid path' });
      return;
    }
    res.sendFile(target, (err) => {
      if (err && !res.headersSent) res.status(404).json({ error: 'file not found' });
    });
  }),
);
