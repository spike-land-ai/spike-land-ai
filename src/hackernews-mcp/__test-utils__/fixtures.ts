/**
 * Test fixtures — sample HN data and HTML fragments.
 */

import type { AlgoliaSearchResult, HNItem, HNUser } from "../types.js";

// ─── HN Items ───

export const SAMPLE_STORY: HNItem = {
  id: 12345,
  type: "story",
  by: "pg",
  time: 1704067200,
  title: "Show HN: A New Way to Build Things",
  url: "https://example.com/article",
  score: 150,
  descendants: 42,
  kids: [12346, 12347],
};

export const SAMPLE_COMMENT: HNItem = {
  id: 12346,
  type: "comment",
  by: "dang",
  time: 1704070800,
  text: "This is a great article. Thanks for sharing.",
  parent: 12345,
  kids: [12348],
};

export const SAMPLE_NESTED_COMMENT: HNItem = {
  id: 12348,
  type: "comment",
  by: "testuser",
  time: 1704074400,
  text: "I agree, very insightful.",
  parent: 12346,
};

// ─── HN Users ───

export const SAMPLE_USER: HNUser = {
  id: "pg",
  created: 1160418111,
  karma: 157236,
  about: "Bug fixer.",
  submitted: [12345, 12346],
};

// ─── Story ID Lists ───

export const SAMPLE_STORY_IDS = [12345, 12350, 12351, 12352, 12353];

// ─── Algolia Search ───

export const SAMPLE_ALGOLIA_RESULT: AlgoliaSearchResult = {
  hits: [
    {
      objectID: "12345",
      title: "Show HN: A New Way to Build Things",
      url: "https://example.com/article",
      author: "pg",
      points: 150,
      num_comments: 42,
      created_at: "2024-01-01T00:00:00.000Z",
      _tags: ["story", "author_pg", "story_12345"],
    },
  ],
  nbHits: 1,
  page: 0,
  nbPages: 1,
  hitsPerPage: 20,
};

// ─── HN Updates ───

export const SAMPLE_UPDATES = {
  items: [12345, 12346],
  profiles: ["pg", "dang"],
};

// ─── HTML Fragments (for write operation testing) ───

export const LOGIN_SUCCESS_HTML = `<html><head><meta http-equiv="refresh" content="0;URL=news"></head></html>`;

export const LOGIN_FAILURE_HTML = `<html><body>Bad login.</body></html>`;

export const SUBMIT_PAGE_HTML = `<html><body>
<form method="post" action="/r">
<input type="hidden" name="fnid" value="abc123fnid456">
<input type="text" name="title" size="50">
<input type="text" name="url" size="50">
<textarea name="text"></textarea>
<input type="submit" value="submit">
</form>
</body></html>`;

export const SUBMIT_SUCCESS_HTML = `<html><head><meta http-equiv="refresh" content="0;URL=newest"></head></html>`;

export const SUBMIT_FAILURE_HTML = `<html><body>Please limit submissions to 4 per hour.</body></html>`;

export const ITEM_PAGE_WITH_VOTE_HTML = `<html><body>
<a id="up_12345" href="vote?id=12345&amp;how=up&amp;auth=votesecret123&amp;goto=item%3Fid%3D12345" class="clicky">
<div class="votearrow" title="upvote"></div>
</a>
<span class="age" title="2024-01-01T00:00:00"><a href="item?id=12345">1 hour ago</a></span>
</body></html>`;

export const ITEM_PAGE_WITH_COMMENT_FORM_HTML = `<html><body>
<form method="post" action="/comment">
<input type="hidden" name="parent" value="12345">
<input type="hidden" name="hmac" value="hmactoken789">
<textarea name="text"></textarea>
<input type="submit" value="add comment">
</form>
</body></html>`;

export const VOTE_SUCCESS_HTML = `<html><head><meta http-equiv="refresh" content="0;URL=item?id=12345"></head></html>`;

export const COMMENT_SUCCESS_HTML = `<html><head><meta http-equiv="refresh" content="0;URL=item?id=12345"></head></html>`;

export const RATE_LIMITED_HTML = `<html><body>You're submitting too fast. Please slow down.</body></html>`;
