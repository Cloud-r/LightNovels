import {
  loadPage,
  initializeTempDir,
  monkeyPatchLogger,
  getContentFromPage,
  writeToTemp,
  generateEpub,
  getNovelInfo,
  rebuildChapterArray,
} from './helper.mjs';

/** Main Scrapper function */
async function scrape() {
  const {
    chapterURL,
    novelName,
    isNewDownload,
    tempFileName,
    retryChapterURL} = await getNovelInfo();
  initializeTempDir(novelName, tempFileName);
  let chapters = [];
  let nextPageUrl = chapterURL;
  if (!isNewDownload) {
    chapters = rebuildChapterArray(tempFileName);
    nextPageUrl = retryChapterURL;
  }
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
  await generateEpub(chapters, novelName);
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
