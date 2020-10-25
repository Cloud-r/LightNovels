import {monkeyPatchLogger} from './helper.mjs';
import {
  loadPage,
  getContentFromPage,
  writeToTemp,
  generateEpub,
} from './helper.mjs';

/** Main Scrapper function */
async function scrape() {
  let nextPageUrl = '/novel/martial-world-webnovel/chapter-2256';
  const chapters = [];
  while (nextPageUrl) {
    const pageContent = await loadPage(nextPageUrl);
    if (!pageContent) return;
    const [nextUrl, chapterContent] = getContentFromPage(pageContent);
    writeToTemp(chapterContent);
    nextPageUrl = nextUrl;
    chapters.push(chapterContent);
    await new Promise((res) => setTimeout(res, 10000));
  }
  console.log('All Chapters downloaded');
  await generateEpub(chapters, 'martial world');
}

/** Init function */
async function __init__() {
  monkeyPatchLogger();
  try {
    await scrape();
  } catch (e) {
    console.error(e);
  } finally {
    console.log('Scraping Completed');
    process.exit();
  }
}

__init__();
