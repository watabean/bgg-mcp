import { z } from "zod";

// 共通の型定義をヘルパー関数として抽出
const createArrayOrSingle = <T extends z.ZodTypeAny>(schema: T) =>
  z.array(schema).or(schema);

// 基本的な値型の定義
const valueObject = z.object({
  value: z.string().optional(),
});

// 名前オブジェクトの定義
const nameObject = z.object({
  type: z.string().optional(),
  value: z.string(),
  sortindex: z.string().optional(),
  primary: z.string().optional(),
});

// ポール（投票）結果の定義
const pollResultObject = z.object({
  value: z.string(),
  numvotes: z.string().optional(),
  level: z.string().optional(),
});

// ポール結果集計の定義
const pollSummaryResultObject = z.object({
  name: z.string(),
  value: z.string(),
});

// ポール集計の定義
const pollSummaryObject = z.object({
  name: z.string(),
  title: z.string().optional(),
  result: createArrayOrSingle(pollSummaryResultObject),
});

// ポール定義の内部オブジェクト
const pollResultsObject = z.object({
  numplayers: z.string().optional(),
  level: z.string().optional(),
  result: createArrayOrSingle(pollResultObject),
});

// ポール定義
const pollObject = z.object({
  name: z.string(),
  title: z.string(),
  totalvotes: z.string(),
  results: createArrayOrSingle(pollResultsObject),
});

// リンクオブジェクトの定義
const linkObject = z.object({
  type: z.string(),
  value: z.string(),
  objectid: z.string().optional(),
});

// ランク定義
const rankObject = z.object({
  type: z.string().optional(),
  name: z.string().optional(),
  friendlyname: z.string().optional(),
  value: z.string().optional(),
});

// レーティング情報の定義
const ratingsObject = z.object({
  usersrated: valueObject.optional(),
  average: valueObject.optional(),
  bayesaverage: valueObject.optional(),
  ranks: z
    .object({
      rank: createArrayOrSingle(rankObject),
    })
    .optional(),
});

// 統計情報の定義
const statisticsObject = z.object({
  ratings: ratingsObject.optional(),
});

// ボードゲーム1つの定義
export const boardGameItemSchema = z.object({
  id: z.string().optional(),
  type: z.string().optional(),
  name: createArrayOrSingle(nameObject),
  yearpublished: valueObject.optional(),
  minplayers: valueObject.optional(),
  maxplayers: valueObject.optional(),
  playingtime: valueObject.optional(),
  minplaytime: valueObject.optional(),
  maxplaytime: valueObject.optional(),
  age: valueObject.optional(),
  description: z.string().optional(),
  thumbnail: z.string().optional(),
  image: z.string().optional(),
  statistics: statisticsObject.optional(),
  link: createArrayOrSingle(linkObject).optional(),
  "poll-summary": createArrayOrSingle(pollSummaryObject).optional(),
  poll: createArrayOrSingle(pollObject).optional(),
});

// ボードゲーム一覧の定義
export const boardGamesSchema = z.object({
  items: z.object({
    total: z.string().optional(),
    item: createArrayOrSingle(boardGameItemSchema),
  }),
});

// 検索結果アイテムの定義
export const searchItemSchema = z.object({
  id: z.string(),
  name: z
    .object({
      value: z.string().optional(),
    })
    .or(z.string())
    .optional(),
  yearpublished: valueObject.optional(),
  type: z.string().optional(),
});

// 検索結果の定義
export const searchResultSchema = z.object({
  items: z.object({
    total: z.string().optional(),
    item: createArrayOrSingle(searchItemSchema).optional(),
  }),
});

// 型エクスポート
export type BoardGameItem = z.infer<typeof boardGameItemSchema>;
export type BoardGames = z.infer<typeof boardGamesSchema>;
export type SearchItem = z.infer<typeof searchItemSchema>;
export type SearchResult = z.infer<typeof searchResultSchema>;
