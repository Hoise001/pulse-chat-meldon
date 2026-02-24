import fs from 'fs';
import http from 'http';
import path from 'path';
import { getUserByToken } from '../db/queries/users';

const SOUNDPAD_DIR = path.join(process.cwd(), 'public', 'soundpad');

export const soundpadListHandler = async (
  _req: http.IncomingMessage,
  res: http.ServerResponse
) => {
  try {
    if (!fs.existsSync(SOUNDPAD_DIR)) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify([]));
      return;
    }
    const files = fs.readdirSync(SOUNDPAD_DIR).filter(f =>
      f.endsWith('.mp3') || f.endsWith('.wav') || f.endsWith('.ogg')
    );
    const sounds = files.map(file => ({
      name: file.replace(/\.[^/.]+$/, '').replace(/_/g, ' '),
      file,
    }));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(sounds));
  } catch {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Failed to list sounds' }));
  }
};

export const soundpadUploadHandler = async (
  req: http.IncomingMessage,
  res: http.ServerResponse
) => {
  const token = req.headers['x-token'] as string;
  if (!token) { res.writeHead(401, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Unauthorized' })); return; }
  const user = await getUserByToken(token);
  if (!user) { res.writeHead(401, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Unauthorized' })); return; }

  const fileName = req.headers['x-file-name'] as string;
  if (!fileName) { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Missing file name' })); return; }

  const ext = path.extname(fileName).toLowerCase();
  if (!['.mp3', '.wav', '.ogg'].includes(ext)) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Only MP3, WAV and OGG files are allowed' }));
    return;
  }

  if (!fs.existsSync(SOUNDPAD_DIR)) fs.mkdirSync(SOUNDPAD_DIR, { recursive: true });

  const safeName = path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, '_');
  const filePath = path.join(SOUNDPAD_DIR, safeName);
  const fileStream = fs.createWriteStream(filePath);
  req.pipe(fileStream);
  fileStream.on('finish', () => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, file: safeName }));
  });
  fileStream.on('error', () => {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Upload failed' }));
  });
};

export const soundpadDeleteHandler = async (
  req: http.IncomingMessage,
  res: http.ServerResponse
) => {
  const token = req.headers['x-token'] as string;
  if (!token) { res.writeHead(401, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Unauthorized' })); return; }
  const user = await getUserByToken(token);
  if (!user) { res.writeHead(401, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Unauthorized' })); return; }

  const url = new URL(req.url!, `http://localhost`);
  const file = url.searchParams.get('file');
  if (!file) { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Missing file name' })); return; }

  const safeName = path.basename(file);
  const filePath = path.join(SOUNDPAD_DIR, safeName);
  if (!fs.existsSync(filePath)) { res.writeHead(404, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'File not found' })); return; }

  fs.unlinkSync(filePath);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ success: true }));
};
