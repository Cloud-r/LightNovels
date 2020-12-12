import {
  loadPage,
  initializeTempDir,
  monkeyPatchLogger,
  getContentFromPage,
  writeToTemp,
  generateEpub,
  getNovelInfo,
  getCurrentSessionRetryInfo,
  rebuildChapterArray,
} from './helper.mjs';

let [retryChapterUrl, retryCount] = [null, 0];

/**
 * retry the chapter download (hopefully with hystix
 * kinda fallback and reverting to waiting for user
 * input after some time. rather than crashing the program)
 * @param {string} nextPageUrl the url of the failed chapter
 * @param {Array} chapters collector for the chapters
 */
async function retryChapterDownload(nextPageUrl, chapters) {
  if (retryChapterUrl !== nextPageUrl) retryCount = 0;
  retryCount += 1;
  retryChapterUrl = nextPageUrl;
  if (retryCount > 5) {
    const shouldRetry = await getCurrentSessionRetryInfo(nextPageUrl);
    if (shouldRetry) {
      retryCount = 0;
      downloadChapters(nextPageUrl, chapters);
    } else {
      console.log('Download Failed');
      process.exit();
    }
  } else {
    await new Promise((res) => setTimeout(res, (5000) * retryCount));
    downloadChapters(nextPageUrl, chapters);
  }
}

/**
 * function to download the chapters with an option to retry
 * @param {string} nextPageUrl the URL of the chapter to download
 * @param {Array} chapters the array to collect the chapters
 */
async function downloadChapters(nextPageUrl, chapters) {
  let resolver;
  const promise = new Promise((res) => {
    resolver = res;
  });
  try {
    while (nextPageUrl) {
      const pageContent = await loadPage(nextPageUrl);
      if (!pageContent) return;
      const [nextUrl, chapterContent] = getContentFromPage(
          pageContent,
          nextPageUrl,
      );
      writeToTemp(chapterContent);
      nextPageUrl = nextUrl;
      chapters.push(chapterContent);
      await new Promise((res) => setTimeout(res, 5000));
    }
    resolver();
  } catch (e) {
    console.log(e);
    console.error(`Download failed for chapter ${nextPageUrl}. retrying`);
    retryChapterDownload(nextPageUrl, chapters);
  }
  return promise;
}

/** Main Scrapper function */
async function scrape() {
  const {
    chapterURL,
    novelName,
    isNewDownload,
    tempFileName,
    retryChapterURL,
  } = await getNovelInfo();
  initializeTempDir(novelName, tempFileName);
  let chapters = [];
  let nextPageUrl = chapterURL;
  if (!isNewDownload) {
    chapters = rebuildChapterArray(tempFileName);
    nextPageUrl = retryChapterURL;
  }
  await downloadChapters(nextPageUrl, chapters);
  console.log('All Chapters downloaded');
  await generateEpub(
      chapters.map((chapter) => ({title: chapter.title, data: chapter.data})),
      novelName,
  );
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
