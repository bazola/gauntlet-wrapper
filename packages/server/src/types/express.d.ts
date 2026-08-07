// Augment Express.Request with the reference id we pre-allocate before a
// photo/video upload runs, so multer's destination callback and the catalog
// write afterward agree on the same folder name (see references/uploadRoutes.ts).
declare namespace Express {
  interface Request {
    referenceId?: string;
  }
}
