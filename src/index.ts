import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { XMLParser } from "fast-xml-parser";
import { z } from "zod";
import { boardGameItemSchema, searchResultSchema } from "./bgg-schema.js";

const BGG_API_ROOT = "https://boardgamegeek.com/xmlapi2";
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
});

const server = new McpServer({
  name: "BGG API Explorer Server",
  version: "1.0.0",
  capabilities: {
    "bgg-thing": {
      description: "BGGのボードゲーム情報を取得する",
      parameters: {
        id: {
          type: "string",
          description: "ボードゲームのID",
        },
      },
    },
    "bgg-search": {
      description: "BGGのボードゲームを検索する",
      parameters: {
        query: {
          type: "string",
          description: "検索するキーワード",
        },
        type: {
          type: "string",
          description:
            "検索対象のアイテムタイプ (省略可、複数指定はカンマ区切り)",
        },
        exact: {
          type: "boolean",
          description: "完全一致検索を行うか (省略可)",
        },
      },
    },
  },
});

// ヘルパー関数 - 配列かどうかを判断して適切に処理
const ensureArray = <T>(item: T | T[] | undefined): T[] => {
  if (!item) return [];
  return Array.isArray(item) ? item : [item];
};

// ヘルパー関数 - BGG APIへのリクエスト
const fetchBggApi = async (endpoint: string): Promise<any> => {
  const response = await fetch(`${BGG_API_ROOT}/${endpoint}`);
  if (!response.ok) {
    throw new Error(`BGG API returned status: ${response.status}`);
  }
  const xmlText = await response.text();
  return parser.parse(xmlText);
};

// BGG Thing リソース
server.resource(
  "bgg-thing",
  new ResourceTemplate("bgg://thing/{id}", { list: undefined }),
  async (uri, { id }) => {
    console.log(`Received request for BGG Thing ID: ${id}`);

    try {
      const result = await fetchBggApi(`thing?id=${id}&stats=1`);
      const parsedData = boardGameItemSchema.parse(result.items.item);
      const game = ensureArray(parsedData)[0];

      if (!game) {
        throw new Error(`ID:${id}のゲーム情報が見つかりませんでした`);
      }

      // 基本情報を取得
      const nameObj =
        ensureArray(game.name).find((n) => n.type === "primary") ||
        ensureArray(game.name)[0];
      const name = nameObj?.value || "不明";
      const yearPublished = game.yearpublished?.value || "不明";
      const minPlayers = game.minplayers?.value || "不明";
      const maxPlayers = game.maxplayers?.value || "不明";
      const playingTime = game.playingtime?.value || "不明";

      // ベストプレイ人数と推奨プレイ人数
      let bestWith = "情報なし";
      let recommendedWith = "情報なし";

      const pollSummary = ensureArray(game["poll-summary"]).find(
        (p) => p?.name === "suggested_numplayers"
      );
      if (pollSummary) {
        const results = ensureArray(pollSummary.result);
        bestWith =
          results.find((r) => r.name === "bestwith")?.value || bestWith;
        recommendedWith =
          results.find((r) => r.name === "recommmendedwith")?.value ||
          recommendedWith;
      }

      // 説明文
      const description = game.description || "説明なし";

      // 評価情報
      const ratings = game.statistics?.ratings || {};
      const averageRating = ratings.average?.value || "未評価";
      const numRatings = ratings.usersrated?.value || "0";

      // メインランク
      let mainRank = "ランク外";
      const ranks = ensureArray(ratings.ranks?.rank);
      const boardgameRank = ranks.find((r) => r?.name === "boardgame");
      if (boardgameRank && boardgameRank.value !== "Not Ranked") {
        mainRank = boardgameRank.value || "ランク外";
      }

      // カテゴリ
      const categories = ensureArray(game.link)
        .filter((link) => link.type === "boardgamecategory")
        .map((link) => link.value);

      // レスポンスを構成
      let contentText = `# ${name} (${yearPublished})\n\n`;
      contentText += `プレイ人数: ${minPlayers}～${maxPlayers}人\n`;
      contentText += `ベストプレイ人数: ${bestWith}\n`;
      contentText += `推奨プレイ人数: ${recommendedWith}\n`;
      contentText += `プレイ時間: 約${playingTime}分\n`;
      contentText += `BGG評価: ${averageRating}/10 (${numRatings}件の評価)\n`;
      contentText += `ボードゲームランク: ${mainRank}\n\n`;

      if (categories.length > 0) {
        contentText += `カテゴリ: ${categories.join(", ")}\n\n`;
      }

      contentText += `## 概要\n${description}\n\n`;
      contentText += `詳細情報: https://boardgamegeek.com/boardgame/${id}\n`;

      return {
        contents: [{ uri: uri.href, text: contentText }],
      };
    } catch (error) {
      console.error(`Error processing BGG Thing ID ${id}:`, error);
      return {
        contents: [],
        isError: true,
        errorMessage: `ID ${id}のボードゲーム情報の取得に失敗しました: ${error}`,
      };
    }
  }
);

// BGG 検索ツール
server.tool(
  "bgg-search",
  {
    query: z.string().describe("検索するキーワード"),
    type: z
      .enum([
        "rpgitem",
        "videogame",
        "boardgame",
        "boardgameexpansion",
        "boardgameaccessory",
        "boardgamedesigner",
      ])
      .optional()
      .describe("検索対象のアイテムタイプ (省略可、複数指定はカンマ区切り)"),
    exact: z.boolean().optional().describe("完全一致検索を行うか (省略可)"),
  },
  async ({ query, type, exact }) => {
    try {
      // クエリパラメータの構築
      const params = new URLSearchParams({ query });
      if (type) params.append("type", type);
      if (exact) params.append("exact", "1");

      console.log(`Calling BGG Search API: search?${params.toString()}`);
      const parsedData = await fetchBggApi(`search?${params.toString()}`);
      const searchResult = searchResultSchema.parse(parsedData);

      const items = searchResult.items?.item;
      const totalResults = searchResult.items?.total || "0";

      if (!items || totalResults === "0") {
        return {
          content: [
            {
              type: "text",
              text: `検索結果: "${query}" に一致するボードゲームは見つかりませんでした。`,
            },
          ],
        };
      }

      const itemsList = ensureArray(items);
      let resultText = `"${query}" の検索結果: ${totalResults}件\n\n`;

      itemsList.forEach((item, index) => {
        const id = item.id;
        const name =
          typeof item.name === "object"
            ? item.name?.value
            : item.name || "不明";
        const yearPublished = item.yearpublished?.value || "不明";
        const itemType = item.type || "不明";

        resultText += `${index + 1}. ${name} (${yearPublished})\n`;
        resultText += `   ID: ${id}, タイプ: ${itemType}\n`;
        resultText += `   詳細: bgg://thing/${id}\n\n`;
      });

      return {
        content: [{ type: "text", text: resultText }],
      };
    } catch (error: any) {
      console.error("Error calling BGG Search API:", error);
      return {
        content: [
          {
            type: "text",
            text: `BGG検索中にエラーが発生しました: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// サーバー起動
const transport = new StdioServerTransport();
await server.connect(transport);
