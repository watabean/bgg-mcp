import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { XMLParser } from "fast-xml-parser";
import { z } from "zod";
import {
  boardGameItemSchema,
  searchResultSchema,
  type BoardGameItem,
  type SearchResult,
} from "./bgg-schema.js";

const BGG_API_ROOT = "https://boardgamegeek.com/xmlapi2";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
});

const server = new McpServer({
  name: "BGG API Explorer Server", // サーバーの名前
  version: "1.0.0", // サーバーのバージョン
});

// BGG API の Thing コマンドに対応する MCP Resource を定義
// 例: bgg://thing/{id} の形式でリソースにアクセスすることを想定
// {id} は BGG の Thing ID (ゲーム、拡張、アクセサリなど)
server.resource(
  "bgg-thing", // MCP Resource の名前
  new ResourceTemplate("bgg://thing/{id}", { list: undefined }), // Resource の URI パターン
  async (uri, { id }) => {
    // Resource が呼び出されたときのハンドラー関数
    console.log(`Received request for BGG Thing ID: ${id}`);

    try {
      // BGG API のルートパスと Thing コマンドのベース URI を使用して URL を構築
      // stats=1 パラメータを追加し、評価/ランキング情報も取得
      const bggApiUrl = `${BGG_API_ROOT}/thing?id=${id}&stats=1`;

      // BGG API エンドポイントへ HTTP GET リクエストを送信
      const response = await fetch(bggApiUrl);
      if (!response.ok) {
        throw new Error(`BGG API returned status: ${response.status}`);
      }
      const xmlText = await response.text();

      // XMLをパース
      const result = parser.parse(xmlText);

      // Zodスキーマを使って検証
      const parsedData = boardGameItemSchema.parse(result.items.item);

      // パースしたデータから必要な情報を抽出
      const game: BoardGameItem = Array.isArray(parsedData)
        ? parsedData[0]
        : parsedData;

      if (!game) {
        throw new Error(`ID:${id}のゲーム情報が見つかりませんでした`);
      }

      // 基本情報を取得
      const nameObj = Array.isArray(game.name)
        ? game.name.find((n) => n.type === "primary") || game.name[0]
        : game.name;

      const name = nameObj?.value || "不明";
      const yearPublished = game.yearpublished?.value || "不明";
      const minPlayers = game.minplayers?.value || "不明";
      const maxPlayers = game.maxplayers?.value || "不明";
      const playingTime = game.playingtime?.value || "不明";

      // ベストプレイ人数と推奨プレイ人数を取得
      let bestWith = "情報なし";
      let recommendedWith = "情報なし";

      if (game["poll-summary"]) {
        const pollSummary = Array.isArray(game["poll-summary"])
          ? game["poll-summary"].find((p) => p.name === "suggested_numplayers")
          : game["poll-summary"].name === "suggested_numplayers"
          ? game["poll-summary"]
          : null;

        if (pollSummary) {
          const results = Array.isArray(pollSummary.result)
            ? pollSummary.result
            : [pollSummary.result];
          const bestWithResult = results.find((r) => r.name === "bestwith");
          const recommendedWithResult = results.find(
            (r) => r.name === "recommmendedwith"
          );

          if (bestWithResult) {
            bestWith = bestWithResult.value;
          }
          if (recommendedWithResult) {
            recommendedWith = recommendedWithResult.value;
          }
        }
      }

      // 説明文を取得
      const description = game.description || "説明なし";

      // 評価情報を取得
      const stats = game.statistics;
      const ratings = stats?.ratings || {};
      const averageRating = ratings.average?.value || "未評価";
      const numRatings = ratings.usersrated?.value || "0";
      const rank = ratings.ranks?.rank;

      // メインランク（ボードゲーム全体でのランク）を取得
      let mainRank = "ランク外";
      if (Array.isArray(rank)) {
        const boardgameRank = rank.find((r) => r.name === "boardgame");
        if (boardgameRank && boardgameRank.value !== "Not Ranked") {
          mainRank = boardgameRank.value || "ランク外";
        }
      } else if (rank && rank.value !== "Not Ranked") {
        mainRank = rank.value || "ランク外";
      }

      // カテゴリを取得
      const categories = [];
      if (game.link) {
        const links = Array.isArray(game.link) ? game.link : [game.link];
        for (const link of links) {
          if (link.type === "boardgamecategory") {
            categories.push(link.value);
          }
        }
      }

      // コンテンツを構成
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
        contents: [
          {
            uri: uri.href,
            text: contentText,
          },
        ],
      };
    } catch (error) {
      console.error(`Error processing BGG Thing ID ${id}:`, error);
      // エラーが発生した場合は、エラー情報を含むレスポンスを返す
      return {
        contents: [],
        isError: true,
        errorMessage: `ID ${id}のボードゲーム情報の取得に失敗しました: ${error}`,
      };
    }
  }
);

server.tool(
  "bgg-search", // ツールの名前
  {
    // ツールの引数スキーマ
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
    // ツールのハンドラー関数
    try {
      // BGG APIへのリクエストURLを構築
      let url = `${BGG_API_ROOT}/search?query=${encodeURIComponent(query)}`;
      if (type) {
        // タイプパラメータを追加
        url += `&type=${encodeURIComponent(type)}`;
      }
      if (exact) {
        url += `&exact=1`; // 完全一致検索のフラグ
      }

      console.log(`Calling BGG Search API: ${url}`); // デバッグ出力

      // BGG APIを呼び出す
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const xmlText = await response.text();

      // XMLを解析して検索結果を取得
      const parsedData = parser.parse(xmlText);

      // Zodスキーマを使って検証
      const searchResult = searchResultSchema.parse(parsedData);

      // BGG API の検索結果は items > item の配列として返ってくる
      const items = searchResult.items?.item || [];
      const totalResults = searchResult.items?.total || 0;

      // 検索結果がない場合の処理
      if (totalResults === 0 || !items) {
        return {
          content: [
            {
              type: "text",
              text: `検索結果: "${query}" に一致するボードゲームは見つかりませんでした。`,
            },
          ],
        };
      }

      // 検索結果を整形（配列かどうかを確認）
      const itemsList = Array.isArray(items) ? items : [items];

      // 検索結果を整形してテキストに変換
      let resultText = `"${query}" の検索結果: ${totalResults}件\n\n`;

      itemsList.forEach((item, index) => {
        const id = item.id;
        const name =
          typeof item.name === "object" && item.name?.value
            ? item.name.value
            : typeof item.name === "string"
            ? item.name
            : "不明";
        const yearPublished = item.yearpublished?.value || "不明";
        const itemType = item.type || "不明";

        resultText += `${index + 1}. ${name} (${yearPublished})\n`;
        resultText += `   ID: ${id}, タイプ: ${itemType}\n`;
        resultText += `   詳細: bgg://thing/${id}\n\n`;
      });

      return {
        content: [
          {
            type: "text",
            text: resultText,
          },
        ],
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
        isError: true, // エラーフラグ
      };
    }
  }
);

// Start receiving messages on stdin and sending messages on stdout
const transport = new StdioServerTransport();
await server.connect(transport);
