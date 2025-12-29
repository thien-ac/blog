#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { composePost } from '../api/ai/mock.js';

(async function main(){
  const generated = await composePost({ prompt: 'Kiểm tra tạo bài AI cho repo (dev mock)' });
  const title = generated.title || 'ai-test';
  const slug = title.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g,'-').replace(/-+/g,'-').slice(0,60);
  const date = new Date();
  const published = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  const author = process.env.AI_POST_AUTHOR || 'hopthurac';
  const filename = `${slug}-${Date.now()}.md`;
  const filepath = path.resolve(process.cwd(), 'src', 'content', 'posts', filename);

  const frontmatter = `---\n` +
    `title: ${title}\n` +
    `published: ${published}\n` +
    `updated: ${published}\n` +
    `description: "${(generated.description||'').replace(/"/g, '\\"')}"\n` +
    `image: ""\n` +
    `tags: []\n` +
    `category: ''\n` +
    `author: "${author}"\n` +
    `slug: "${slug}"\n` +
    `draft: false\n` +
    `lang: "vi"\n` +
    `canonical: ''\n` +
    `---\n\n`;

  const content = frontmatter + (generated.body || `# ${title}\n\n${generated.body || 'No body'}`);
  fs.writeFileSync(filepath, content, { encoding: 'utf8' });
  console.log('WROTE', filepath);
})();
