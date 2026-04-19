const fs = require('fs');
const path = require('path');

const UPLOAD_SUBDIRS = ['profiles', 'posts', 'communities', 'groups'];

function getUploadsRoot() {
  const configured = (process.env.UPLOADS_DIR || '').trim();
  if (configured) {
    return path.resolve(configured);
  }
  return path.resolve(process.cwd(), 'public', 'uploads');
}

function getUploadSubdirPath(subdir) {
  return path.join(getUploadsRoot(), subdir);
}

function ensureUploadSubdirs() {
  const root = getUploadsRoot();
  if (!fs.existsSync(root)) {
    fs.mkdirSync(root, { recursive: true });
  }

  UPLOAD_SUBDIRS.forEach((subdir) => {
    const dir = path.join(root, subdir);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

module.exports = {
  UPLOAD_SUBDIRS,
  getUploadsRoot,
  getUploadSubdirPath,
  ensureUploadSubdirs,
};
