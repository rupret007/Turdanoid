import './suite-arcade-core.js';

const api = globalThis.TurdSuiteArcade;

export const ARCADE_KEY = api.ARCADE_KEY;
export const ARCADE_VERSION = api.ARCADE_VERSION;
export const LEADERBOARD_CAP = api.LEADERBOARD_CAP;
export const SHARE_PLAY_BASE = api.SHARE_PLAY_BASE;
export const LIVE_ARCADE_PAGES = api.LIVE_ARCADE_PAGES;
export const PAGE_SLUG = api.PAGE_SLUG;
export const PAGE_TITLE = api.PAGE_TITLE;
export const parseArcadeStore = api.parseArcadeStore;
export const readStore = api.readStore;
export const writeStore = api.writeStore;
export const recordLeaderboard = api.recordLeaderboard;
export const getLeaderboard = api.getLeaderboard;
export const saveProgress = api.saveProgress;
export const loadProgress = api.loadProgress;
export const clearProgress = api.clearProgress;
export const hasProgress = api.hasProgress;
export const listProgressPages = api.listProgressPages;
export const slugForPage = api.slugForPage;
export const titleForPage = api.titleForPage;
export const buildShareText = api.buildShareText;
export const shareScore = api.shareScore;
export const recordEnd = api.recordEnd;
export const cleanBucket = api.cleanBucket;
export const insertLeaderboard = api.insertLeaderboard;
